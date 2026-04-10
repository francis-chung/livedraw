// a helper on top of http that handles requests easier
const express = require('express');

// http: essential mail system that can send
// and receive basic web messages
// normally: client asks, server responds, connection closes
const http = require('http');

// socket: real-time, continuous communication
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

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

// once connection is established, activate socket emitters and listeners
// runs on every connection being made
io.on('connection', (socket) => {
    console.log('a user connected on: ', socket.id);

    // emits current state of canvas
    socket.emit('loadState', {
        objects
    });

    // waits for this client to send data, then broadcasts to everyone else
    socket.on('startStroke', (stroke) => {
        objects.push(stroke);
        socket.broadcast.emit('startStroke', stroke);
    });

    socket.on('appendStroke', ({ id, point }) => {
        const stroke = objects.find((obj) => obj.id === id && obj.type === 'stroke');
        if (stroke) {
            stroke.points.push(point);
            socket.broadcast.emit('appendStroke', { id, point });
        }
    });

    socket.on('addObject', (object) => {
        objects.push(object);
        socket.broadcast.emit('addObject', object);
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