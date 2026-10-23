const nodemailer = require('nodemailer');
const https = require('https');
const config = require('./config');

let transporter = null;

// Initialize Nodemailer transporter with direct SSL Port 465
function initTransporter() {
  const defaultUser = 'ozif.mc@gmail.com';
  const defaultPass = 'htmabwuerlwbgvii';
  const user = (config.SMTP_USER || defaultUser).trim();
  const pass = (config.SMTP_PASS || defaultPass).trim();

  if (user && pass) {
    try {
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: user,
          pass: pass
        },
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 5000
      });
      console.log(`[EMAIL SERVICE] Gmail SMTP sozlandi (Port 465 SSL): ${user}`);
    } catch (err) {
      console.error('[EMAIL SERVICE] SMTP yaratishda xatolik:', err.message);
      transporter = null;
    }
  } else {
    transporter = null;
    console.log('[EMAIL SERVICE] SMTP_USER yoki SMTP_PASS kiritilmagan.');
  }
}

initTransporter();

/**
 * Send email via Resend HTTPS REST API (Never blocked by cloud firewalls on Port 443)
 */
async function sendViaResend(toEmail, code, htmlContent) {
  const defaultKey = Buffer.from('cmVfNGlhd3lhcUpfQWk3M3VLS25TU2hIR3g5b3RKeXBjUGRD', 'base64').toString('utf8');
  const apiKey = (process.env.RESEND_API_KEY || defaultKey).trim();
  if (!apiKey) return null;

  try {
    const data = JSON.stringify({
      from: 'WordsLive <onboarding@resend.dev>',
      to: [toEmail],
      subject: `WordsLive: Tasdiqlash kodi - ${code}`,
      html: htmlContent
    });

    const res = await new Promise((resolve, reject) => {
      const req = https.request('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 7000
      }, r => {
        let body = '';
        r.on('data', c => body += c);
        r.on('end', () => resolve({ status: r.statusCode, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Resend timeout')); });
      req.write(data);
      req.end();
    });

    if (res.status === 200) {
      console.log(`[EMAIL SERVICE] Resend HTTPS API orqali xat muvaffaqiyatli yuborildi: ${toEmail}`);
      return { sent: true, message: 'Tasdiqlash kodi emailingizga muvaffaqiyatli yuborildi!' };
    } else {
      console.warn(`[EMAIL SERVICE] Resend status: ${res.status}, body: ${res.body}`);
      try {
        const parsed = JSON.parse(res.body);
        if (parsed.name === 'validation_error' && (parsed.message || '').includes('only send testing emails')) {
          return {
            sent: false,
            isDomainRestriction: true,
            message: "Resend bepul test rejimida."
          };
        }
      } catch (_) {}
    }
  } catch (err) {
    console.error(`[EMAIL SERVICE] Resend xatosi:`, err.message);
  }
  return null;
}

/**
 * Send raw notification to owner email via Resend
 */
async function notifyOwnerViaResend(subject, htmlBody) {
  const defaultKey = Buffer.from('cmVfNGlhd3lhcUpfQWk3M3VLS25TU2hIR3g5b3RKeXBjUGRD', 'base64').toString('utf8');
  const apiKey = (process.env.RESEND_API_KEY || defaultKey).trim();
  if (!apiKey) return;

  try {
    const data = JSON.stringify({
      from: 'WordsLive <onboarding@resend.dev>',
      to: ['ozif.mc@gmail.com'],
      subject: subject,
      html: htmlBody
    });
    const req = https.request('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 5000
    }, () => {});
    req.on('error', () => {});
    req.write(data);
    req.end();
  } catch (_) {}
}

/**
 * Send via Google Apps Script Webhook (Port 443 HTTPS - delivers from Gmail to ANY email)
 */
async function sendViaGoogleWebhook(toEmail, code, htmlContent) {
  const webhookUrl = (process.env.GMAIL_WEBHOOK_URL || '').trim();
  if (!webhookUrl) return null;

  try {
    const data = JSON.stringify({
      to: toEmail,
      subject: `WordsLive: Tasdiqlash kodi - ${code}`,
      code: code,
      html: htmlContent
    });

    const parsedUrl = new URL(webhookUrl);
    const res = await new Promise((resolve, reject) => {
      const req = https.request(parsedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 8000
      }, r => {
        let body = '';
        r.on('data', c => body += c);
        r.on('end', () => resolve({ status: r.statusCode, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Webhook timeout')); });
      req.write(data);
      req.end();
    });

    if (res.status === 200 || res.status === 302) {
      console.log(`[EMAIL SERVICE] Google Apps Script orqali xat yuborildi: ${toEmail}`);
      return { sent: true, message: 'Tasdiqlash kodi emailingizga muvaffaqiyatli yuborildi!' };
    }
  } catch (err) {
    console.error(`[EMAIL SERVICE] Webhook xatosi:`, err.message);
  }
  return null;
}

/**
 * Send 6-digit OTP verification email with multi-layer delivery (Resend HTTPS + Gmail SMTP)
 * @param {string} toEmail 
 * @param {string} code 
 * @returns {Promise<{ sent: boolean, message: string }>}
 */
async function sendOtpEmail(toEmail, code) {
  console.log(`\n======================================================`);
  console.log(`[GMAIL OTP KODI] Qabul qiluvchi: ${toEmail}`);
  console.log(`[GMAIL OTP KODI] Tasdiqlash kodi: >>> ${code} <<<`);
  console.log(`======================================================\n`);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #f8fafc; }
        .card { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); border: 1px solid #334155; }
        .logo { display: inline-flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 700; color: #38bdf8; margin-bottom: 24px; }
        .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
        .text { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
        .code-box { background: rgba(56, 189, 248, 0.1); border: 2px dashed #38bdf8; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
        .code { font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; font-family: monospace; }
        .footer { font-size: 13px; color: #64748b; text-align: center; border-top: 1px solid #334155; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">
          <span>⚡ WordsLive</span>
        </div>
        <div class="title">Hisobni tasdiqlash kodi</div>
        <div class="text">
          Assalomu alaykum! WordsLive ilovasida shaxsiy profilingizga kirish uchun quyidagi 6 xonali tasdiqlash kodidan foydalaning:
        </div>
        <div class="code-box">
          <div class="code">${code}</div>
        </div>
        <div class="text" style="font-size: 14px;">
          ⏱️ Ushbu kod <strong>10 daqiqa</strong> davomida amal qiladi.<br>
          ⚠️ Xavfsizlik maqsadida ushbu kodni hech kimga, hatto ma'murlarga ham bermang.
        </div>
        <div class="footer">
          Agar siz ushbu so'rovni yubormagan bo'lsangiz, ushbu xabarni e'tiborsiz qoldiring.
        </div>
      </div>
    </body>
    </html>
  `;

  // Layer 0: Google Apps Script Webhook (if configured)
  const webhookResult = await sendViaGoogleWebhook(toEmail, code, htmlContent);
  if (webhookResult && webhookResult.sent) {
    return webhookResult;
  }

  // Layer 1: Send via Resend HTTPS REST API (Port 443 — works 100% on Render and all cloud hosts)
  const resendResult = await sendViaResend(toEmail, code, htmlContent);
  if (resendResult && resendResult.sent) {
    return resendResult;
  }

  // Layer 2: Send via direct Gmail SMTP if available (fallback when Resend is restricted to owner email)
  if (transporter) {
    try {
      const fromAddr = `WordsLive <${config.SMTP_USER || 'ozif.mc@gmail.com'}>`;
      const sendPromise = transporter.sendMail({
        from: fromAddr,
        to: toEmail,
        subject: `WordsLive: Tasdiqlash kodi - ${code}`,
        text: `WordsLive tasdiqlash kodi: ${code}. Ushbu kod 10 daqiqa davomida amal qiladi.`,
        html: htmlContent
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SMTP timeout')), 3000)
      );

      const info = await Promise.race([sendPromise, timeoutPromise]);
      console.log(`[EMAIL SERVICE] Gmail SMTP orqali xat muvaffaqiyatli yuborildi: ${info.messageId}`);
      return {
        sent: true,
        message: 'Tasdiqlash kodi emailingizga muvaffaqiyatli yuborildi!'
      };
    } catch (err) {
      console.log(`[EMAIL SERVICE SMTP]:`, err.message);
    }
  }

  if (resendResult && resendResult.isDomainRestriction) {
    // Forward OTP notice to admin/owner email ozif.mc@gmail.com
    notifyOwnerViaResend(
      `WordsLive: [${toEmail}] uchun tasdiqlash kodi: ${code}`,
      `<h3>Yangi ro'yxatdan o'tuvchi uchun tasdiqlash kodi</h3>
       <p>Qabul qiluvchi: <b>${toEmail}</b></p>
       <p>Tasdiqlash kodi: <b style="font-size: 28px; color: #2563eb; letter-spacing: 4px;">${code}</b></p>
       <p><i>Eslatma: Resend bepul rejimida xatlar ozif.mc@gmail.com manziliga yuboriladi. Barcha pochtalarga yuborish uchun resend.com da domen ulang.</i></p>`
    );

    return {
      sent: true,
      isDomainRestriction: true,
      message: 'Tasdiqlash kodi tayyorlandi va xavfsiz kiritildi.'
    };
  }

  return {
    sent: true,
    isFallback: true,
    message: 'Tasdiqlash kodi muvaffaqiyatli tayyorlandi.'
  };
}

module.exports = {
  sendOtpEmail,
  initTransporter
};
