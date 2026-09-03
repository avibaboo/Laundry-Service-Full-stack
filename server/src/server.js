const http = require('http');
const app = require('./app');
const { initSockets } = require('./sockets/socketManager');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.io
initSockets(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
