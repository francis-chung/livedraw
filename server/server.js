require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const supabase = require('./supabase/supabaseClient');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const SESSION_SECRET = process.env.SESSION_SECRET;

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

const canvasStates = {};
const SAVES_DIR = path.join(__dirname, 'saves');

if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR);
}

function setUser(socket, user) {
    socket.user = user;
    socket.emit('authenticated', user);
}

function requireAuth(socket, callback) {
    if (!socket.user) {
        socket.emit('authenticationError', 'Authentication required');
        return false;
    }
    return true;
}

async function verifyGoogleToken(token) {
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        return {
            sub: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
        };
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

function getCanvasState(userId, name) {
    const key = `${userId}:${name}`;
    if (!canvasStates[key]) {
        canvasStates[key] = [];
    }
    return canvasStates[key];
}

function leaveCurrentCanvas(socket) {
    if (socket.currentRoom) {
        socket.leave(socket.currentRoom);
        socket.currentRoom = null;
        socket.currentCanvas = null;
    }
}

function joinCanvas(socket, name) {
    leaveCurrentCanvas(socket);
    const room = `canvas:${socket.user.sub}:${name}`;
    socket.join(room);
    socket.currentRoom = room;
    socket.currentCanvas = name;
    return getCanvasState(socket.user.sub, name);
}

// function saveCanvas(userId, name, objects) {
//     const userDir = path.join(SAVES_DIR, userId);
//     if (!fs.existsSync(userDir)) {
//         fs.mkdirSync(userDir, { recursive: true });
//     }
//     const fileName = `${name}.json`;
//     const filePath = path.join(userDir, fileName);
//     const data = JSON.stringify(objects, null, 2);
//     fs.writeFileSync(filePath, data);
//     return fileName;
// }

async function saveCanvas(userId, name, objects) {
    let { data: canvas } = await supabase
        .from('canvases')
        .select('*')
        .eq('owner_id', userId)
        .eq('name', name)
        .single();
    if (!canvas) {
        const res = await supabase
            .from('canvases')
            .insert({ owner_id: userId, name })
            .select()
            .single();
        canvas = res.data;
    }
    await supabase
        .from('canvas_data')
        .upsert({
            canvas_id: canvas.id,
            objects
        });
    return canvas.id;
}

// function loadCanvas(userId, name) {
//     const userDir = path.join(SAVES_DIR, userId);
//     const fileName = `${name}.json`;
//     const filePath = path.join(userDir, fileName);
//     if (fs.existsSync(filePath)) {
//         const data = fs.readFileSync(filePath, 'utf8');
//         const loadedObjects = JSON.parse(data);
//         const key = `${userId}:${name}`;
//         canvasStates[key] = loadedObjects;
//         return loadedObjects;
//     }
//     return null;
// }

async function loadCanvas(userId, name) {
    const { data: canvas } = await supabase
        .from('canvases')
        .select('*')
        .eq('owner_id', userId)
        .eq('name', name)
        .single();
    if (!canvas) return null;
    const { data } = await supabase
        .from('canvas_data')
        .select('objects')
        .eq('canvas_id', canvas.id)
        .single();
    return data?.objects || [];
}

// function getSavedCanvases(userId) {
//     const userDir = path.join(SAVES_DIR, userId);
//     if (!fs.existsSync(userDir)) {
//         return [];
//     }
//     const files = fs.readdirSync(userDir);
//     return files.filter(file => file.endsWith('.json')).map(file => {
//         const name = file.replace('.json', '');
//         const loadedObjects = loadCanvas(userId, name);
//         return { name, objects: loadedObjects };
//     });
// }

async function getSavedCanvases(userId) {
    const { data } = await supabase
        .from('canvases')
        .select('id, name');
    return data;
}

// function deleteCanvas(userId, name) {
//     const userDir = path.join(SAVES_DIR, userId);
//     const fileName = `${name}.json`;
//     const filePath = path.join(userDir, fileName);
//     if (fs.existsSync(filePath)) {
//         fs.unlinkSync(filePath);
//         return true;
//     }
//     throw new Error(`Canvas ${name} not found`);
// }

async function deleteCanvas(userId, name) {
    const { data: canvas } = await supabase
        .from('canvases')
        .select('*')
        .eq('owner_id', userId)
        .eq('name', name)
        .single();
    if (!canvas) throw new Error('Canvas not found');
    await supabase
        .from('canvases')
        .delete()
        .eq('id', canvas.id);
}

io.on('connection', (socket) => {
    console.log('a user connected on: ', socket.id);
    socket.currentCanvas = null;
    socket.currentRoom = null;
    socket.user = null;

    if (socket.handshake.auth?.user) {
        setUser(socket, socket.handshake.auth.user);
        console.log('authenticated via handshake:', socket.user.email || socket.user.name || socket.user.sub);
    }

    socket.on('authenticate', async ({ profile, token }) => {
        if (!token) {
            socket.emit('authenticationError', 'Missing token');
            return;
        }

        const verifiedProfile = await verifyGoogleToken(token);
        if (!verifiedProfile) {
            socket.emit('authenticationError', 'Invalid token');
            return;
        }

        const sessionToken = jwt.sign(
            { sub: verifiedProfile.sub, email: verifiedProfile.email },
            SESSION_SECRET,
            { expiresIn: '7d' }
        );

        setUser(socket, verifiedProfile);
        console.log('authenticated user:', verifiedProfile.email || verifiedProfile.name || verifiedProfile.sub);
        socket.emit('sessionToken', sessionToken);
    });

    socket.on('verifySession', async ({ sessionToken }) => {
        try {
            const decoded = jwt.verify(sessionToken, SESSION_SECRET);
            setUser(socket, { sub: decoded.sub, email: decoded.email });
            socket.emit('sessionVerified', true);
        } catch (error) {
            socket.emit('authenticationError', 'Session expired or invalid');
        }
    })

    socket.emit('loadState', {
        objects: []
    });

    socket.on('addObject', (object) => {
        if (!socket.currentCanvas || !socket.user) return;
        const objects = getCanvasState(socket.user.sub, socket.currentCanvas);
        objects.push(object);
        socket.to(socket.currentRoom).emit('addObject', object);
    });

    socket.on('updateObject', (object) => {
        if (!socket.currentCanvas || !socket.user) return;
        const objects = getCanvasState(socket.user.sub, socket.currentCanvas);
        const key = `${socket.user.sub}:${socket.currentCanvas}`;
        canvasStates[key] = objects.map(obj =>
            obj.id === object.id ? object : obj
        );
        socket.to(socket.currentRoom).emit('updateObject', object);
    });

    socket.on('moveObjects', (ids, dp) => {
        if (!socket.currentCanvas || !socket.user) return;
        const objects = getCanvasState(socket.user.sub, socket.currentCanvas);
        const key = `${socket.user.sub}:${socket.currentCanvas}`;
        canvasStates[key] = objects.map((obj) => {
            if (!ids.includes(obj.id)) return obj;
            if (obj.type === 'stroke') {
                return {
                    ...obj,
                    points: obj.points.map(p => ({
                        x: p.x + dp.x,
                        y: p.y + dp.y
                    }))
                };
            }
            if (obj.type === 'text') {
                return {
                    ...obj,
                    x: obj.x + dp.x,
                    y: obj.y + dp.y
                };
            }
            return obj;
        });
        socket.to(socket.currentRoom).emit('moveObjects', ids, dp);
    });

    socket.on('deleteObjects', (ids) => {
        if (!socket.currentCanvas || !socket.user) return;
        const objects = getCanvasState(socket.user.sub, socket.currentCanvas);
        const key = `${socket.user.sub}:${socket.currentCanvas}`;
        canvasStates[key] = objects.filter((obj) => !ids.includes(obj.id));
        socket.to(socket.currentRoom).emit('deleteObjects', ids);
    });

    socket.on('clear', () => {
        if (!socket.currentCanvas || !socket.user) return;
        const key = `${socket.user.sub}:${socket.currentCanvas}`;
        canvasStates[key] = [];
        socket.to(socket.currentRoom).emit('clear');
    });

    socket.on('saveCanvas', ({ name, objects: clientObjects }) => {
        if (!requireAuth(socket)) return;
        try {
            const key = `${socket.user.sub}:${name}`;
            const objectsToSave = clientObjects || canvasStates[key] || [];
            canvasStates[key] = objectsToSave;
            const fileName = saveCanvas(socket.user.sub, name, objectsToSave);
            socket.emit('canvasSaved', name);
            console.log(`Canvas saved as ${fileName} for user ${socket.user.sub}`);
        } catch (error) {
            socket.emit('saveError', error.message);
        }
    });

    socket.on('loadCanvas', (name) => {
        if (!requireAuth(socket)) return;
        try {
            const loadedObjects = loadCanvas(socket.user.sub, name);
            if (loadedObjects !== null) {
                const key = `${socket.user.sub}:${name}`;
                canvasStates[key] = loadedObjects;
                joinCanvas(socket, name);
                socket.emit('loadState', { objects: loadedObjects, name });
                console.log(`Canvas ${name} loaded in room ${socket.currentRoom} for user ${socket.user.sub}`);
            } else {
                socket.emit('loadError', `Canvas ${name} not found`);
            }
        } catch (error) {
            socket.emit('loadError', error.message);
        }
    });

    socket.on('leaveCanvas', () => {
        leaveCurrentCanvas(socket);
    });

    socket.on('getSavedCanvases', () => {
        if (!requireAuth(socket)) return;
        const canvases = getSavedCanvases(socket.user.sub);
        socket.emit('savedCanvases', canvases);
    });

    socket.on('deleteCanvas', (name) => {
        if (!requireAuth(socket)) return;
        try {
            deleteCanvas(socket.user.sub, name);
            socket.emit('canvasDeleted', name);
            const canvases = getSavedCanvases(socket.user.sub);
            socket.emit('savedCanvases', canvases);
            console.log(`Canvas ${name} deleted for user ${socket.user.sub}`);
        } catch (error) {
            socket.emit('deleteError', error.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected: ', socket.id);
    });
});

server.listen(PORT, () => console.log(`server running on port ${PORT}`));

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try stopping the other process or set PORT to a different value.`);
        process.exit(1);
    }
    throw error;
});