function getCanvasState(canvasStates, canvasId) {
    const key = `canvas:${canvasId}`;
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

function joinCanvas(canvasStates, socket, canvasId) {
    leaveCurrentCanvas(socket);
    const room = `canvas:${canvasId}`;
    socket.join(room);
    socket.currentRoom = room;
    socket.currentCanvas = canvasId;
    return getCanvasState(canvasStates, canvasId);
}

module.exports = {
    getCanvasState,
    leaveCurrentCanvas,
    joinCanvas
};
