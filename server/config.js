const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'wisdom_secret_super_key_2026_xyz987',
  JWT_EXPIRES_IN: '30d',
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '../wisdom_chat.db'),
  
  // SMTP / Gmail configuration
  SMTP_SERVICE: process.env.SMTP_SERVICE || 'gmail',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true' || true,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'Wisdom Dictionary <noreply.wisdom.dictionary@gmail.com>',
  
  // OTP settings
  OTP_EXPIRES_MS: 10 * 60 * 1000, // 10 minutes
  OTP_COOLDOWN_MS: 60 * 1000,      // 60 seconds between resends
  MAX_OTP_ATTEMPTS: 5
};
