const express = require('express');
const router = express.Router();
const { getMessages, postMessage } = require('../controllers/messageController');

// GET /api/messages - fetch all messages
router.get('/messages', getMessages);

// POST /api/messages - send a new message (also broadcasts via Socket.io)
router.post('/messages', postMessage);

module.exports = router;
