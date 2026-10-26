import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const PORTS = [5001, 5000, 5002];

function App() {
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [typingUser, setTypingUser] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [activePort, setActivePort] = useState(5001);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Connect socket to a specific port
  const connectToSocket = (port) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    console.log(`Connecting to Socket on port ${port}...`);
    const socket = io(`http://localhost:${port}`, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 3000
    });
    socketRef.current = socket;
    setActivePort(port);

    socket.on('connect', () => {
      setIsConnected(true);
      console.log(`Socket connected successfully on port ${port}:`, socket.id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected.');
    });

    socket.on('receive_message', (msg) => {
      console.log('Received message from server:', msg);
      setMessages((prev) => {
        // Prevent duplicate messages if already present
        const exists = prev.some(
          (m) =>
            (msg.id && m.id === msg.id) ||
            (m.content === msg.content && m.username === msg.username && Math.abs((m.timestamp || 0) - (msg.timestamp || 0)) < 3000)
        );
        if (exists) {
          // Replace optimistic pending message with confirmed message
          return prev.map((m) =>
            (m.content === msg.content && m.username === msg.username && m.pending) ? msg : m
          );
        }
        return [...prev, msg];
      });
    });

    socket.on('user_typing', (data) => {
      if (data.username !== username) {
        setTypingUser(data.username);
      }
    });

    socket.on('user_stop_typing', () => {
      setTypingUser('');
    });
  };

  // Find active port and load chat history
  const detectBackendAndConnect = async () => {
    for (const port of PORTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`http://localhost:${port}/api/messages`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.messages || []);
          setMessages(list);
          connectToSocket(port);
          return true;
        }
      } catch (err) {
        // try next port
      }
    }
    return false;
  };

  // Initial check when joined
  useEffect(() => {
    if (!isJoined) return;

    detectBackendAndConnect();

    // Auto-retry polling every 3 seconds if not connected
    const interval = setInterval(() => {
      if (!socketRef.current?.connected) {
        console.log('Polling to find backend server...');
        detectBackendAndConnect();
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [isJoined]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setIsJoined(true);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const content = inputText.trim();
    if (!content) return;

    const messageData = {
      username: username.trim(),
      content: content,
      timestamp: Date.now()
    };

    setInputText('');

    // 1. Optimistic UI update: display immediately
    setMessages((prev) => [...prev, { ...messageData, id: 'temp-' + Date.now(), pending: true }]);

    // 2. Send via Socket.io if connected
    if (socketRef.current?.connected) {
      socketRef.current.emit('send_message', messageData);
      socketRef.current.emit('stop_typing');
    } else {
      // 3. Fallback: try REST API across ports
      let sent = false;
      for (const port of PORTS) {
        try {
          const res = await fetch(`http://localhost:${port}/api/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData)
          });
          if (res.ok) {
            const data = await res.json();
            const savedMsg = data.message || data;
            setMessages((prev) =>
              prev.map((m) => (m.pending && m.content === content ? savedMsg : m))
            );
            sent = true;
            // Also connect socket if not connected yet
            if (!isConnected) connectToSocket(port);
            break;
          }
        } catch (err) {}
      }
      if (!sent) {
        console.warn('Backend server unreachable; message stored in local screen.');
      }
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (socketRef.current?.connected) {
      if (e.target.value.length > 0) {
        socketRef.current.emit('typing', { username });
      } else {
        socketRef.current.emit('stop_typing');
      }
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0b0f19' }}>
      {/* Join Screen Modal */}
      {!isJoined && (
        <div className="auth-overlay">
          <div className="auth-card">
            <h1 className="auth-title">Welcome to RealTime Chat</h1>
            <p className="auth-subtitle">Enter your name to start chatting instantly</p>
            <form onSubmit={handleJoin} className="auth-form">
              <input
                type="text"
                placeholder="Enter your username (e.g. Shubhangi)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="auth-input"
                autoFocus
                required
              />
              <button type="submit" className="auth-button">
                Join Room &rarr;
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main App Window */}
      <div className="app-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="brand-icon">&spades;</div>
            <div className="brand-info">
              <h2>Chat Space</h2>
              <p>
                <span className="status-dot" style={{ backgroundColor: isConnected ? '#10b981' : '#f59e0b' }}></span>
                {isConnected ? `Online (Port ${activePort})` : 'Connecting...'}
              </p>
            </div>
          </div>

          <div className="sidebar-content">
            <div className="user-profile-card">
              <div className="avatar">
                {username ? username.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="user-info">
                <h4>{username || 'Guest'}</h4>
                <p>{isConnected ? 'Active now' : 'Waiting for server'}</p>
              </div>
            </div>

            <div className="channels-list">
              <div className="channel-item">
                <span>#</span> General Chat
              </div>
            </div>

            {!isConnected && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '12px', marginTop: 'auto', fontSize: '0.8rem', color: '#fca5a5' }}>
                <p style={{ fontWeight: 600, marginBottom: '4px' }}>⚠️ Server Not Connected</p>
                <p style={{ color: '#d1d5db', fontSize: '0.75rem', marginBottom: '8px' }}>टर्मिनलमध्ये Backend चालू करा:</p>
                <code style={{ background: '#111827', padding: '4px 6px', borderRadius: '4px', display: 'block', fontSize: '0.7rem' }}>npm run dev</code>
                <button
                  onClick={detectBackendAndConnect}
                  style={{ marginTop: '8px', width: '100%', padding: '6px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  🔄 Retry Connection
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Chat Panel */}
        <main className="chat-main">
          {/* Chat Header */}
          <header className="chat-header">
            <div className="chat-header-info">
              <h3># General Room</h3>
              <p>Real-time updates powered by Socket.io & SQLite</p>
            </div>
            <div className="badge">
              <span className="status-dot" style={{ backgroundColor: isConnected ? '#10b981' : '#f59e0b' }}></span>
              {isConnected ? 'Socket Active' : 'Connecting...'}
            </div>
          </header>

          {/* Messages list */}
          <div className="messages-container">
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '60px', fontSize: '1.05rem' }}>
                👋 Welcome {username || 'friend'}! Send a message below to start chatting.
              </div>
            ) : (
              messages.map((msg, index) => {
                const isOutgoing = msg.username === username;
                return (
                  <div
                    key={msg.id || index}
                    className={`message-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`}
                  >
                    {!isOutgoing && <span className="message-author">{msg.username}</span>}
                    <div className="message-bubble">
                      {msg.content}
                      <span className="message-time">
                        {formatTime(msg.timestamp)} {msg.pending && '⏳'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing indicator */}
          <div className="typing-indicator">
            {typingUser ? `${typingUser} is typing...` : ''}
          </div>

          {/* Input Bar */}
          <div className="input-container">
            <form onSubmit={handleSendMessage} className="input-form">
              <input
                type="text"
                placeholder="Type your message..."
                value={inputText}
                onChange={handleInputChange}
                className="message-input"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="send-button"
              >
                Send
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;