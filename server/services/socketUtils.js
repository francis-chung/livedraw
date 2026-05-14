// returns all objects of a specific canvas from a specific user
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
    // ensures that any previous canvas is left before joining a new one
    leaveCurrentCanvas(socket);
    // type-prefixed custom for room naming
    // rooms and canvasStates keys must have both user ID and canvas name    
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
