import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import otpGenerator from 'otp-generator';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

const app = express();
app.use(helmet());
app.use(express.json());

// Allow CORS for GitHub Pages origin or all if not set
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN }));
app.use(express.static(publicDir));

// Serve index explicitly at root
app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});
// Optional: handle favicon quickly
app.get('/favicon.ico', (_req, res) => res.sendStatus(204));

// Simple in-memory stores (production: use Redis/DB)
const otpStore = new Map(); // key: sessionId, value: { phone, otp, expiresAt }
const tokenStore = new Map(); // key: accessToken, value: expiresAt

// Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Begin verification -> returns sessionId
app.post('/api/start', async (req, res) => {
  const { phone } = req.body || {};
  if (!phone || !/^\+?[1-9]\d{7,14}$/.test(phone)) {
    return res.status(400).json({ error: 'Provide phone in E.164 format, e.g., +15555555555' });
  }
  const sessionId = nanoid(16);
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 1000 * 60 * 3; // 3 minutes
  otpStore.set(sessionId, { phone, otp, expiresAt });

  // Send via Twilio if configured, otherwise log for dev
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM) {
    try {
      const twilio = (await import('twilio')).default;
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      await client.messages.create({ body: `Your verification code is ${otp}`, from: TWILIO_FROM, to: phone });
      console.log('OTP sent to', phone);
    } catch (err) {
      console.error('Twilio send error', err);
      return res.status(500).json({ error: 'Failed to send OTP' });
    }
  } else {
    console.log(`[DEV] OTP for ${phone}: ${otp}`);
  }

  res.json({ sessionId, ttl: 180 });
});

// Verify OTP
app.post('/api/verify', (req, res) => {
  const { sessionId, otp } = req.body || {};
  if (!sessionId || !otp) return res.status(400).json({ error: 'sessionId and otp are required' });

  const record = otpStore.get(sessionId);
  if (!record) return res.status(400).json({ error: 'Invalid session' });
  if (Date.now() > record.expiresAt) {
    otpStore.delete(sessionId);
    return res.status(400).json({ error: 'OTP expired' });
  }
  if (record.otp !== String(otp)) return res.status(400).json({ error: 'Incorrect OTP' });

  // Mark verified and grant a short-lived access token (demo only)
  otpStore.delete(sessionId);
  const accessToken = nanoid(24);
  const expiresAt = Date.now() + 1000 * 60 * 15; // 15 minutes
  tokenStore.set(accessToken, expiresAt);
  res.json({ ok: true, accessToken, expiresIn: 900 });
});

// Protect portfolio route with simple bearer token (demo)
app.get('/api/guard', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const exp = tokenStore.get(token);
  if (!exp) return res.status(401).json({ error: 'Unauthorized' });
  if (Date.now() > exp) {
    tokenStore.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }
  return res.json({ ok: true });
});

const PORT = process.env.PORT || 5173;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));