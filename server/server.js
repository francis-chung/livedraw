// imports dotenv module and calls it immediately
// loads .env file variables into process.env
// path ensures the correct directory is accessed for .env file
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
// a helper on top of http that handles requests easier
const path = require('path');
const express = require('express');

// http: essential mail system that can send
// and receive basic web messages
// normally: client asks, server responds, connection closes
const http = require('http');

// socket: real-time, continuous communication
const { Server } = require('socket.io');
const { createSupabaseClient, verifySupabaseToken } = require('./supabase/supabaseClient');
const { setUser, requireAuth } = require('./services/authService');
const {
    saveCanvas,
    loadCanvas,
    loadCanvasById,
    getSavedCanvases,
    shareCanvas,
    deleteCanvas
} = require('./services/canvasService');
const {
    getCanvasState,
    leaveCurrentCanvas,
    joinCanvas
} = require('./services/socketUtils');
const { PassThrough } = require('stream');

const app = express();
const server = http.createServer(app);

// accesses environment variable (default configuration) for port
const PORT = process.env.PORT || 3001;

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

// once connection is established, activate socket emitters and listeners
// runs on every connection being made
io.on('connection', async (socket) => {
    console.log('a user connected on: ', socket.id);
    socket.supabase = createSupabaseClient();
    socket.currentCanvas = null;
    socket.currentRoom = null;
    socket.user = null;
    socket.accessToken = null;

    // handshake is a negotiation between two parties to exchange info and ensure 
    // communication is ready
    // reads data sent by client during handshake connection
    // active when socket first connects, and user is already signed in
    if (socket.handshake.auth?.accessToken) {
        // validates JWT access token 
        const verifiedUser = await verifySupabaseToken(socket.handshake.auth.accessToken);
        if (verifiedUser) { // sets up socket and user information
            // access token: short-lived credential that authenticates API requests
            socket.accessToken = socket.handshake.auth.accessToken;
            await setUser(socket, verifiedUser);
            console.log('authenticated via handshake:', socket.user.email || socket.user.name || socket.user.id);
        } else {
            socket.emit('authenticationError', 'Invalid access token');
        }
    }

    // used when authentication happens after connection
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

    // waits for this client to send data, then broadcasts to everyone else
    // for each of the following connections, objects must be accessed
    // from the correct room
    socket.on('addObject', (object) => {
        if (!socket.currentCanvas || !socket.user) return;
        const objects = getCanvasState(canvasStates, socket.user.id, socket.currentCanvas);
        objects.push(object);
        socket.to(socket.currentRoom).emit('addObject', object);
    });

    socket.on('updateObjects', (updatedObjects) => {
        if (!socket.currentCanvas || !socket.user) return;
        const objects = getCanvasState(canvasStates, socket.user.id, socket.currentCanvas);
        const key = `${socket.user.id}:${socket.currentCanvas}`;
        // creates a map that allows direct replacement of objects in 
        // stored array based on object id
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
        const objects = getCanvasState(canvasStates, socket.user.id, socket.currentCanvas);
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
        const objects = getCanvasState(canvasStates, socket.user.id, socket.currentCanvas);
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

    // this and several other events check authentication before proceeding   
    socket.on('saveCanvas', async ({ name, objects: clientObjects, canvasId }) => {
        if (!requireAuth(socket)) return;
        try {
            // supabase client must be redefined properly to ensure 
            // the access token is the right one
            const supabase = socket.supabase;
            const objectsToSave = clientObjects || [];
            const savedCanvasId = await saveCanvas(supabase, socket.user.id, name, objectsToSave, canvasId);
            // only sends a response to the requesting client 
            socket.emit('canvasSaved', { name, id: savedCanvasId });
            console.log(`Canvas saved as ${name} (${savedCanvasId}) for user ${socket.user.id}`);
        } catch (error) {
            console.error('Save canvas error:', error);
            socket.emit('saveError', error?.message || 'Unable to save canvas');
        }
    });

    socket.on('loadCanvas', async (payload) => {
        if (!requireAuth(socket)) return;
        try {
            const supabase = socket.supabase;
            let loaded;
            // loads canvas based on parameter that loadCanvas was called with
            if (typeof payload === 'object' && payload?.id) {
                loaded = await loadCanvasById(supabase, socket.user.id, payload.id);
            } else {
                loaded = await loadCanvas(supabase, socket.user.id, payload);
            }

            // processes loaded canvas: joins the canvas and loads state
            if (loaded !== null) {
                const canvasId = loaded.id || null;
                if (canvasId) {
                    canvasStates[`canvas:${canvasId}`] = loaded.objects;
                    joinCanvas(canvasStates, socket, canvasId);
                    socket.emit('loadState', {
                        objects: loaded.objects,
                        id: canvasId,
                        name: loaded.name,
                        owner_id: loaded.owner_id
                    });
                    console.log(`Canvas ${loaded.name} (${canvasId}) loaded in room ${socket.currentRoom} for user ${socket.user.id}`);
                } else {
                    socket.emit('loadError', 'Canvas metadata missing');
                }
            } else {
                socket.emit('loadError', `Canvas not found or access denied`);
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

    socket.on('shareCanvas', async ({ canvasId, targetUserId, role }) => {
        if (!requireAuth(socket)) return;
        try {
            const supabase = socket.supabase;
            await shareCanvas(supabase, socket.user.id, canvasId, targetUserId, role);
            socket.emit('shareSuccess', { canvasId, targetUserId, role });
            console.log(`Canvas ${canvasId} shared with ${targetUserId} as ${role} by ${socket.user.id}`);
        } catch (error) {
            console.error('Share canvas error:', error);
            socket.emit('shareError', error?.message || 'Unable to share canvas');
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

// listener attached to server's error event, when server does not 
// start properly or runs into low-level issue
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try stopping the other process or set PORT to a different value.`);
        process.exit(1);
    }
    throw error;
});