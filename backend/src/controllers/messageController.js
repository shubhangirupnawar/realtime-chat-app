const { insertMessage, getAllMessages } = require('../database/db');
const { broadcastMessage } = require('../sockets/chatSocket');

// GET /api/messages – fetch history
async function getMessages(req, res) {
  try {
    const msgs = await getAllMessages();
    res.json(msgs);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ success: false, error: 'DB error' });
  }
}

// POST /api/messages – send new message and broadcast
async function postMessage(req, res) {
  const { username, content } = req.body;
  if (!username || !content) {
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }
  try {
    const saved = await insertMessage(username, content);
    broadcastMessage(saved);
    res.json(saved);
  } catch (err) {
    console.error('Error saving message:', err);
    res.status(500).json({ success: false, error: 'DB error' });
  }
}

module.exports = { getMessages, postMessage };
