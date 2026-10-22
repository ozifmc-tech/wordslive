const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const { Server } = require('socket.io');

const config = require('./config');
const { 
  authMiddleware, 
  sendOtp, 
  verifyOtp, 
  registerProfile, 
  checkUsername, 
  getMe, 
  updateProfile, 
  loginWithPassword, 
  registerWithPassword,
  uploadAvatar,
  getSessions,
  terminateSession,
  terminateAllOtherSessions
} = require('./authController');

const { 
  searchUsers, 
  getConversations, 
  getOrCreateConversation, 
  getMessages, 
  sendMessageHttp,
  deleteMessage
} = require('./chatController');

const { setupSocketIO } = require('./socketHandler');
const { searchDictionary, dictionaryWords } = require('./dictionaryData');
const { 
  securityHeadersMiddleware, 
  wafMiddleware,
  loginRateLimiter, 
  otpRequestLimiter, 
  apiGeneralLimiter, 
  isAllowedFileExtension,
  inspectFileSafety
} = require('./security');

const app = express();
const server = http.createServer(app);

// Ensure uploads directory exists on any host
const fs = require('fs');
const uploadsDirectory = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}

// Configure multer storage for media uploads (Photos, videos & voice notes up to 200MB)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDirectory);
  },
  filename: function (req, file, cb) {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const safeName = Date.now() + '_' + Math.random().toString(36).substring(2, 9) + ext;
    cb(null, safeName);
  }
});

// File filter: Block all dangerous executables/scripts
const fileFilter = (req, file, cb) => {
  if (isAllowedFileExtension(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error("Xavfsizlik taqiqlaydi: Faqat rasm, video, audio va xavfsiz hujjat fayllari qabul qilinadi (.exe, .bat, .sh kabi dasturlar taqiqlangan)!"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 } // 200 MB limit
});

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Setup real-time messaging
setupSocketIO(io);
app.set('io', io);

// Security Middlewares
app.disable('x-powered-by');
app.use(securityHeadersMiddleware);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(wafMiddleware);
app.use('/api', apiGeneralLimiter);

// Serve frontend static files & uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));
app.use(express.static(path.join(__dirname, '../public')));

// -------------------------------------------------------------
// DICTIONARY PUBLIC ROUTES
// -------------------------------------------------------------
app.get('/api/dictionary/search', async (req, res) => {
  try {
    const { q } = req.query;
    const results = await searchDictionary(q);
    res.json({ success: true, count: results.length, words: results });
  } catch (err) {
    res.status(500).json({ success: false, words: [] });
  }
});

app.get('/api/dictionary/all', (req, res) => {
  res.json({ success: true, count: dictionaryWords.length, words: dictionaryWords });
});

// -------------------------------------------------------------
// AUTHENTICATION & GMAIL OTP ROUTES
// -------------------------------------------------------------
app.post('/api/auth/send-otp', otpRequestLimiter, sendOtp);
app.post('/api/auth/verify-otp', verifyOtp);
app.post('/api/auth/register-profile', registerProfile);
app.post('/api/auth/complete-profile', registerProfile); // Alias for mobile app
app.get('/api/auth/check-username', checkUsername);
app.get('/api/users/check-username', checkUsername); // Alias
app.get('/api/auth/me', authMiddleware, getMe);
app.get('/api/users/me', authMiddleware, getMe); // Alias
app.put('/api/auth/profile', authMiddleware, updateProfile);
app.post('/api/auth/update-profile', authMiddleware, updateProfile);
app.post('/api/auth/upload-avatar', authMiddleware, upload.single('avatar'), uploadAvatar);
app.post('/api/auth/login-with-password', loginRateLimiter, loginWithPassword);
app.post('/api/auth/register-with-password', loginRateLimiter, registerWithPassword);

// Active Devices & Telegram-Style 7-Day Session Security
app.get('/api/auth/sessions', authMiddleware, getSessions);
app.post('/api/auth/sessions/terminate/:id', authMiddleware, terminateSession);
app.post('/api/auth/sessions/terminate-all', authMiddleware, terminateAllOtherSessions);

// -------------------------------------------------------------
// CHAT & MESSAGING ROUTES (PROTECTED)
// -------------------------------------------------------------
app.get('/api/chat/search-users', authMiddleware, searchUsers);
app.get('/api/users/search', authMiddleware, searchUsers); // Alias
app.get('/api/chat/conversations', authMiddleware, getConversations);
app.post('/api/chat/conversations', authMiddleware, getOrCreateConversation);
app.get('/api/chat/conversations/:conversationId/messages', authMiddleware, getMessages);
app.get('/api/chat/messages/:conversationId', authMiddleware, getMessages); // Alias
app.post('/api/chat/conversations/:conversationId/messages', authMiddleware, sendMessageHttp);
app.delete('/api/chat/messages/:messageId', authMiddleware, deleteMessage);

// Secure File Download Endpoint (Forces nosniff, sandboxing and safe filename)
app.get('/api/chat/download/:filename', authMiddleware, (req, res) => {
  try {
    const filename = req.params.filename;
    const fs = require('fs');

    // Strict validation prevents path traversal attacks
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(filename)) {
      return res.status(400).json({ success: false, message: 'Yaroqsiz fayl nomi' });
    }

    const safePath = path.join(__dirname, '../public/uploads', filename);
    const uploadsDir = path.join(__dirname, '../public/uploads');

    if (!safePath.startsWith(uploadsDir) || !fs.existsSync(safePath)) {
      return res.status(404).json({ success: false, message: 'Fayl topilmadi' });
    }

    const originalName = req.query.name || filename;
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    return res.sendFile(safePath);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Faylni yuklab olishda xatolik' });
  }
});

// Rich media & Document upload (Photos, Videos, Audio & Documents up to 200MB with deep security inspection)
app.post('/api/chat/upload', authMiddleware, upload.single('media'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fayl tanlanmadi' });
    }

    // Deep binary & extension security inspection
    const safety = inspectFileSafety(req.file.path, req.file.originalname);
    if (!safety.safe) {
      const fs = require('fs');
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({
        success: false,
        message: safety.reason || 'Fayl xavfsizlik talablariga javob bermadi'
      });
    }

    const mediaUrl = `/uploads/${req.file.filename}`;
    const mime = (req.file.mimetype || '').toLowerCase();
    const ext = (path.extname(req.file.originalname || req.file.filename) || '').toLowerCase().replace('.', '');
    const clientType = req.body.mediaType || '';
    let mediaSource = req.body.source || 'gallery';
    let mediaType = 'image';

    // Robust type detection supporting all documents, videos, audio and images
    const videoExts = ['mp4', 'webm', 'mov', 'mkv', 'avi', '3gp', 'm4v', 'ts', 'flv'];
    const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'flac'];
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico'];

    if (
      clientType === 'file' ||
      (!videoExts.includes(ext) && !audioExts.includes(ext) && !imageExts.includes(ext))
    ) {
      mediaType = 'file';
      mediaSource = req.body.source || 'file';
    } else if (
      clientType === 'video' ||
      mime.startsWith('video') ||
      videoExts.includes(ext)
    ) {
      mediaType = 'video';
    } else if (
      clientType === 'audio' ||
      req.body.source === 'voice' ||
      mime.startsWith('audio') ||
      audioExts.includes(ext)
    ) {
      mediaType = 'audio';
      mediaSource = 'voice';
    } else {
      mediaType = 'image';
    }

    return res.json({
      success: true,
      mediaUrl,
      mediaType,
      mediaSource,
      mediaSize: req.file.size,
      originalName: req.file.originalname
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ success: false, message: 'Fayl yuklashda xatolik yuz berdi' });
  }
});

// Health check for Cloud Hosting Keep-Alive & Monitoring
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'WordsLive',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now()
  });
});

// Dictionary extras
app.get('/api/dictionary/word-of-the-day', (req, res) => {
  const word = dictionaryWords.find(w => w.word === 'wisdom') || dictionaryWords[0];
  res.json({ success: true, word });
});

// Error handling for Multer and file upload rejections
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Fayl hajmi juda katta (maksimal 200MB)' });
    }
    return res.status(400).json({ success: false, message: `Fayl yuklashda xatolik: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message || 'Xavfsizlik tekshiruvidan o\'tmadi' });
  }
  next();
});

// Single Page Application (SPA) catch-all
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
if (require.main === module) {
  server.listen(config.PORT, '0.0.0.0', () => {
    const os = require('os');
    let localIp = 'localhost';
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal && !name.includes('vEthernet') && !net.address.startsWith('169.254')) {
          localIp = net.address;
          break;
        }
      }
    }
    console.log(`\n========================================================`);
    console.log(`🚀 WordsLive Server ishga tushdi!`);
    console.log(`📍 Mahalliy manzil: http://localhost:${config.PORT}`);
    console.log(`📱 Wi-Fi orqali telefon uchun: http://${localIp}:${config.PORT}`);
    console.log(`========================================================\n`);

    // Automatic Keep-Alive for Free Cloud Hosting (Render / Koyeb / Always-On)
    const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || process.env.KEEP_ALIVE_URL;
    if (keepAliveUrl) {
      const pingUrl = keepAliveUrl.replace(/\/+$/, '') + '/api/health';
      console.log(`[KEEP-ALIVE] Faollashtirildi: ${pingUrl} (Har 10 daqiqada uyg'otib turiladi)`);
      const client = keepAliveUrl.startsWith('https') ? require('https') : require('http');
      setInterval(() => {
        try {
          client.get(pingUrl, (r) => {
            console.log(`[KEEP-ALIVE PING] Status: ${r.statusCode}`);
          }).on('error', () => {});
        } catch (_) {}
      }, 10 * 60 * 1000); // 10 daqiqa
    }
  });
}

module.exports = { app, server, io };
