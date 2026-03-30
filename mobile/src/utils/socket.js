import { io } from 'socket.io-client';
import { DOMAIN } from './api';

const socket = io(DOMAIN, {
  path: '/socket.io/',
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 3000,
  reconnectionAttempts: Infinity,
  timeout: 20000,
});

socket.on('connect', () => {
  console.log('[Socket] connected:', socket.id);
});

socket.on('connect_error', (err) => {
  console.log('[Socket] connect_error:', err.message, err.type, JSON.stringify(err.description || ''));
});

socket.on('disconnect', (reason) => {
  console.log('[Socket] disconnected:', reason);
});

export default socket;
