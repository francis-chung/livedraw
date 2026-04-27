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

let objects = [];
const SAVES_DIR = path.join(__dirname, 'saves');

if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR);
}

function saveCanvas(name) {
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
        objects = JSON.parse(data);
        return objects;
    }
    return null;
}

function getSavedCanvases() {
    const files = fs.readdirSync(SAVES_DIR);
    return files.filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''));
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

    socket.emit('loadState', {
        objects
    });

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
                io.emit('loadState', { objects, name });
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

    socket.on('deleteCanvas', (name) => {
        try {
            deleteCanvas(name);
            io.emit('canvasDeleted', name);
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