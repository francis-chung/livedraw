// returns all objects of a specific canvas from a specific user
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
    // ensures that any previous canvas is left before joining a new one
    leaveCurrentCanvas(socket);
    // type-prefixed custom for room naming
    // rooms and canvasStates keys must have canvas id
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
