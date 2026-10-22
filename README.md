# WordsLive — Stealth Dictionary & Real-Time Messenger

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ozifmc-tech/wordslive)

## 📌 Features
- **Stealth Dictionary:** 100% functional English-Uzbek dictionary with offline audio pronunciation and word of the day.
- **Real-Time Encrypted Messenger:** Powered by Socket.io, real-time message read receipts (`✓✓`), typing indicators, voice notes, and media sharing.
- **Active Sessions & Device Deduplication:** Track all active logins, devices, and session security.
- **Anti-Malware & Magic-Byte Scanner:** Deep server-side binary inspection blocking executable payloads.
- **Keep-Alive Worker:** Automatic 10-minute self-pinger keeping free cloud tier awake 24/7.

## 🚀 1-Click Free Deployment
Click the **"Deploy to Render"** button above or use:
[https://render.com/deploy?repo=https://github.com/ozifmc-tech/wordslive](https://render.com/deploy?repo=https://github.com/ozifmc-tech/wordslive)

## ⚙️ Environment Variables
| Variable | Description |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `10000` (auto on Render) |
| `JWT_SECRET` | Secret key for auth tokens |
| `SMTP_USER` | Gmail address for OTP codes |
| `SMTP_PASS` | Google 16-character App Password |
