// imports dotenv module and calls it immediately
// loads .env file variables into process.env
// path ensures the correct directory is accessed for .env file
require('dotenv').config({ path: require('path').join('server', '.env') });
// a helper on top of http that handles requests easier
const express = require('express');

// http: essential mail system that can send
// and receive basic web messages
// normally: client asks, server responds, connection closes
const http = require('http');

// socket: real-time, continuous communication
const { Server } = require('socket.io');
// filesystem: includes functions to read, write and manage files
const fs = require('fs');
// path utility helps build file paths safely across different OS
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

// accesses environment variable (default configuration) for port
const PORT = process.env.PORT;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
// provides access to google verification
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const SESSION_SECRET = process.env.SESSION_SECRET;

// opens a live channel when user connects
// 5173: default frontend port for vite
// cors allows requests to go from 5173 to 3001
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

// list of objects from different canvases
// used as a map, with canvas names as keys and objects as values
const canvasStates = {};

// builds path to folder named saves
// __dirname: directory of file
// path.join ensures correct separators based on OS
const SAVES_DIR = path.join(__dirname, 'saves');

// ensures saves directory exists
// synchronous function waits for action to complete before 
// proceeding to next line
if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR);
}

// sets socket user on login or socket connect
// must be called only after verification
function setUser(socket, user) {
    socket.user = user;
    socket.emit('authenticated', user);
}

// ensures socket has an authenticated user before proceeding
function requireAuth(socket, callback) {
    if (!socket.user) {
        socket.emit('authenticationError', 'Authentication required');
        return false;
    }
    return true;
}

// validates google login token 
async function verifyGoogleToken(token) {
    try {
        // uses google auth library's official method to check if: 
        // 1. token is valid
        // 2. token was issued for this app (based on audience)
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        // processes verified token and returns relevant details
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

// returns all objects of a specific canvas from a specific user
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
    // ensures that any previous canvas is left before joining a new one
    leaveCurrentCanvas(socket);
    // type-prefixed custom for room naming
    // rooms and canvasStates keys must have both user ID and canvas name
    const room = `canvas:${socket.user.sub}:${name}`;
    socket.join(room);
    socket.currentRoom = room;
    socket.currentCanvas = name;
    return getCanvasState(socket.user.sub, name);
}

// saves canvas data as JSON file
function saveCanvas(userId, name, objects) {
    const userDir = path.join(SAVES_DIR, userId);
    if (!fs.existsSync(userDir)) {
        // creates a new directory if necessary, as well as all other required directories
        fs.mkdirSync(userDir, { recursive: true });
    }
    const fileName = `${name}.json`;
    const filePath = path.join(userDir, fileName);
    // converts objects into JSON with indentation formatting    
    const data = JSON.stringify(objects, null, 2);
    // writes to disk; overwrites if file already exists
    fs.writeFileSync(filePath, data);
    return fileName;
}

// loads saved canvas
function loadCanvas(userId, name) {
    // reconstructs expected user directory, then file name and path
    const userDir = path.join(SAVES_DIR, userId);
    const fileName = `${name}.json`;
    const filePath = path.join(userDir, fileName);
    if (fs.existsSync(filePath)) {
        // reads content files as a string
        const data = fs.readFileSync(filePath, 'utf8');
        const loadedObjects = JSON.parse(data);
        const key = `${userId}:${name}`;
        canvasStates[key] = loadedObjects;
        return loadedObjects;
    }
    return null;
}

// returns list of names of saved canvases
function getSavedCanvases(userId) {
    const userDir = path.join(SAVES_DIR, userId);
    if (!fs.existsSync(userDir)) {
        return [];
    }
    const files = fs.readdirSync(userDir);
    return files.filter(file => file.endsWith('.json')).map(file => {
        const name = file.replace('.json', '');
        const loadedObjects = loadCanvas(userId, name);
        return { name, objects: loadedObjects };
    });
}

function deleteCanvas(userId, name) {
    const userDir = path.join(SAVES_DIR, userId);
    const fileName = `${name}.json`;
    const filePath = path.join(userDir, fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    throw new Error(`Canvas ${name} not found`);
}

// once connection is established, activate socket emitters and listeners
// runs on every connection being made
io.on('connection', (socket) => {
    console.log('a user connected on: ', socket.id);
    socket.currentCanvas = null;
    socket.currentRoom = null;
    socket.user = null;

    // reads data sent by client during handshake connection
    // active when socket first connects, and user is already signed in
    if (socket.handshake.auth?.user) {
        setUser(socket, socket.handshake.auth.user);
        console.log('authenticated via handshake:', socket.user.email || socket.user.name || socket.user.sub);
    }

    // used for when socket is already connected, then client sends request    
    socket.on('authenticate', async ({ profile, token }) => {
        if (!token) {
            socket.emit('authenticationError', 'Missing token');
            return;
        }

        // verifies token before proceeding
        const verifiedProfile = await verifyGoogleToken(token);
        if (!verifiedProfile) {
            socket.emit('authenticationError', 'Invalid token');
            return;
        }

        // creates a session token signed by session secret for authenticity verification later
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
            // tries to decode token by checking signature and expiration and decoding payload
            const decoded = jwt.verify(sessionToken, SESSION_SECRET);
            setUser(socket, { sub: decoded.sub, email: decoded.email });
            socket.emit('sessionVerified', true);
        } catch (error) {
            socket.emit('authenticationError', 'Session expired or invalid');
        }
    })

    // emits current state of canvas    
    socket.emit('loadState', {
        objects: []
    });

    // waits for this client to send data, then broadcasts to everyone else
    // for each of the following connections, objects must be accessed
    // from the correct room
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

    // this and several other events check authentication before proceeding
    socket.on('saveCanvas', ({ name, objects: clientObjects }) => {
        if (!requireAuth(socket)) return;
        try {
            const key = `${socket.user.sub}:${name}`;
            // returns first truthy value in the list
            const objectsToSave = clientObjects || canvasStates[key] || [];
            canvasStates[key] = objectsToSave;
            const fileName = saveCanvas(socket.user.sub, name, objectsToSave);
            // only sends a response to the requesting client            
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
                // only loads the state of the client that sent the request
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

// listener attached to server's error event, when server does not 
// start properly or runs into low-level issue
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try stopping the other process or set PORT to a different value.`);
        process.exit(1);
    }
    throw error;
});