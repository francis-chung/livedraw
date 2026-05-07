import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', { autoConnect: false, transports: ["websocket"] });

export default socket;