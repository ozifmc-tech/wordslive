const Database = require('better-sqlite3');
const config = require('./config');

const db = new Database(config.DB_PATH);

// Optimize database for concurrent access & performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#4f46e5',
    bio TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    is_online INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL COLLATE NOCASE,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    verified INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message TEXT DEFAULT '',
    last_message_time INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
  CREATE INDEX IF NOT EXISTS idx_conv_users ON conversations(user1_id, user2_id);
  CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_msg_status ON messages(receiver_id, status);

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_key TEXT DEFAULT '',
    device_name TEXT NOT NULL,
    device_type TEXT DEFAULT 'browser',
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    login_count INTEGER DEFAULT 1,
    login_history TEXT DEFAULT '[]',
    created_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    revoked INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, revoked);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_id);
`);

// Safe migrations for Profile Password & Rich Media (Photos/Videos up to 200MB) & Avatar URL & Security Token Version & Sessions
try { db.exec("ALTER TABLE users ADD COLUMN password TEXT DEFAULT ''"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1"); } catch (_) {}
try { db.exec("ALTER TABLE messages ADD COLUMN media_url TEXT DEFAULT ''"); } catch (_) {}
try { db.exec("ALTER TABLE messages ADD COLUMN media_type TEXT DEFAULT ''"); } catch (_) {}
try { db.exec("ALTER TABLE messages ADD COLUMN media_source TEXT DEFAULT ''"); } catch (_) {}
try { db.exec("ALTER TABLE messages ADD COLUMN media_size INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE messages ADD COLUMN deleted_for_all INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE messages ADD COLUMN deleted_for_sender INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE messages ADD COLUMN deleted_for_receiver INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE sessions ADD COLUMN device_key TEXT DEFAULT ''"); } catch (_) {}
try { db.exec("ALTER TABLE sessions ADD COLUMN login_count INTEGER DEFAULT 1"); } catch (_) {}
try { db.exec("ALTER TABLE sessions ADD COLUMN login_history TEXT DEFAULT '[]'"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_dev_key ON sessions(user_id, device_key, revoked)"); } catch (_) {}

// One-time cleanup & consolidation of duplicate sessions for the same user on the same device
try {
  const allActive = db.prepare("SELECT * FROM sessions WHERE revoked = 0 ORDER BY user_id, created_at ASC").all();
  const seenMap = new Map();
  for (const s of allActive) {
    const key = `${s.user_id}_${s.device_name}_${s.ip_address}`;
    if (!seenMap.has(key)) {
      seenMap.set(key, s);
    } else {
      const primary = seenMap.get(key);
      let history = [];
      try { history = JSON.parse(primary.login_history || '[]'); } catch (_) {}
      history.push({ time: s.created_at, ip: s.ip_address });
      if (s.last_active_at && s.last_active_at !== s.created_at) {
        history.push({ time: s.last_active_at, ip: s.ip_address });
      }
      db.prepare("UPDATE sessions SET login_count = COALESCE(login_count, 1) + 1, login_history = ? WHERE id = ?")
        .run(JSON.stringify(history), primary.id);
      db.prepare("UPDATE sessions SET revoked = 1 WHERE id = ?").run(s.id);
    }
  }
} catch (_) {}

// Prepared statement helpers
const stmts = {
  // User queries
  getUserByEmail: db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)'),
  getUserByUsername: db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)'),
  getUserById: db.prepare('SELECT id, email, username, display_name, avatar_color, avatar_url, bio, password, token_version, created_at, last_seen, is_online FROM users WHERE id = ?'),
  incrementTokenVersion: db.prepare('UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?'),
  
  createUser: db.prepare(`
    INSERT INTO users (email, username, display_name, avatar_color, avatar_url, bio, created_at, last_seen, is_online)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `),

  updateUserStatus: db.prepare('UPDATE users SET is_online = ?, last_seen = ? WHERE id = ?'),
  
  updateUserProfile: db.prepare(`
    UPDATE users SET display_name = ?, bio = ?, avatar_color = ? WHERE id = ?
  `),

  updateUserProfileFull: db.prepare(`
    UPDATE users SET display_name = ?, bio = ?, avatar_color = ?, password = ? WHERE id = ?
  `),

  updateUserAvatar: db.prepare(`
    UPDATE users SET avatar_url = ? WHERE id = ?
  `),

  searchUsers: db.prepare(`
    SELECT id, email, username, display_name, avatar_color, avatar_url, bio, is_online, last_seen
    FROM users 
    WHERE (LOWER(username) LIKE LOWER(?) OR LOWER(display_name) LIKE LOWER(?))
      AND id != ?
    ORDER BY is_online DESC, last_seen DESC
    LIMIT 20
  `),

  // OTP queries
  getLatestOtp: db.prepare(`
    SELECT * FROM otp_codes 
    WHERE LOWER(email) = LOWER(?)
    ORDER BY id DESC LIMIT 1
  `),

  getLatestVerifiedOtp: db.prepare(`
    SELECT * FROM otp_codes 
    WHERE LOWER(email) = LOWER(?) AND verified = 1 
    ORDER BY id DESC LIMIT 1
  `),

  saveOtp: db.prepare(`
    INSERT INTO otp_codes (email, code, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `),

  incrementOtpAttempts: db.prepare(`
    UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?
  `),

  markOtpVerified: db.prepare(`
    UPDATE otp_codes SET verified = 1 WHERE id = ?
  `),

  // Conversation queries
  getConversationById: db.prepare('SELECT * FROM conversations WHERE id = ?'),
  
  findConversationBetween: db.prepare(`
    SELECT * FROM conversations 
    WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
  `),

  createConversation: db.prepare(`
    INSERT INTO conversations (id, user1_id, user2_id, last_message, last_message_time, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

  updateConversationLastMessage: db.prepare(`
    UPDATE conversations 
    SET last_message = ?, last_message_time = ? 
    WHERE id = ?
  `),

  getUserConversations: db.prepare(`
    SELECT 
      c.id, c.last_message, c.last_message_time,
      CASE WHEN c.user1_id = :userId THEN u2.id ELSE u1.id END as partner_id,
      CASE WHEN c.user1_id = :userId THEN u2.username ELSE u1.username END as partner_username,
      CASE WHEN c.user1_id = :userId THEN u2.display_name ELSE u1.display_name END as partner_display_name,
      CASE WHEN c.user1_id = :userId THEN u2.avatar_color ELSE u1.avatar_color END as partner_avatar_color,
      CASE WHEN c.user1_id = :userId THEN u2.avatar_url ELSE u1.avatar_url END as partner_avatar_url,
      CASE WHEN c.user1_id = :userId THEN u2.is_online ELSE u1.is_online END as partner_is_online,
      CASE WHEN c.user1_id = :userId THEN u2.last_seen ELSE u1.last_seen END as partner_last_seen,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.receiver_id = :userId AND m.status != 'read') as unread_count
    FROM conversations c
    JOIN users u1 ON c.user1_id = u1.id
    JOIN users u2 ON c.user2_id = u2.id
    WHERE c.user1_id = :userId OR c.user2_id = :userId
    ORDER BY c.last_message_time DESC
  `),

  // Message queries
  saveMessage: db.prepare(`
    INSERT INTO messages (conversation_id, sender_id, receiver_id, text, status, media_url, media_type, media_source, media_size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getMessageById: db.prepare(`
    SELECT 
      id, conversation_id as conversationId, sender_id as senderId, receiver_id as receiverId, 
      text, status, media_url as mediaUrl, media_type as mediaType, media_source as mediaSource, media_size as mediaSize, created_at as createdAt,
      deleted_for_all as deletedForAll, deleted_for_sender as deletedForSender, deleted_for_receiver as deletedForReceiver
    FROM messages WHERE id = ?
  `),

  getMessagesByConversation: db.prepare(`
    SELECT 
      id, conversation_id as conversationId, sender_id as senderId, receiver_id as receiverId, 
      text, status, media_url as mediaUrl, media_type as mediaType, media_source as mediaSource, media_size as mediaSize, created_at as createdAt 
    FROM messages 
    WHERE conversation_id = ? 
      AND COALESCE(deleted_for_all, 0) = 0
      AND NOT (sender_id = ? AND COALESCE(deleted_for_sender, 0) = 1)
      AND NOT (receiver_id = ? AND COALESCE(deleted_for_receiver, 0) = 1)
    ORDER BY created_at ASC
    LIMIT 300
  `),

  deleteMessageForAll: db.prepare(`
    UPDATE messages 
    SET deleted_for_all = 1, text = '', media_url = '', media_type = '', media_source = '', media_size = 0
    WHERE id = ?
  `),

  deleteMessageForSender: db.prepare(`
    UPDATE messages 
    SET deleted_for_sender = 1 
    WHERE id = ?
  `),

  deleteMessageForReceiver: db.prepare(`
    UPDATE messages 
    SET deleted_for_receiver = 1 
    WHERE id = ?
  `),

  getLatestMessageForConversation: db.prepare(`
    SELECT text, media_type as mediaType, media_source as mediaSource, created_at as createdAt 
    FROM messages 
    WHERE conversation_id = ? 
      AND COALESCE(deleted_for_all, 0) = 0
    ORDER BY created_at DESC 
    LIMIT 1
  `),

  markMessagesAsRead: db.prepare(`
    UPDATE messages 
    SET status = 'read' 
    WHERE conversation_id = ? AND receiver_id = ? AND status != 'read'
  `),

  deleteMessage: db.prepare('DELETE FROM messages WHERE id = ? AND sender_id = ?'),

  // Sessions queries (Device tracking & 7-day termination security)
  createSession: db.prepare(`
    INSERT INTO sessions (session_id, user_id, device_key, device_name, device_type, ip_address, user_agent, login_count, login_history, created_at, last_active_at, revoked)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0)
  `),

  findActiveSessionByDevice: db.prepare(`
    SELECT * FROM sessions 
    WHERE user_id = ? AND revoked = 0 
      AND (
        (device_key != '' AND device_key = ?) 
        OR (device_name = ? AND ip_address = ?)
      )
    ORDER BY created_at ASC 
    LIMIT 1
  `),

  recordSessionLogin: db.prepare(`
    UPDATE sessions 
    SET session_id = ?, device_key = ?, device_name = ?, device_type = ?, ip_address = ?, user_agent = ?, 
        login_count = COALESCE(login_count, 1) + 1, login_history = ?, last_active_at = ?
    WHERE id = ?
  `),

  getSessionById: db.prepare(`
    SELECT * FROM sessions WHERE session_id = ? AND revoked = 0
  `),

  getUserSessions: db.prepare(`
    SELECT id, session_id as sessionId, user_id as userId, device_key as deviceKey,
           device_name as deviceName, device_type as deviceType, ip_address as ipAddress, 
           user_agent as userAgent, login_count as loginCount, login_history as loginHistory,
           created_at as createdAt, last_active_at as lastActiveAt, revoked
    FROM sessions 
    WHERE user_id = ? AND revoked = 0 
    ORDER BY last_active_at DESC
  `),

  updateSessionActivity: db.prepare(`
    UPDATE sessions SET last_active_at = ?, ip_address = ? WHERE session_id = ?
  `),

  revokeSession: db.prepare(`
    UPDATE sessions SET revoked = 1 WHERE id = ? AND user_id = ?
  `),

  revokeSessionByToken: db.prepare(`
    UPDATE sessions SET revoked = 1 WHERE session_id = ?
  `),

  revokeAllOtherSessions: db.prepare(`
    UPDATE sessions SET revoked = 1 WHERE user_id = ? AND session_id != ?
  `),

  getSessionByPkAndUser: db.prepare(`
    SELECT * FROM sessions WHERE id = ? AND user_id = ?
  `)
};

module.exports = {
  db,
  stmts,

  // Helper function to generate standard conversation ID
  getConversationId(userId1, userId2) {
    const min = Math.min(userId1, userId2);
    const max = Math.max(userId1, userId2);
    return `c_${min}_${max}`;
  }
};
