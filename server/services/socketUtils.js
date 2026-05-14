function getCanvasState(canvasStates, userId, name) {
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

function joinCanvas(canvasStates, socket, name) {
    leaveCurrentCanvas(socket);
    const room = `canvas:${socket.user.id}:${name}`;
    socket.join(room);
    socket.currentRoom = room;
    socket.currentCanvas = name;
    return getCanvasState(canvasStates, socket.user.id, name);
}

module.exports = {
    getCanvasState,
    leaveCurrentCanvas,
    joinCanvas
};
