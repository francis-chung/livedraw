import { io } from 'socket.io-client';

// autoconnect disabled so that event listeners are set up
// before socket connects, and canvas loads properly on setup
const socket = io('http://localhost:3001', { autoConnect: false, transports: ["websocket"] });

export default socket;