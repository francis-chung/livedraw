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

const app = express();
const server = http.createServer(app);

// accesses environment variable (default configuration) for port, with fallback
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

// stores state on the server
let objects = [];
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

// saves canvas data as JSON file
function saveCanvas(name) {
    const fileName = `${name}.json`;
    const filePath = path.join(SAVES_DIR, fileName);
    // converts objects into JSON with indentation formatting
    const data = JSON.stringify(objects, null, 2);
    // writes to disk; overwrites if file already exists
    fs.writeFileSync(filePath, data);
    return fileName;
}

// loads saved canvas
function loadCanvas(name) {
    // reconstructs expected file name and path
    const fileName = `${name}.json`;
    const filePath = path.join(SAVES_DIR, fileName);
    if (fs.existsSync(filePath)) {
        // reads content files as a string
        const data = fs.readFileSync(filePath, 'utf8');
        objects = JSON.parse(data);
        return objects;
    }
    return null;
}

// returns list of names of saved canvases
function getSavedCanvases() {
    const files = fs.readdirSync(SAVES_DIR);
    return files.filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''));
}

// once connection is established, activate socket emitters and listeners
// runs on every connection being made
io.on('connection', (socket) => {
    console.log('a user connected on: ', socket.id);

    // emits current state of canvas
    socket.emit('loadState', {
        objects
    });

    // waits for this client to send data, then broadcasts to everyone else    
    socket.on('addObject', (object) => {
        objects.push(object);
        socket.broadcast.emit('addObject', object);
    });

    socket.on('updateObject', (object) => {
        objects = objects.map(obj =>
            obj.id === object.id ? object : obj
        );
        socket.broadcast.emit('updateObject', object);
    })

    socket.on('moveObjects', (ids, dp) => {
        const idSet = new Set(ids);
        objects = objects.map((obj) => {
            if (!idSet.has(obj.id)) return obj;
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
        socket.broadcast.emit('moveObjects', ids, dp);
    });

    socket.on('deleteObjects', (ids) => {
        objects = objects.filter((obj) => !ids.includes(obj.id));
        socket.broadcast.emit('deleteObjects', ids);
    });

    socket.on('clear', () => {
        objects = [];
        socket.broadcast.emit('clear');
    });

    socket.on('saveCanvas', (name) => {
        try {
            const fileName = saveCanvas(name);
            // only sends a response to the requesting client
            socket.emit('canvasSaved', { name, fileName });
            console.log(`Canvas saved as ${fileName}`);
        } catch (error) {
            socket.emit('saveError', error.message);
        }
    });

    socket.on('loadCanvas', (name) => {
        try {
            const loadedObjects = loadCanvas(name);
            if (loadedObjects !== null) {
                objects = loadedObjects;
                // broadcasts to all clients to ensure everyone syncs properly
                io.emit('loadState', { objects });
                console.log(`Canvas ${name} loaded`);
            } else {
                socket.emit('loadError', `Canvas ${name} not found`);
            }
        } catch (error) {
            socket.emit('loadError', error.message);
        }
    });

    socket.on('getSavedCanvases', () => {
        const canvases = getSavedCanvases();
        socket.emit('savedCanvases', canvases);
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