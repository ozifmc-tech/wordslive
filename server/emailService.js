const nodemailer = require('nodemailer');
const config = require('./config');

let transporter = null;

// Initialize Nodemailer transporter if credentials exist
function initTransporter() {
  if (config.SMTP_USER && config.SMTP_PASS) {
    try {
      if (config.SMTP_SERVICE === 'gmail') {
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS
          }
        });
      } else {
        transporter = nodemailer.createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_SECURE,
          auth: {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS
          }
        });
      }
      console.log(`[EMAIL SERVICE] SMTP sozlandi: ${config.SMTP_USER}`);
    } catch (err) {
      console.error('[EMAIL SERVICE] SMTP yaratishda xatolik:', err.message);
      transporter = null;
    }
  } else {
    transporter = null;
    console.log('[EMAIL SERVICE] SMTP_USER yoki SMTP_PASS kiritilmagan. Sinov / Dev rejimi faol.');
  }
}

initTransporter();

/**
 * Send 6-digit OTP verification email
 * @param {string} toEmail 
 * @param {string} code 
 * @returns {Promise<{ sent: boolean, devCode?: string, message: string }>}
 */
async function sendOtpEmail(toEmail, code) {
  // Always log code to console for safety, testing, and debugging
  console.log(`\n======================================================`);
  console.log(`[GMAIL OTP KODI] Qabul qiluvchi: ${toEmail}`);
  console.log(`[GMAIL OTP KODI] Tasdiqlash kodi: >>> ${code} <<<`);
  console.log(`======================================================\n`);

  if (!transporter) {
    return {
      sent: false,
      devCode: code,
      message: 'SMTP sozlanmagan. Kod server konsolida yoki ekranda ko\'rsatildi (Sinov rejimi).'
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
        .logo { display: inline-flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; color: #2563eb; margin-bottom: 24px; }
        .title { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .text { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .code-box { background: #eff6ff; border: 2px dashed #93c5fd; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
        .code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace; }
        .footer { font-size: 13px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">
          <span>📚 Wisdom Dictionary</span>
        </div>
        <div class="title">Hisobni tasdiqlash kodi</div>
        <div class="text">
          Assalomu alaykum! Wisdom Dictionary ilovasida shaxsiy profilingizni tasdiqlash uchun quyidagi 6 xonali maxfiy koddan foydalaning:
        </div>
        <div class="code-box">
          <div class="code">${code}</div>
        </div>
        <div class="text" style="font-size: 14px;">
          ⏱️ Ushbu kod <strong>10 daqiqa</strong> davomida amal qiladi.<br>
          ⚠️ Xavfsizlik maqsadida ushbu kodni hech kimga, hatto ilova ma'murlariga ham bermang.
        </div>
        <div class="footer">
          Agar siz ushbu so'rovni yubormagan bo'lsangiz, ushbu xabarni shunchaki e'tiborsiz qoldiring.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: config.SMTP_FROM,
      to: toEmail,
      subject: `Wisdom Dictionary: Tasdiqlash kodi - ${code}`,
      text: `Wisdom Dictionary tasdiqlash kodi: ${code}. Ushbu kod 10 daqiqa davomida amal qiladi.`,
      html: htmlContent
    });

    console.log(`[EMAIL SERVICE] Xat muvaffaqiyatli yuborildi: ${info.messageId}`);
    return {
      sent: true,
      message: 'Tasdiqlash kodi emailingizga muvaffaqiyatli yuborildi!'
    };
  } catch (err) {
    console.error(`[EMAIL SERVICE XATOLIK]:`, err.message);
    // Graceful fallback: return code in devCode so the flow is NEVER broken
    return {
      sent: false,
      devCode: code,
      message: `SMTP orqali yuborishda xatolik yuz berdi (${err.message}). Sinov uchun kod server konsoliga chiqarildi.`
    };
  }
}

module.exports = {
  sendOtpEmail,
  initTransporter
};
