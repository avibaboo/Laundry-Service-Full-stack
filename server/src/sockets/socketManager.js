const { Server } = require('socket.io');

let io;

const initSockets = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for dev
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Allow user to join their specific room or admin room based on role
    socket.on('joinRoom', ({ userId, role }) => {
      if (role === 'ADMIN') {
        socket.join('admin_dashboard');
        console.log(`Socket ${socket.id} joined room admin_dashboard`);
      } else if (userId) {
        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} joined room user_${userId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized');
  }
  return io;
};

module.exports = { initSockets, getIO };
