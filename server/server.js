const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

let objects = [];

io.on('connection', (socket) => {
    console.log('a user connected on: ', socket.id);

    socket.emit('loadState', {
        objects
    });

    socket.on('addObject', (object) => {
        objects.push(object);
        socket.broadcast.emit('addObject', object);
    });

    socket.on('deleteObjects', (ids) => {
        objects = objects.filter((obj) => !ids.includes(obj.id));
        socket.broadcast.emit('deleteObjects', ids);
    });

    socket.on('clear', () => {
        objects = [];
        socket.broadcast.emit('clear');
    });

    socket.on('disconnect', () => {
        console.log('user disconnected: ', socket.id);
    });
});

server.listen(3001, () => console.log('server running on port 3001'));