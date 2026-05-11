require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createSupabaseClient, verifySupabaseToken } = require('./supabase/supabaseClient');
const { PassThrough } = require('stream');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

const canvasStates = {};

async function setUser(socket, user) {
    socket.user = user;
    socket.supabase = createSupabaseClient(socket.accessToken);
    const { data, error } = await socket.supabase
        .from('users')
        .upsert({
            id: user.id,
            email: user.email,
            name: user.name,
            picture: user.picture
        })
        .select();
    if (error) {
        console.error('Error upserting user:', error);
    } else {
        console.log('User upserted successfully');
    }
    socket.emit('authenticated', user);
}

function requireAuth(socket, callback) {
    if (!socket.user) {
        socket.emit('authenticationError', 'Authentication required');
        return false;
    }
    return true;
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
    const room = `canvas:${socket.user.id}:${name}`;
    socket.join(room);
    socket.currentRoom = room;
    socket.currentCanvas = name;
    return getCanvasState(socket.user.id, name);
}

async function saveCanvas(supabase, userId, name, objects) {
    const { data: existingCanvas, error: fetchError } = await supabase
        .from('canvases')
        .select('id')
        .eq('owner_id', userId)
        .eq('name', name)
        .maybeSingle();
    if (fetchError) {
        throw fetchError;
    }

    let canvas = existingCanvas;
    if (!canvas) {
        const { data, error: insertError } = await supabase
            .from('canvases')
            .insert({ owner_id: userId, name })
            .select('id')
            .single();
        if (insertError) {
            throw insertError;
        }
        canvas = data;
    }

    const { data: existingData, error: existingDataError } = await supabase
        .from('canvas_data')
        .select('*')
        .eq('canvas_id', canvas.id)
        .maybeSingle();
    if (existingDataError) {
        throw existingDataError;
    }

    if (!existingData) {
        const { error: insertError } = await supabase
            .from('canvas_data')
            .insert({
                canvas_id: canvas.id,
                objects
            });
        if (insertError) {
            throw insertError;
        }
    } else {
        const { error: updateError } = await supabase
            .from('canvas_data')
            .update({
                canvas_id: canvas.id,
                objects
            })
            .eq('canvas_id', canvas.id);
        if (updateError) {
            throw updateError;
        }
    }

    return canvas.id;
}

async function loadCanvas(supabase, userId, name) {
    const { data: canvas, error: canvasError } = await supabase
        .from('canvases')
        .select('id')
        .eq('owner_id', userId)
        .eq('name', name)
        .maybeSingle();
    if (canvasError) {
        throw canvasError;
    }
    if (!canvas) return null;

    const { data, error: dataError } = await supabase
        .from('canvas_data')
        .select('objects')
        .eq('canvas_id', canvas.id)
        .maybeSingle();
    if (dataError) {
        throw dataError;
    }
    return data?.objects || [];
}

async function getSavedCanvases(supabase, userId) {
    const { data: canvases, error: canvasError } = await supabase
        .from('canvases')
        .select('id, name')
        .eq('owner_id', userId);
    if (canvasError) {
        throw canvasError;
    }
    if (!canvases || canvases.length === 0) {
        return [];
    }

    const canvasIds = canvases.map((canvas) => canvas.id);
    const { data: dataRows, error: dataError } = await supabase
        .from('canvas_data')
        .select('canvas_id, objects')
        .in('canvas_id', canvasIds);
    if (dataError) {
        throw dataError;
    }

    const canvasDataMap = (dataRows || []).reduce((acc, row) => {
        acc[row.canvas_id] = row.objects || [];
        return acc;
    }, {});

    return canvases.map((canvas) => ({
        id: canvas.id,
        name: canvas.name,
        objects: canvasDataMap[canvas.id] || []
    }));
}

async function deleteCanvas(supabase, userId, name) {
    const { data: canvas, error: fetchError } = await supabase
        .from('canvases')
        .select('id')
        .eq('owner_id', userId)
        .eq('name', name)
        .maybeSingle();
    if (fetchError) {
        throw fetchError;
    }
    if (!canvas) {
        throw new Error('Canvas not found');
    }

    const { error: deleteDataError } = await supabase
        .from('canvas_data')
        .delete()
        .eq('canvas_id', canvas.id);
    if (deleteDataError) {
        throw deleteDataError;
    }

    const { error: deleteCanvasError } = await supabase
        .from('canvases')
        .delete()
        .eq('id', canvas.id);
    if (deleteCanvasError) {
        throw deleteCanvasError;
    }
}

io.on('connection', async (socket) => {
    console.log('a user connected on: ', socket.id);
    socket.supabase = createSupabaseClient();
    socket.currentCanvas = null;
    socket.currentRoom = null;
    socket.user = null;
    socket.accessToken = null;

    if (socket.handshake.auth?.accessToken) {
        const verifiedUser = await verifySupabaseToken(socket.handshake.auth.accessToken);
        if (verifiedUser) {
            socket.accessToken = socket.handshake.auth.accessToken;
            await setUser(socket, verifiedUser);
            console.log('authenticated via handshake:', socket.user.email || socket.user.name || socket.user.id);
        } else {
            socket.emit('authenticationError', 'Invalid access token');
        }
    }

    socket.on('authenticate', async ({ accessToken }) => {
        if (!accessToken) {
            socket.emit('authenticationError', 'Missing access token');
            return;
        }

        const verifiedUser = await verifySupabaseToken(accessToken);
        if (!verifiedUser) {
            socket.emit('authenticationError', 'Invalid access token');
            return;
        }

        socket.accessToken = accessToken;
        await setUser(socket, verifiedUser);
        console.log('authenticated user:', verifiedUser.email || verifiedUser.name || verifiedUser.id);
        socket.emit('sessionVerified', true);
    });

    socket.on('addObject', (object) => {
        if (!socket.currentCanvas || !socket.user) return;
        const objects = getCanvasState(socket.user.id, socket.currentCanvas);
        objects.push(object);
        socket.to(socket.currentRoom).emit('addObject', object);
    });

    socket.on('updateObjects', (updatedObjects) => {
        if (!socket.currentCanvas || !socket.user) return;
        const objects = getCanvasState(socket.user.id, socket.currentCanvas);
        const key = `${socket.user.id}:${socket.currentCanvas}`;
        const updates = new Map(
            updatedObjects.map(obj => [obj.id, obj])
        );
        canvasStates[key] = objects.map(obj =>
            updates.get(obj.id) || obj
        );
        socket.to(socket.currentRoom).emit('updateObjects', updatedObjects);
    });

    socket.on('moveObjects', (ids, dp) => {
        if (!socket.currentCanvas || !socket.user) return;
        const objects = getCanvasState(socket.user.id, socket.currentCanvas);
        const key = `${socket.user.id}:${socket.currentCanvas}`;
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
        const objects = getCanvasState(socket.user.id, socket.currentCanvas);
        const key = `${socket.user.id}:${socket.currentCanvas}`;
        canvasStates[key] = objects.filter((obj) => !ids.includes(obj.id));
        socket.to(socket.currentRoom).emit('deleteObjects', ids);
    });

    socket.on('clear', () => {
        if (!socket.currentCanvas || !socket.user) return;
        const key = `${socket.user.id}:${socket.currentCanvas}`;
        canvasStates[key] = [];
        socket.to(socket.currentRoom).emit('clear');
    });

    socket.on('saveCanvas', async ({ name, objects: clientObjects }) => {
        if (!requireAuth(socket)) return;
        try {
            const supabase = socket.supabase;
            const key = `${socket.user.id}:${name}`;
            const objectsToSave = clientObjects || canvasStates[key] || [];
            canvasStates[key] = objectsToSave;
            await saveCanvas(supabase, socket.user.id, name, objectsToSave);
            socket.emit('canvasSaved', name);
            console.log(`Canvas saved as ${name} for user ${socket.user.id}`);
        } catch (error) {
            console.error('Save canvas error:', error);
            socket.emit('saveError', error?.message || 'Unable to save canvas');
        }
    });

    socket.on('loadCanvas', async (name) => {
        if (!requireAuth(socket)) return;
        try {
            const supabase = socket.supabase;
            const loadedObjects = await loadCanvas(supabase, socket.user.id, name);
            if (loadedObjects !== null) {
                const key = `${socket.user.id}:${name}`;
                canvasStates[key] = loadedObjects;
                joinCanvas(socket, name);
                socket.emit('loadState', { objects: loadedObjects, name });
                console.log(`Canvas ${name} loaded in room ${socket.currentRoom} for user ${socket.user.id}`);
            } else {
                socket.emit('loadError', `Canvas ${name} not found`);
            }
        } catch (error) {
            console.error('Load canvas error:', error);
            socket.emit('loadError', error?.message || 'Unable to load canvas');
        }
    });

    socket.on('leaveCanvas', () => {
        leaveCurrentCanvas(socket);
    });

    socket.on('getSavedCanvases', async () => {
        if (!requireAuth(socket)) return;
        try {
            const supabase = socket.supabase;
            const canvases = await getSavedCanvases(supabase, socket.user.id);
            socket.emit('savedCanvases', canvases);
        } catch (error) {
            console.error('Get saved canvases error:', error);
            socket.emit('savedCanvasesError', error?.message || 'Unable to retrieve saved canvases');
        }
    });

    socket.on('deleteCanvas', async (name) => {
        if (!requireAuth(socket)) return;
        try {
            const supabase = socket.supabase;
            await deleteCanvas(supabase, socket.user.id, name);
            socket.emit('canvasDeleted', name);
            const canvases = await getSavedCanvases(supabase, socket.user.id);
            socket.emit('savedCanvases', canvases);
            console.log(`Canvas ${name} deleted for user ${socket.user.id}`);
        } catch (error) {
            console.error('Delete canvas error:', error);
            socket.emit('deleteError', error?.message || 'Unable to delete canvas');
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