const crypto = require('crypto');

// -------------------------------------------------------------
// 1. CRYPTOGRAPHIC PASSWORD HASHING (SCRYPT + TIMING SAFE EQUAL)
// -------------------------------------------------------------

function hashPassword(password) {
  if (!password || typeof password !== 'string') return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password.trim(), salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof password !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  // Scrypt hash format: salt:derivedKey
  if (storedHash.includes(':')) {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, key] = parts;
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const derivedKey = crypto.scryptSync(password.trim(), salt, 64);
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    } catch (_) {
      return false;
    }
  }

  // Constant-time fallback for legacy plain text
  try {
    const bufA = Buffer.from(password.trim());
    const bufB = Buffer.from(storedHash.trim());
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (_) {
    return false;
  }
}

// -------------------------------------------------------------
// 2. WEB APPLICATION FIREWALL (WAF) & ACTIVE THREAT JAIL
// Automatically bans IPs probing for vulnerabilities for 24 hours
// -------------------------------------------------------------

const bannedIPs = new Map(); // ip -> unbanTimestamp

function getClientIP(req) {
  return req.headers['cf-connecting-ip'] || 
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.socket.remoteAddress || 'unknown';
}

function isLoopback(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
}

// Malicious attack patterns
const ATTACK_PATTERNS = [
  /(\.\.[\/\\]|%2e%2e[\/\\]|\/etc\/passwd|win\.ini)/i,               // Path traversal
  /\b(union\s+select|select.*from.*information_schema|insert\s+into.*values|drop\s+table|alter\s+table)\b/i, // SQL injection
  /(<script\b|javascript:|vbscript:|onload\s*=|onerror\s*=|document\.cookie)/i, // XSS
  /\b(benchmark\(|sleep\(|waitfor\s+delay|pg_sleep)\b/i,             // Blind SQL injection
  /\b(eval\(|base64_decode|system\(|passthru\(|exec\(|popen\()\b/i    // Remote Code Execution
];

// Malicious scan paths from automated hacker bots
const SCAN_PROBES = [
  '/.env', '/.git', '/wp-admin', '/wp-login.php', '/phpmyadmin', 
  '/admin.php', '/setup.php', '/xmlrpc.php', '/telescope', '/actuator',
  '/swagger', '/api/v1/cmd', '/shell', '/config.json', '/server-status'
];

function wafMiddleware(req, res, next) {
  const ip = getClientIP(req);
  const now = Date.now();

  // 1. Check if IP is currently banned (exempt loopback)
  if (!isLoopback(ip)) {
    const banExpiry = bannedIPs.get(ip);
    if (banExpiry && now < banExpiry) {
      const remainingHours = Math.ceil((banExpiry - now) / 3600000);
      return res.status(403).json({
        error: 'Access Denied',
        message: `Xavfsizlik tizimi: Ushbu qurilma shubhali xakerlik harakatlari uchun ${remainingHours} soatga bloklangan.`
      });
    } else if (banExpiry && now >= banExpiry) {
      bannedIPs.delete(ip);
    }
  }

  // 2. Check for bot scanner probes
  const rawUrl = (req.originalUrl || req.url || '').toLowerCase();
  for (const probe of SCAN_PROBES) {
    if (rawUrl.includes(probe)) {
      if (!isLoopback(ip)) bannedIPs.set(ip, now + 24 * 3600 * 1000); // 24-hour instant ban for external attacker
      console.warn(`🚨 [WAF FIREWALL] MALICIOUS SCAN BLOCKED & IP BANNED: ${ip} on ${rawUrl}`);
      return res.status(403).send('Forbidden: Malicious Probe Detected and IP Banned.');
    }
  }

  // 3. Inspect Query & Body against injection payloads
  const checkString = (str) => {
    if (!str || typeof str !== 'string') return false;
    for (const pattern of ATTACK_PATTERNS) {
      if (pattern.test(str)) return true;
    }
    return false;
  };

  const inspectObject = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    for (const key of Object.keys(obj)) {
      if (checkString(key)) return true;
      const val = obj[key];
      if (typeof val === 'string' && checkString(val)) return true;
      if (typeof val === 'object' && inspectObject(val)) return true;
    }
    return false;
  };

  if (inspectObject(req.query) || inspectObject(req.body)) {
    if (!isLoopback(ip)) bannedIPs.set(ip, now + 24 * 3600 * 1000);
    console.warn(`🚨 [WAF FIREWALL] INJECTION ATTACK BLOCKED & IP BANNED: ${ip}`);
    return res.status(403).json({
      error: 'Security Violation',
      message: 'Zararli so\'rov aniqlandi. IP xavfsizlik filtri tomonidan 24 soatga bloklandi.'
    });
  }

  next();
}

// -------------------------------------------------------------
// 3. SLIDING WINDOW RATE LIMITERS (ANTI BRUTE-FORCE & DOS)
// -------------------------------------------------------------

function createRateLimiter({ windowMs, maxRequests, message }) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of hits.entries()) {
      if (now > data.resetTime) {
        hits.delete(key);
      }
    }
  }, Math.max(60000, Math.floor(windowMs / 2)));

  return function rateLimitMiddleware(req, res, next) {
    const ip = getClientIP(req);
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    let record = hits.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(key, record);
      return next();
    }

    record.count++;
    if (record.count > maxRequests) {
      const waitMinutes = Math.ceil((record.resetTime - now) / 60000);
      return res.status(429).json({
        success: false,
        message: message || `Xavfsizlik yuzasidan vaqtincha to'xtatildi. Iltimos, ${waitMinutes} daqiqadan so'ng qayta urinib ko'ring.`
      });
    }

    next();
  };
}

const loginRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 30,          // Max 30 attempts per 10 mins (protects against brute-force without blocking real users)
  message: "Xavfsizlik tizimi: Juda ko'p urinishlar aniqlandi. Iltimos, birozdan so'ng qayta urinib ko'ring."
});

const registerRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 25,          // Max 25 registrations per 15 mins
  message: "Qisqa vaqt ichida juda ko'p yangi akkaunt ochildi. Iltimos, 15 daqiqa kuting."
});

const otpRequestLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 10,          // Max 10 OTP requests
  message: "Juda ko'p kod so'raldi. Xavfsizlik yuzasidan 10 daqiqa kuting."
});

const apiGeneralLimiter = createRateLimiter({
  windowMs: 60 * 1000,      // 1 minute
  maxRequests: 300,         // 300 requests/min
  message: "Server so'rovlar chegarasi oshdi. Birozdan so'ng urinib ko'ring."
});

// -------------------------------------------------------------
// 4. FILE UPLOAD SECURITY (ANTI-MALWARE & EXTENSION WHITELIST)
// -------------------------------------------------------------

const ALLOWED_EXTENSIONS = new Set([
  // Images
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.ico',
  // Videos
  '.mp4', '.webm', '.mov', '.mkv', '.avi', '.3gp', '.m4v', '.ts', '.flv',
  // Audio
  '.ogg', '.mp3', '.m4a', '.wav', '.aac', '.opus', '.flac',
  // Documents & Spreadsheets & Presentations
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.csv',
  // Archives
  '.zip', '.rar', '.7z', '.tar', '.gz',
  // Mobile apps & E-books
  '.apk', '.epub', '.djvu', '.json', '.xml'
]);

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.zsh', '.ps1', '.vbs', '.vbe',
  '.js', '.mjs', '.cjs', '.wsf', '.wsh', '.php', '.phtml', '.php3', '.php4', '.php5',
  '.phps', '.py', '.rb', '.pl', '.cgi', '.jar', '.war', '.ear', '.msi', '.msp',
  '.dll', '.com', '.scr', '.hta', '.cpl', '.msc', '.inf', '.reg', '.iso', '.img',
  '.dmg', '.bin', '.elf', '.so', '.dylib', '.lnk', '.url'
]);

function hasDangerousDoubleExtension(filename) {
  if (!filename || typeof filename !== 'string') return true;
  const parts = filename.toLowerCase().split('.').filter(Boolean);
  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i++) {
      if (DANGEROUS_EXTENSIONS.has('.' + parts[i])) {
        return true;
      }
    }
  }
  return false;
}

function isAllowedFileExtension(filename) {
  if (!filename || typeof filename !== 'string') return false;
  if (hasDangerousDoubleExtension(filename)) return false;
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const ext = filename.substring(dotIndex).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

// Deep Binary Magic Byte & Content Inspection (Anti-Malware / Anti-Spoofing)
function inspectFileSafety(filePath, originalname) {
  if (!originalname || /[\x00-\x1f\x7f]/.test(originalname)) {
    return { safe: false, reason: 'Fayl nomida noqonuniy belgilar mavjud' };
  }

  if (hasDangerousDoubleExtension(originalname)) {
    return { safe: false, reason: 'Xavfli kengaytma aniqlandi (.exe, .sh, .bat, .php kabi fayllar taqiqlangan)' };
  }

  const dotIndex = originalname.lastIndexOf('.');
  const ext = dotIndex !== -1 ? originalname.substring(dotIndex).toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { safe: false, reason: 'Ushbu turdagi fayllarni yuborish xavfsizlik qoidalari bo\'yicha taqiqlangan' };
  }

  try {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return { safe: false, reason: 'Fayl topilmadi' };
    }

    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
    fs.closeSync(fd);

    if (bytesRead >= 2) {
      // Windows Executable / DLL: MZ (4D 5A)
      if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
        return { safe: false, reason: 'Zararli ijro etuvchi fayl (Windows Executable/DLL) aniqlandi va bloklandi!' };
      }
    }

    if (bytesRead >= 4) {
      // Linux Executable: \x7FELF
      if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
        return { safe: false, reason: 'Zararli binar fayl (Linux ELF Executable) aniqlandi va bloklandi!' };
      }
    }

    // Unix Shell Shebang: #!
    if (bytesRead >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
      return { safe: false, reason: 'Zararli tizim skripti (Shell Script) aniqlandi va bloklandi!' };
    }

    // Embedded Script / WebShell inspection
    const headerStr = buffer.toString('utf8', 0, bytesRead).toLowerCase();
    if (headerStr.includes('<?php') || headerStr.includes('<script') || headerStr.includes('<%')) {
      return { safe: false, reason: 'Fayl ichida zararli skript kodlari aniqlandi va bloklandi!' };
    }

    return { safe: true };
  } catch (err) {
    console.error('File safety inspection error:', err);
    return { safe: false, reason: 'Faylni xavfsizlik tekshiruvidan o\'tkazishda xatolik yuz berdi' };
  }
}

// -------------------------------------------------------------
// 5. HARDENED HTTP SECURITY HEADERS (STEEL SHIELD)
// -------------------------------------------------------------

function securityHeadersMiddleware(req, res, next) {
  // Content Security Policy (Prevents unauthorized script injection, clickjacking, framing)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob: https:; " +
    "media-src 'self' data: blob: https:; " +
    "connect-src 'self' wss: ws: https:; " +
    "font-src 'self'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none';"
  );

  // Anti-Clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Anti-MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS Protection for legacy browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict Transport Security (HSTS - 2 years)
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Cross-Origin Isolation & Sharing (Cross-Origin allows Android WebView & PWAs to load avatars/media)
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Strict Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Explicit Hardware Permissions Policy
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()');

  // Remove fingerprinting headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  wafMiddleware,
  loginRateLimiter,
  registerRateLimiter,
  otpRequestLimiter,
  apiGeneralLimiter,
  isAllowedFileExtension,
  inspectFileSafety,
  securityHeadersMiddleware
};
