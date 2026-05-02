const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

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
const SAVES_DIR = path.join(__dirname, 'saves');

if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR);
}

function getCanvasState(name) {
    if (!canvasStates[name]) {
        canvasStates[name] = [];
    }
    return canvasStates[name];
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
    const room = `canvas:${name}`;
    socket.join(room);
    socket.currentRoom = room;
    socket.currentCanvas = name;
    return getCanvasState(name);
}

function saveCanvas(name, objects) {
    const fileName = `${name}.json`;
    const filePath = path.join(SAVES_DIR, fileName);
    const data = JSON.stringify(objects, null, 2);
    fs.writeFileSync(filePath, data);
    return fileName;
}

function loadCanvas(name) {
    const fileName = `${name}.json`;
    const filePath = path.join(SAVES_DIR, fileName);
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const loadedObjects = JSON.parse(data);
        canvasStates[name] = loadedObjects;
        return loadedObjects;
    }
    return null;
}

function getSavedCanvases() {
    const files = fs.readdirSync(SAVES_DIR);
    return files.filter(file => file.endsWith('.json')).map(file => {
        const name = file.replace('.json', '');
        const loadedObjects = loadCanvas(name);
        return { name, objects: loadedObjects };
    });
}

function deleteCanvas(name) {
    const fileName = `${name}.json`;
    const filePath = path.join(SAVES_DIR, fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    throw new Error(`Canvas ${name} not found`);
}

io.on('connection', (socket) => {
    console.log('a user connected on: ', socket.id);
    socket.currentCanvas = null;
    socket.currentRoom = null;

    socket.emit('loadState', {
        objects: []
    });

    socket.on('addObject', (object) => {
        if (!socket.currentCanvas) return;
        const objects = getCanvasState(socket.currentCanvas);
        objects.push(object);
        socket.to(socket.currentRoom).emit('addObject', object);
    });

    socket.on('updateObject', (object) => {
        if (!socket.currentCanvas) return;
        const objects = getCanvasState(socket.currentCanvas);
        canvasStates[socket.currentCanvas] = objects.map(obj =>
            obj.id === object.id ? object : obj
        );
        socket.to(socket.currentRoom).emit('updateObject', object);
    });

    socket.on('moveObjects', (ids, dp) => {
        if (!socket.currentCanvas) return;
        const objects = getCanvasState(socket.currentCanvas);
        canvasStates[socket.currentCanvas] = objects.map((obj) => {
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
        if (!socket.currentCanvas) return;
        const objects = getCanvasState(socket.currentCanvas);
        canvasStates[socket.currentCanvas] = objects.filter((obj) => !ids.includes(obj.id));
        socket.to(socket.currentRoom).emit('deleteObjects', ids);
    });

    socket.on('clear', () => {
        if (!socket.currentCanvas) return;
        canvasStates[socket.currentCanvas] = [];
        socket.to(socket.currentRoom).emit('clear');
    });

    socket.on('saveCanvas', ({ name, objects: clientObjects }) => {
        try {
            const objectsToSave = clientObjects || canvasStates[name] || [];
            canvasStates[name] = objectsToSave;
            const fileName = saveCanvas(name, objectsToSave);
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
                joinCanvas(socket, name);
                socket.emit('loadState', { objects: loadedObjects, name });
                console.log(`Canvas ${name} loaded in room ${socket.currentRoom}`);
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
        const canvases = getSavedCanvases();
        socket.emit('savedCanvases', canvases);
    });

    socket.on('deleteCanvas', (name) => {
        try {
            deleteCanvas(name);
            socket.emit('canvasDeleted', name);
            io.emit('savedCanvases', getSavedCanvases());
            console.log(`Canvas ${name} deleted`);
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