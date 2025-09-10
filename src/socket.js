import { io } from "socket.io-client";

=
const URL = process.env.NODE_ENV === 'production' 
  ? 'https://doodleserver-4t78.onrender.com' // Render server URL
  : 'http://localhost:5000';

export const socket = io(URL);
