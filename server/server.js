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

io.on('connection', (socket) => {
    console.log('a user connected on: ', socket.id);

    socket.on('draw', (data) => {
        socket.broadcast.emit('draw', data)
    });

    socket.on('disconnect', () => {
        console.log('user disconnected: ', socket.id);
    });
});

server.listen(3001, () => console.log('server running on port 3001'));