import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import useAuth from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import { apiFetch } from './api/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * User as returned by GET /users.
 * `role`       = chatbot persona / job title (unchanged)
 * `accessRole` = RBAC application role (new – not used for UI restrictions yet)
 */
interface User {
  id: string;
  name: string;
  email: string;
  /** Chatbot persona / job title. Used for card display and chat header. */
  role: string;
  status: 'Active' | 'Inactive' | 'Pending';
  avatar: string;
  /** Application RBAC role. Carried along but not used for UI restrictions yet. */
  accessRole?: string;
}

interface Message {
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
}

// ─── Full-screen loading spinner ──────────────────────────────────────────────

function AppLoadingScreen() {
  return (
    <div style={{
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: 'var(--text)', fontSize: '14px', margin: 0 }}>
        Restoring session…
      </p>
      {/* Inline keyframe – avoids adding a CSS file just for this tiny element */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Main application (rendered only when authenticated) ─────────────────────

function AppAuthenticated() {
  const { currentUser, logout } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // WebSocket-specific state variables
  const [socketConnected, setSocketConnected] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [inputText, setInputText] = useState('');
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});
  const [recentlyUpdated, setRecentlyUpdated] = useState<Record<string, boolean>>({});

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ── Fetch users via apiClient (sends Authorization: Bearer <token>) ─────────
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<User[]>('/users');
      setUsers(data);
    } catch (err: any) {
      setError(
        err.message || 'Failed to connect to the backend on localhost:3000'
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial users list
  useEffect(() => {
    fetchUsers();
  }, []);

  // Socket connection lifecycle and event subscription
  // ── NOTE: WebSocket authentication is NOT implemented in this step. ─────────
  useEffect(() => {
    const socket = io('http://localhost:3000', {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket.io server');
      setSocketConnected('connected');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from socket.io server');
      setSocketConnected('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setSocketConnected('disconnected');
    });

    // Real-time status update broadcasts
    socket.on('user_status_update', (data: { userId: string; status: 'Active' | 'Inactive' | 'Pending' }) => {
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === data.userId ? { ...user, status: data.status } : user
        )
      );

      setRecentlyUpdated((prev) => ({ ...prev, [data.userId]: true }));
      setTimeout(() => {
        setRecentlyUpdated((prev) => ({ ...prev, [data.userId]: false }));
      }, 1000);
    });

    // Messages listener
    socket.on('receive_message', (message: Message) => {
      const conversationId = message.senderId === 'you' ? message.receiverId : message.senderId;

      setMessages((prev) => {
        const history = prev[conversationId] || [];
        const isDuplicate = history.some(
          (m) => m.timestamp === message.timestamp && m.text === message.text && m.senderId === message.senderId
        );
        if (isDuplicate) return prev;
        return {
          ...prev,
          [conversationId]: [...history, message],
        };
      });
    });

    // Typing notifier listener
    socket.on('typing', (data: { userId: string; isTyping: boolean }) => {
      setTypingStatus((prev) => ({
        ...prev,
        [data.userId]: data.isTyping,
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Auto-scroll chat box
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingStatus, activeChatUser]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatUser || !socketRef.current) return;

    const payload = {
      senderId: 'you',
      receiverId: activeChatUser.id,
      text: inputText.trim(),
    };

    socketRef.current.emit('send_message', payload);
    setInputText('');
  };

  const roles = ['All', ...Array.from(new Set(users.map((u) => u.role)))];
  const statuses = ['All', 'Active', 'Pending', 'Inactive'];

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.role.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'All' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="app-container">
      {/* Header section with connection status */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <span className="logo-dot"></span>
            <h1>Team Directory</h1>
          </div>
          <div className="connection-badge-container">
            {loading ? (
              <span className="badge-connection loading">
                <span className="pulse-dot"></span> HTTP Connecting...
              </span>
            ) : error ? (
              <span className="badge-connection disconnected">
                <span className="pulse-dot"></span> HTTP Offline
              </span>
            ) : (
              <span className="badge-connection connected">
                <span className="pulse-dot"></span> HTTP Online
              </span>
            )}

            {socketConnected === 'connecting' ? (
              <span className="badge-connection loading socket-badge">
                <span className="pulse-dot yellow"></span> Socket Connecting...
              </span>
            ) : socketConnected === 'disconnected' ? (
              <span className="badge-connection disconnected socket-badge">
                <span className="pulse-dot red"></span> Socket Offline
              </span>
            ) : (
              <span className="badge-connection connected socket-badge">
                <span className="pulse-dot green"></span> Socket Online
              </span>
            )}

            {/* ── Authenticated user chip + Logout ───────────────────────── */}
            <div className="auth-user-chip">
              {currentUser?.avatar && (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="auth-user-avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        currentUser.name
                      )}&background=aa3bff&color=fff`;
                  }}
                />
              )}
              <span className="auth-user-name">{currentUser?.name}</span>
              <button
                id="logout-btn"
                className="logout-btn"
                onClick={logout}
                title="Sign out"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="15" height="15" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
        <p className="header-subtitle">
          Manage your organization's core team members and external contractors.
        </p>
      </header>

      {/* Control panel for filters & search */}
      <div className="control-panel">
        <div className="search-wrapper">
          <svg
            className="search-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          {search && (
            <button className="clear-button" onClick={() => setSearch('')}>
              &times;
            </button>
          )}
        </div>

        <div className="filters-wrapper">
          <div className="select-container">
            <label>Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="select-container">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <button className="refresh-button" onClick={fetchUsers} title="Refresh Directory">
            <svg
              className={`refresh-icon ${loading ? 'spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="main-content">
        {loading ? (
          /* Premium shimmer skeleton grid */
          <div className="users-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="user-card skeleton" key={i}>
                <div className="skeleton-avatar"></div>
                <div className="skeleton-line short"></div>
                <div className="skeleton-line long"></div>
                <div className="skeleton-line medium"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="error-card">
            <div className="error-icon-wrapper">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2>Unable to connect to service</h2>
            <p>
              We couldn't fetch the directory info from the NestJS backend at{' '}
              <code>localhost:3000</code>.
            </p>
            <div className="tips-box">
              <p className="tips-title">Quick Fix Checklist:</p>
              <ul>
                <li>Ensure NestJS backend is running: <code>npm run start:dev</code></li>
                <li>Verify port matches <code>3000</code></li>
                <li>Check backend CORS configurations in <code>main.ts</code></li>
              </ul>
            </div>
            <button className="retry-button" onClick={fetchUsers}>
              Retry Connection
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          /* Empty State */
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2>No team members found</h2>
            <p>We couldn't find any user matching your search or filters.</p>
            <button
              className="clear-filters-btn"
              onClick={() => {
                setSearch('');
                setRoleFilter('All');
                setStatusFilter('All');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          /* Premium Cards Grid */
          <div className="users-grid">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`user-card ${user.status.toLowerCase()} ${recentlyUpdated[user.id] ? 'pulse-update' : ''}`}
              >
                <div className="card-glow"></div>
                <div className="card-header">
                  <div className="avatar-container">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="user-avatar"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            user.name
                          )}&background=aa3bff&color=fff`;
                      }}
                    />
                    <span className={`status-indicator ${user.status.toLowerCase()}`}></span>
                  </div>
                  <span className={`status-pill ${user.status.toLowerCase()}`}>
                    {user.status}
                  </span>
                </div>

                <div className="card-body">
                  <h3 className="user-name">{user.name}</h3>
                  {/* user.role = chatbot persona / job title – unchanged */}
                  <p className="user-role">{user.role}</p>
                  <a href={`mailto:${user.email}`} className="user-email">
                    <svg
                      className="email-icon"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    {user.email}
                  </a>
                </div>

                <div className="card-footer">
                  <button className="action-button secondary">View Profile</button>
                  <button className="action-button primary" onClick={() => setActiveChatUser(user)}>
                    Message
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Chat Window widget – completely unchanged */}
      {activeChatUser && (
        <div className="chat-window">
          <div className="chat-window-header">
            <div className="chat-user-details">
              <div className="chat-avatar-wrapper">
                <img src={activeChatUser.avatar} alt={activeChatUser.name} className="chat-header-avatar" />
                <span className={`status-dot-mini ${activeChatUser.status.toLowerCase()}`}></span>
              </div>
              <div className="chat-text-details">
                <h4 className="chat-header-name">{activeChatUser.name}</h4>
                {/* activeChatUser.role = chatbot persona / job title */}
                <span className="chat-header-role">{activeChatUser.role}</span>
              </div>
            </div>
            <button className="close-chat-window-btn" onClick={() => setActiveChatUser(null)} title="Close Chat">
              &times;
            </button>
          </div>

          <div className="chat-messages-body">
            {(!messages[activeChatUser.id] || messages[activeChatUser.id].length === 0) && (
              <div className="chat-welcome-banner">
                <div className="chat-welcome-icon">💬</div>
                <p>This is the beginning of your chat history with <strong>{activeChatUser.name}</strong>.</p>
                <span className="chat-welcome-sub">Say hello! They will reply automatically.</span>
              </div>
            )}

            {messages[activeChatUser.id]?.map((msg, index) => (
              <div
                key={index}
                className={`chat-message-bubble-row ${msg.senderId === 'you' ? 'outgoing' : 'incoming'}`}
              >
                {msg.senderId !== 'you' && (
                  <img src={activeChatUser.avatar} alt={activeChatUser.name} className="chat-message-avatar" />
                )}
                <div className="chat-message-bubble">
                  <p className="chat-message-text">{msg.text}</p>
                  <span className="chat-message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {typingStatus[activeChatUser.id] && (
              <div className="chat-message-bubble-row incoming">
                <img src={activeChatUser.avatar} alt={activeChatUser.name} className="chat-message-avatar" />
                <div className="chat-message-bubble typing-bubble">
                  <div className="typing-dots-animation">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-window-footer" onSubmit={sendMessage}>
            <input
              type="text"
              placeholder={`Send message to ${activeChatUser.name.split(' ')[0]}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="chat-window-input"
            />
            <button type="submit" className="chat-window-send-btn" disabled={!inputText.trim()}>
              <svg viewBox="0 0 24 24" className="chat-send-icon" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      )}

      <footer className="app-footer-info">
        <p>Built with NestJS (port 3000) &amp; React (port 5173)</p>
      </footer>
    </div>
  );
}

// ─── Root component: authentication gate ─────────────────────────────────────

function App() {
  const { authStatus } = useAuth();

  if (authStatus === 'loading') {
    return <AppLoadingScreen />;
  }

  if (authStatus === 'unauthenticated') {
    return <LoginPage />;
  }

  // authStatus === 'authenticated'
  return <AppAuthenticated />;
}

export default App;
