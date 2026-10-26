let ioInstance = null;

/** Broadcast a saved message to every connected client */
function broadcastMessage(message) {
  if (ioInstance) {
    ioInstance.emit('receive_message', message);
  }
}

/** Helper to generate auto-replies */
function generateBotReply(username, content) {
  const text = (content || '').toLowerCase().trim();

  if (text === 'hi' || text === 'hello' || text === 'hlo' || text === 'hey') {
    return `Hello ${username || 'there'}! 👋 Welcome to RealTime Chat! How are you doing today?`;
  }
  if (text.includes('how are you') || text.includes('kasa ahes') || text.includes('kasi ahes')) {
    return `I am doing fantastic! 😊 Thanks for asking. How can I help you today?`;
  }
  if (text.includes('what') || text.includes('kay') || text.includes('project')) {
    return `This is a full-stack real-time chat application powered by Node.js, Socket.io, and SQLite! 🚀`;
  }
  if (text.includes('bye') || text.includes('good night') || text.includes('gn')) {
    return `Goodbye ${username}! Have a wonderful day ahead! ✨`;
  }
  return `Received your message: "${content}". Real-time communication via Socket.io is running smoothly! 👍`;
}

/** Register all Socket.io event handlers */
function setupSocket(io) {
  ioInstance = io;

  io.on('connection', socket => {
    console.log('User connected:', socket.id);
    socket.broadcast.emit('user_connected', { socketId: socket.id });

    // Receive a message directly via socket (alternative to REST)
    socket.on('send_message', async data => {
      try {
        console.log('Received send_message event:', data);
        const { username, content } = data;
        if (!username || !content) return;

        const { insertMessage } = require('../database/db');

        // 1. Save and broadcast user's message
        const saved = await insertMessage(username, content);
        io.emit('receive_message', saved);

        // 2. Auto-Reply Bot logic (if message is from a regular user)
        if (username !== 'Assistant 🤖') {
          setTimeout(async () => {
            // Show typing indicator
            io.emit('user_typing', { username: 'Assistant 🤖' });

            setTimeout(async () => {
              io.emit('user_stop_typing');
              const botReply = generateBotReply(username, content);
              const botSaved = await insertMessage('Assistant 🤖', botReply);
              io.emit('receive_message', botSaved);
            }, 1200);
          }, 600);
        }
      } catch (err) {
        console.error('Error in send_message socket handler:', err);
      }
    });

    // Typing indicator
    socket.on('typing', payload => {
      socket.broadcast.emit('user_typing', { ...payload, socketId: socket.id });
    });

    socket.on('stop_typing', () => {
      socket.broadcast.emit('user_stop_typing', { socketId: socket.id });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      socket.broadcast.emit('user_disconnected', { socketId: socket.id });
    });
  });
}

module.exports = { setupSocket, broadcastMessage };
