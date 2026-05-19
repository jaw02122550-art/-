import { io } from "socket.io-client";

// In production, the URL will be the same as the site URL
const SOCKET_URL = window.location.origin;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});
