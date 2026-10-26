const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const { initDb } = require('./database/db');
const messageRoutes = require('./routes/messageRoutes');
const { setupSocket } = require('./sockets/chatSocket');

dotenv.config();

// Initialize DB
initDb();

const createAndStartServer = (port) => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', messageRoutes);

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  setupSocket(io);

  server.listen(port, () => {
    console.log(`Backend server listening on http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      createAndStartServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
};

const INITIAL_PORT = parseInt(process.env.PORT, 10) || 5000;
createAndStartServer(INITIAL_PORT);
