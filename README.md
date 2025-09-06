# Portfolio with OTP Gate

A modern, dark/light themed portfolio gated behind phone number verification via OTP. Uses Express for backend and vanilla JS for a lightweight, fast frontend.

## Features
- Dark and light themes with smooth palette
- OTP verification flow (Twilio SMS supported; logs OTP in dev if Twilio is not configured)
- Minimal backend (Express) and no build tooling required

## Quick Start
1. Copy `.env.example` to `.env` and set `PORT` as needed. Optionally add Twilio creds to send real SMS.
2. Install deps:
   ```bash
   npm install
   ```
3. Run dev server:
   ```bash
   npm run dev
   ```
4. Open http://localhost:5173

## Configure Twilio (optional)
- TWILIO_ACCOUNT_SID: Your Twilio Account SID
- TWILIO_AUTH_TOKEN: Your Twilio Auth Token
- TWILIO_FROM: Your Twilio phone number (e.g., +15555555555)

## Notes
- The OTP store is in-memory. For production, replace with Redis or a DB and issue a proper JWT.
- The protected content is illustrative; customize `public/assets/main.js` and `public/assets/styles.css`.