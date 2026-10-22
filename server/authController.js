const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { stmts } = require('./db');
const { sendOtpEmail } = require('./emailService');
const { hashPassword, verifyPassword } = require('./security');

const AVATAR_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c', 
  '#059669', '#0891b2', '#4f46e5', '#d97706', '#0284c7'
];

function getRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function parseDevice(userAgent) {
  const ua = userAgent || '';
  let deviceName = 'Noma\'lum qurilma';
  let deviceType = 'browser';

  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isWindows = /Windows NT/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

  let os = '';
  if (isAndroid) {
    deviceType = 'mobile';
    const match = ua.match(/Android\s+([0-9\.]+)/i);
    const modelMatch = ua.match(/;\s*([^;]+?)\s+Build/i);
    const model = modelMatch ? modelMatch[1].trim() : 'Android';
    os = `${model} (Android ${match ? match[1] : ''})`.trim();
  } else if (isIOS) {
    deviceType = /iPad/i.test(ua) ? 'tablet' : 'mobile';
    const match = ua.match(/OS\s+([0-9_]+)/i);
    os = `Apple iPhone (iOS ${match ? match[1].replace(/_/g, '.') : ''})`.trim();
  } else if (isWindows) {
    deviceType = 'desktop';
    if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
    else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
    else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
    else os = 'Windows PC';
  } else if (isMac) {
    deviceType = 'desktop';
    os = 'macOS';
  } else if (isLinux) {
    deviceType = 'desktop';
    os = 'Linux';
  }

  let browser = 'Brauzer';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua) && !/OPR/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/OPR/i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';

  if (os) {
    deviceName = `${browser} · ${os}`;
  } else {
    deviceName = browser;
  }

  return { deviceName, deviceType };
}

function getIpAddress(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '';
}

function issueTokenWithSession(user, req) {
  const sessionId = crypto.randomUUID();
  const ip = getIpAddress(req);
  const ua = req.headers['user-agent'] || '';
  const { deviceName, deviceType } = parseDevice(ua);
  const clientDeviceKey = req.headers['x-device-id'] || req.body?.deviceId || '';
  const now = Date.now();

  // Check if an active session already exists for this same device (same deviceKey or same deviceName + IP)
  const existing = stmts.findActiveSessionByDevice.get(user.id, clientDeviceKey, deviceName, ip);

  if (existing) {
    // SAME DEVICE! Deduplicate and append to login history
    let history = [];
    try {
      history = JSON.parse(existing.login_history || '[]');
    } catch (_) {}

    history.unshift({ time: now, ip, device: deviceName });
    if (history.length > 30) history = history.slice(0, 30); // Keep last 30 logins

    stmts.recordSessionLogin.run(
      sessionId,
      clientDeviceKey || existing.device_key || '',
      deviceName,
      deviceType,
      ip,
      ua,
      JSON.stringify(history),
      now,
      existing.id
    );
  } else {
    // Brand new device
    const initialHistory = JSON.stringify([{ time: now, ip, device: deviceName }]);
    stmts.createSession.run(
      sessionId,
      user.id,
      clientDeviceKey,
      deviceName,
      deviceType,
      ip,
      ua,
      initialHistory,
      now,
      now
    );
  }

  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      username: user.username, 
      tokenVersion: user.token_version || 1,
      sessionId 
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  return token;
}

// Authentication middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Kirish taqiqlangan: Token mavjud emas' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = stmts.getUserById.get(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Foydalanuvchi topilmadi' });
    }
    // Invalidate stolen or old tokens when password is changed / token revoked
    if (decoded.tokenVersion !== undefined && user.token_version !== undefined && decoded.tokenVersion !== user.token_version) {
      return res.status(401).json({ 
        success: false, 
        message: 'Xavfsizlik: Parol o\'zgargan yoki sessiya bekor qilingan. Iltimos, qayta kiring.' 
      });
    }

    const ip = getIpAddress(req);
    const ua = req.headers['user-agent'] || '';

    // Check device session in DB
    if (decoded.sessionId) {
      const session = stmts.getSessionById.get(decoded.sessionId);
      if (!session || session.revoked === 1) {
        return res.status(401).json({
          success: false,
          code: 'SESSION_REVOKED',
          message: 'Ushbu qurilma sessiyasi tugatilgan. Iltimos, qaytadan kiring.'
        });
      }
      stmts.updateSessionActivity.run(Date.now(), ip, decoded.sessionId);
      req.session = session;
    } else {
      // Auto-migrate legacy tokens without sessionId
      const newSessionId = crypto.randomUUID();
      const { deviceName, deviceType } = parseDevice(ua);
      const createdAt = user.created_at || Date.now();
      stmts.createSession.run(newSessionId, user.id, deviceName, deviceType, ip, ua, createdAt, Date.now());
      req.session = {
        session_id: newSessionId,
        created_at: createdAt,
        device_name: deviceName,
        device_type: deviceType,
        ip_address: ip
      };
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Yaroqsiz yoki eskirgan sessiya' });
  }
}

// 1. Send OTP to Gmail
async function sendOtp(req, res) {
  try {
    let { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Iltimos, to\'g\'ri Gmail manzilini kiriting' });
    }

    email = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Email formati noto\'g\'ri' });
    }

    // Check cooldown from previous request
    const existingOtp = stmts.getLatestOtp.get(email);
    if (existingOtp) {
      const timeSince = Date.now() - existingOtp.created_at;
      if (timeSince < config.OTP_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((config.OTP_COOLDOWN_MS - timeSince) / 1000);
        return res.status(429).json({
          success: false,
          message: `Iltimos, yangi kod so'rashdan oldin ${remainingSeconds} soniya kuting.`
        });
      }
    }

    // Generate 6-digit numeric OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + config.OTP_EXPIRES_MS;
    const createdAt = Date.now();

    // Store in database
    stmts.saveOtp.run(email, code, expiresAt, createdAt);

    // Send via email service
    const emailResult = await sendOtpEmail(email, code);

    if (!emailResult.sent) {
      return res.status(500).json({
        success: false,
        message: emailResult.message || 'Gmail orqali tasdiqlash kodini yuborishda xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.'
      });
    }

    const existingUser = stmts.getUserByEmail.get(email);

    return res.json({
      success: true,
      message: 'Tasdiqlash kodi Gmailingizga muvaffaqiyatli yuborildi!',
      isExistingUser: !!existingUser
    });
  } catch (err) {
    console.error('Send OTP xatolik:', err);
    return res.status(500).json({ success: false, message: 'Serverda xatolik yuz berdi' });
  }
}

// 2. Verify OTP
async function verifyOtp(req, res) {
  try {
    let { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email va 6 xonali kod kiritilishi shart' });
    }

    email = email.trim().toLowerCase();
    // Strip any accidental non-digits (spaces, dashes, G- prefix, etc.)
    code = String(code).replace(/[^0-9]/g, '').trim();

    const now = Date.now();

    // Check if there is ANY valid unexpired OTP matching this code for this email (handles multiple sent emails)
    let matchedOtp = null;
    try {
      matchedOtp = stmts.findValidOtpByCode.get(email, code, now);
    } catch (_) {}

    const otp = matchedOtp || stmts.getLatestOtp.get(email);

    if (!otp) {
      return res.status(400).json({ success: false, message: 'Tasdiqlash kodi topilmadi yoki eskirgan. Qaytadan so\'rang.' });
    }

    if (otp.attempts >= 10) {
      return res.status(400).json({ success: false, message: 'Urinishlar soni tugadi. Iltimos, yangi kod so\'rang.' });
    }

    if (now > otp.expires_at) {
      return res.status(400).json({ success: false, message: 'Kodning amal qilish muddati tugagan (10 daqiqa o\'tdi).' });
    }

    if (otp.code !== code) {
      stmts.incrementOtpAttempts.run(otp.id);
      const remainingAttempts = Math.max(0, 10 - (otp.attempts + 1));
      return res.status(400).json({ 
        success: false, 
        message: `Noto'g'ri kod kiritildi. Qolgan urinishlar: ${remainingAttempts} ta.` 
      });
    }

    // Mark as verified
    stmts.markOtpVerified.run(otp.id);

    // Check if account already exists
    const user = stmts.getUserByEmail.get(email);
    if (user) {
      const token = issueTokenWithSession(user, req);

      return res.json({
        success: true,
        isNewUser: false,
        message: 'Tizimga muvaffaqiyatli kirildi!',
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.display_name,
          avatarColor: user.avatar_color,
          avatarUrl: user.avatar_url || '',
          bio: user.bio,
          hasPassword: Boolean(user.password && user.password.length > 0)
        }
      });
    }

    // Brand new user needs to pick username and display name
    return res.json({
      success: true,
      isNewUser: true,
      email,
      message: 'Gmail tasdiqlandi! Endi ism va noyob nik tanlang.'
    });

  } catch (err) {
    console.error('Verify OTP xatolik:', err);
    return res.status(500).json({ success: false, message: 'Serverda xatolik yuz berdi' });
  }
}

// 3. Register profile (Username & Name)
async function registerProfile(req, res) {
  try {
    let { email, username, displayName, bio } = req.body;
    if (!email || !username || !displayName) {
      return res.status(400).json({ success: false, message: 'Email, ism va nik kiritilishi shart' });
    }

    email = email.trim().toLowerCase();
    username = username.trim().toLowerCase().replace(/^@/, '');
    displayName = displayName.trim();
    bio = (bio || '').trim();

    // Check if email was verified
    const verifiedOtp = stmts.getLatestVerifiedOtp.get(email);
    if (!verifiedOtp || (Date.now() - verifiedOtp.created_at > 30 * 60 * 1000)) {
      return res.status(403).json({ success: false, message: 'Avval emailingizni tasdiqlang!' });
    }

    // Check if already registered
    const existingEmail = stmts.getUserByEmail.get(email);
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'Bu email bilan allaqachon akkaunt ochilgan' });
    }

    // Validate display name
    if (displayName.length < 2 || displayName.length > 50) {
      return res.status(400).json({ success: false, message: 'Ism 2 tadan 50 tagacha belgidan iborat bo\'lishi kerak' });
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,25}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Nik faqat lotin harflari, raqamlar va pastki chiziqdan iborat bo\'lishi kerak (3-25 belgi)'
      });
    }

    // Check username uniqueness
    const existingUser = stmts.getUserByUsername.get(username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `Ushbu nik (@${username}) allaqachon band. Iltimos, boshqa nik tanlang.`
      });
    }

    const now = Date.now();
    const avatarColor = getRandomColor();

    const insertResult = stmts.createUser.run(
      email,
      username,
      displayName,
      avatarColor,
      '',
      bio,
      now,
      now
    );

    const newUser = stmts.getUserById.get(insertResult.lastInsertRowid);

    const token = issueTokenWithSession(newUser, req);

    return res.status(201).json({
      success: true,
      message: 'Profil muvaffaqiyatli yaratildi!',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        displayName: newUser.display_name,
        avatarColor: newUser.avatar_color,
        avatarUrl: newUser.avatar_url || '',
        bio: newUser.bio,
        hasPassword: false,
        password: ''
      }
    });

  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed: users.username')) {
      return res.status(409).json({
        success: false,
        message: 'Bu nik allaqachon boshqa foydalanuvchi tomonidan band qilingan'
      });
    }
    console.error('Register profile xatolik:', err);
    return res.status(500).json({ success: false, message: 'Serverda xatolik yuz berdi' });
  }
}

// 4. Real-time Check Username Availability
function checkUsername(req, res) {
  try {
    let { username } = req.query;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Nik kiritilmadi' });
    }

    username = username.trim().toLowerCase().replace(/^@/, '');
    const usernameRegex = /^[a-zA-Z0-9_]{3,25}$/;
    if (!usernameRegex.test(username)) {
      return res.json({
        available: false,
        message: 'Nik 3-25 ta lotin harflari, raqam yoki pastki chiziqdan iborat bo\'lishi shart'
      });
    }

    const existing = stmts.getUserByUsername.get(username);
    if (existing) {
      return res.json({
        available: false,
        message: `@${username} allaqachon band!`
      });
    }

    return res.json({
      available: true,
      message: `@${username} bo'sh va foydalanish mumkin!`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Serverda xatolik' });
  }
}

// 5. Get current profile (Me)
function getMe(req, res) {
  const user = req.user;
  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      avatarColor: user.avatar_color,
      avatarUrl: user.avatar_url || '',
      bio: user.bio,
      isOnline: user.is_online,
      lastSeen: user.last_seen,
      hasPassword: Boolean(user.password && user.password.length > 0)
    }
  });
}

// 6. Update Profile & Password
function updateProfile(req, res) {
  try {
    const user = req.user;
    let { displayName, bio, avatarColor, password } = req.body;

    displayName = (displayName || user.display_name).trim();
    bio = (bio !== undefined ? bio : user.bio).trim();
    avatarColor = avatarColor || user.avatar_color;

    // Securely hash password if provided
    let newPasswordHash = user.password || '';
    let passwordChanged = false;
    if (password !== undefined && String(password).trim().length > 0) {
      newPasswordHash = hashPassword(String(password).trim());
      passwordChanged = true;
    }

    if (displayName.length < 2 || displayName.length > 50) {
      return res.status(400).json({ success: false, message: 'Ism 2 tadan 50 tagacha belgidan iborat bo\'lishi kerak' });
    }

    stmts.updateUserProfileFull.run(displayName, bio, avatarColor, newPasswordHash, user.id);
    
    // Revoke previous sessions on password change
    if (passwordChanged) {
      stmts.incrementTokenVersion.run(user.id);
    }
    const updated = stmts.getUserById.get(user.id);

    let newToken = undefined;
    if (passwordChanged) {
      newToken = jwt.sign(
        { userId: updated.id, email: updated.email, username: updated.username, tokenVersion: updated.token_version || 1 },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );
    }

    return res.json({
      success: true,
      message: 'Profil va xavfsizlik sozlamalari muvaffaqiyatli saqlandi!',
      token: newToken,
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        displayName: updated.display_name,
        avatarColor: updated.avatar_color,
        avatarUrl: updated.avatar_url || '',
        bio: updated.bio,
        hasPassword: Boolean(newPasswordHash && newPasswordHash.length > 0)
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
}

// 7. Login with @username + Password (Fast Alternative Login with Timing-Safe Verification)
function loginWithPassword(req, res) {
  try {
    let { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Nik va parol kiritilishi shart' });
    }

    username = username.trim().toLowerCase().replace(/^@/, '');
    const user = stmts.getUserByUsername.get(username);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Bunday nikdagi foydalanuvchi topilmadi' });
    }

    if (!user.password || user.password.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Ushbu profilga hali parol o\'rnatilmagan. Iltimos, avval Gmail orqali kiring va profil sozlamalarida parol o\'rnating.'
      });
    }

    // Cryptographic constant-time password verification
    if (!verifyPassword(password.trim(), user.password)) {
      return res.status(401).json({ success: false, message: 'Noto\'g\'ri parol kiritildi!' });
    }

    const token = issueTokenWithSession(user, req);

    return res.json({
      success: true,
      message: 'Xush kelibsiz!',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatarColor: user.avatar_color,
        avatarUrl: user.avatar_url || '',
        bio: user.bio,
        hasPassword: true
      }
    });
  } catch (err) {
    console.error('Login with password error:', err);
    return res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
}

// 8. Upload Profile Avatar Picture
function uploadAvatar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Rasm tanlanmadi' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    stmts.updateUserAvatar.run(avatarUrl, req.user.id);
    const updatedUser = stmts.getUserById.get(req.user.id);

    return res.json({
      success: true,
      message: 'Profil rasmi muvaffaqiyatli o\'rnatildi!',
      avatarUrl,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        displayName: updatedUser.display_name,
        avatarColor: updatedUser.avatar_color,
        avatarUrl: updatedUser.avatar_url || avatarUrl,
        bio: updatedUser.bio,
        hasPassword: Boolean(updatedUser.password && updatedUser.password.length > 0),
        password: updatedUser.password || ''
      }
    });
  } catch (err) {
    console.error('Avatar upload error:', err);
    return res.status(500).json({ success: false, message: 'Rasm yuklashda xatolik yuz berdi' });
  }
}

// 9. Get all active sessions for current user
function getSessions(req, res) {
  try {
    const userId = req.user.id;
    const currentSessionId = req.session ? req.session.session_id : '';
    const rawSessions = stmts.getUserSessions.all(userId);

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const currentSessionAgeMs = req.session ? (Date.now() - req.session.created_at) : 0;
    const canTerminateOthers = currentSessionAgeMs >= SEVEN_DAYS_MS;
    const remainingToTerminateMs = Math.max(0, SEVEN_DAYS_MS - currentSessionAgeMs);

    const days = Math.floor(remainingToTerminateMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remainingToTerminateMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const waitTimeText = days > 0 ? `${days} kun ${hours} soat` : `${hours} soat`;

    const sessions = rawSessions.map(s => {
      let history = [];
      try {
        history = JSON.parse(s.loginHistory || '[]');
      } catch (_) {}

      if (history.length === 0) {
        history.push({ time: s.lastActiveAt || s.createdAt, ip: s.ipAddress, device: s.deviceName });
        if (s.createdAt && s.createdAt !== s.lastActiveAt) {
          history.push({ time: s.createdAt, ip: s.ipAddress, device: s.deviceName });
        }
      }

      return {
        id: s.id,
        deviceName: s.deviceName,
        deviceType: s.deviceType,
        ipAddress: s.ipAddress,
        loginCount: s.loginCount || Math.max(1, history.length),
        loginHistory: history,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        isCurrent: s.sessionId === currentSessionId
      };
    });

    return res.json({
      success: true,
      sessions,
      canTerminateOthers,
      remainingTimeToTerminate: waitTimeText,
      remainingDays: days,
      remainingHours: hours
    });
  } catch (err) {
    console.error('Get sessions error:', err);
    return res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
}

// 10. Terminate a specific session (Requires 7-day active tenure)
function terminateSession(req, res) {
  try {
    const sessionIdToTerminate = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (!sessionIdToTerminate || isNaN(sessionIdToTerminate)) {
      return res.status(400).json({ success: false, message: 'Noto\'g\'ri sessiya identifikatori' });
    }

    // Enforce 7-day security rule for current session
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const currentSessionAgeMs = req.session ? (Date.now() - req.session.created_at) : 0;

    if (currentSessionAgeMs < SEVEN_DAYS_MS) {
      const remainingMs = SEVEN_DAYS_MS - currentSessionAgeMs;
      const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const timeText = days > 0 ? `${days} kun ${hours} soat` : `${hours} soat`;

      return res.status(403).json({
        success: false,
        code: 'DEVICE_TOO_NEW',
        message: `Xavfsizlik qoidasi: Yangi ulangan qurilma boshqa sessiyalarni chiqarib yuborishi uchun kamida 7 kun faol turishi shart. Qolgan vaqt: ${timeText}`
      });
    }

    const target = stmts.getSessionByPkAndUser.get(sessionIdToTerminate, userId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Sessiya topilmadi' });
    }

    if (req.session && target.session_id === req.session.session_id) {
      return res.status(400).json({ success: false, message: 'Joriy qurilmani bu yerdan chiqarib bo\'lmaydi. Chiqish tugmasidan foydalaning.' });
    }

    stmts.revokeSession.run(sessionIdToTerminate, userId);

    // Notify target device via Socket.io to disconnect immediately
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('session_revoked', { sessionId: target.session_id, id: target.id });
    }

    return res.json({ success: true, message: 'Qurilma sessiyasi muvaffaqiyatli tugatildi!' });
  } catch (err) {
    console.error('Terminate session error:', err);
    return res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
}

// 11. Terminate all other sessions except current (Requires 7-day active tenure)
function terminateAllOtherSessions(req, res) {
  try {
    const userId = req.user.id;
    const currentSession = req.session;

    if (!currentSession) {
      return res.status(400).json({ success: false, message: 'Joriy sessiya ma\'lumoti topilmadi' });
    }

    // Enforce 7-day security rule
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const currentSessionAgeMs = Date.now() - currentSession.created_at;

    if (currentSessionAgeMs < SEVEN_DAYS_MS) {
      const remainingMs = SEVEN_DAYS_MS - currentSessionAgeMs;
      const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const timeText = days > 0 ? `${days} kun ${hours} soat` : `${hours} soat`;

      return res.status(403).json({
        success: false,
        code: 'DEVICE_TOO_NEW',
        message: `Xavfsizlik qoidasi: Yangi ulangan qurilma boshqa sessiyalarni chiqarib yuborishi uchun kamida 7 kun faol turishi shart. Qolgan vaqt: ${timeText}`
      });
    }

    stmts.revokeAllOtherSessions.run(userId, currentSession.session_id);

    // Notify all other sockets to disconnect immediately
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('all_other_sessions_revoked', { exceptSessionId: currentSession.session_id });
    }

    return res.json({ success: true, message: 'Barcha boshqa qurilmalar muvaffaqiyatli chiqarildi!' });
  } catch (err) {
    console.error('Terminate all other sessions error:', err);
    return res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
}

module.exports = {
  authMiddleware,
  sendOtp,
  verifyOtp,
  registerProfile,
  checkUsername,
  getMe,
  updateProfile,
  loginWithPassword,
  uploadAvatar,
  getSessions,
  terminateSession,
  terminateAllOtherSessions
};
