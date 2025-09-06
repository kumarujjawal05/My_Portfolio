// OTP-first app: full-screen auth, then portfolio
const root = document.documentElement;
const app = document.getElementById('app');

// Configure your API base for GitHub Pages/static hosting
const API_BASE = (window.API_BASE && typeof window.API_BASE === 'string') ? window.API_BASE : '' /* set to e.g. https://your-api-domain */;

const state = {
  theme: localStorage.getItem('theme') || 'dark',
  // Auth/session
  sessionId: null,
  accessToken: localStorage.getItem('accessToken') || null,
  verified: false,
  step: 'phone', // 'phone' | 'code' | 'done'
  ttl: 0, // seconds remaining for OTP
  _guardChecked: false,
  // UI flags
  sending: false,
  verifying: false,
  error: '',
};

function setTheme(t) {
  state.theme = t;
  if (t === 'light') root.classList.add('light');
  else root.classList.remove('light');
  localStorage.setItem('theme', t);
}
setTheme(state.theme);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'disabled' && v) node.setAttribute('disabled', '');
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  });
  children.forEach((c) => node.append(c));
  return node;
}

function render() {
  app.innerHTML = '';

  // One-time guard check to auto-verify existing token
  if (state.accessToken && !state.verified && !state._guardChecked) {
    state._guardChecked = true;
    fetch(`${API_BASE}/api/guard`, { headers: { Authorization: `Bearer ${state.accessToken}` } })
      .then(r => {
        if (r.ok) {
          state.verified = true;
          state.step = 'done';
        } else {
          state.accessToken = null;
          localStorage.removeItem('accessToken');
        }
      })
      .catch(() => {})
      .finally(() => render());
    // Show loading auth screen while checking
    app.append(header(), el('div', { class: 'container' }, loadingBlock('Checking session...')));
    return;
  }

  if (!state.verified) {
    state.step = state.step === 'done' ? 'phone' : state.step;
    app.append(header(), authScreen());
    return;
  }

  // Verified -> show portfolio
  app.append(
    header(true),
    el('div', { class: 'container' },
      portfolioSections(),
      footer()
    )
  );
}

function header(showLogout = false) {
  return el('div', { class: 'container' },
    el('div', { class: 'header' },
      el('div', { class: 'logo' }, el('div', { class: 'dot' }), el('span', {}, 'Ujjawal Kumar')),
      el('div', {},
        showLogout ? el('button', { class: 'btn ghost', onClick: () => logout() }, 'Logout') : null,
        el('button', { class: 'theme-toggle', onClick: () => setTheme(state.theme === 'dark' ? 'light' : 'dark') }, state.theme === 'dark' ? '☀️ Light' : '🌙 Dark')
      )
    )
  );
}

function logout() {
  state.verified = false;
  state.accessToken = null;
  localStorage.removeItem('accessToken');
  state.sessionId = null;
  state.step = 'phone';
  state.error = '';
  render();
}

// --- Auth Screen (OTP-first) ---
function authScreen() {
  const wrap = el('div', { class: 'container' },
    el('div', { class: 'hero' }, authCard())
  );
  return wrap;
}

function authCard() {
  const card = el('div', { class: 'hero-card' });
  card.append(
    el('span', { class: 'badge' }, 'Secure Access'),
    el('div', { class: 'h1' }, 'Verify to view portfolio'),
    el('p', { class: 'p' }, 'Enter your phone number to receive a 6-digit code. Your data is not stored.'),
  );

  if (state.step === 'phone') card.append(phoneStep());
  if (state.step === 'code') card.append(codeStep());

  if (state.error) card.append(el('div', { class: 'helper' }, state.error));
  return card;
}

function phoneStep() {
  const phoneInput = el('input', { class: 'input', placeholder: '+919876543210', type: 'tel', value: state.lastPhone || '' });
  const startBtn = el('button', { class: 'btn primary', disabled: true }, state.sending ? 'Sending...' : 'Get Code');
  const helper = el('div', { class: 'helper' }, 'Use E.164 format (e.g., +919876543210).');

  const phoneValid = (v) => /^\+?[1-9]\d{7,14}$/.test(v.trim());
  const onInput = () => {
    startBtn.textContent = state.sending ? 'Sending...' : 'Get Code';
    startBtn.toggleAttribute('disabled', !phoneValid(phoneInput.value) || state.sending);
  };
  phoneInput.addEventListener('input', onInput);
  onInput();

  startBtn.addEventListener('click', async () => {
    state.sending = true; state.error = ''; onInput();
    try {
      const phone = phoneInput.value.trim();
      const res = await fetch(`${API_BASE}/api/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      state.sessionId = data.sessionId;
      state.ttl = data.ttl || 180;
      state.lastPhone = phone;
      state.step = 'code';
      startCountdown();
      render();
    } catch (e) {
      state.error = e.message || 'Failed to send code';
      render();
    } finally {
      state.sending = false;
    }
  });

  return el('div', {},
    el('div', { class: 'input-row' }, phoneInput, startBtn),
    helper
  );
}

let countdownTimer = null;
function startCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (state.ttl > 0) {
      state.ttl -= 1;
    } else {
      clearInterval(countdownTimer);
    }
    // Only re-render if we are on code step and not verified
    if (!state.verified && state.step === 'code') {
      const ttlNode = document.querySelector('[data-ttl]');
      if (ttlNode) ttlNode.textContent = `Code expires in ${state.ttl}s`;
      const resendBtn = document.querySelector('[data-resend]');
      if (resendBtn) resendBtn.toggleAttribute('disabled', state.ttl > 0);
    }
  }, 1000);
}

function codeStep() {
  // Code inputs
  const inputs = Array.from({ length: 6 }, () => el('input', { class: 'input', maxLength: 1, inputmode: 'numeric', pattern: '[0-9]*' }));

  // Move focus next/prev on input/backspace
  inputs.forEach((inp, idx) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/[^0-9]/g, '');
      if (inp.value && idx < inputs.length - 1) inputs[idx + 1].focus();
      autoVerifyIfReady();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && idx > 0) inputs[idx - 1].focus();
      if (e.key === 'ArrowLeft' && idx > 0) inputs[idx - 1].focus();
      if (e.key === 'ArrowRight' && idx < inputs.length - 1) inputs[idx + 1].focus();
    });
  });

  // Paste handler to fill all boxes at once
  inputs[0].addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (/^\d{6}$/.test(text)) {
      e.preventDefault();
      text.split('').forEach((ch, i) => { if (inputs[i]) inputs[i].value = ch; });
      autoVerifyIfReady();
    }
  });

  const status = el('div', { class: 'helper' }, `Code sent to ${maskPhone(state.lastPhone)}.`);
  const ttlInfo = el('div', { class: 'helper', 'data-ttl': '' }, `Code expires in ${state.ttl}s`);
  const resendBtn = el('button', { class: 'btn ghost', 'data-resend': '', disabled: state.ttl > 0 }, 'Resend Code');
  const changeBtn = el('button', { class: 'btn ghost' }, 'Change number');
  const verifyBtn = el('button', { class: 'btn primary' }, state.verifying ? 'Verifying...' : 'Verify');

  resendBtn.addEventListener('click', async () => {
    if (state.ttl > 0 || state.sending) return;
    state.sending = true; state.error = '';
    try {
      const res = await fetch(`${API_BASE}/api/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: state.lastPhone }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend code');
      state.sessionId = data.sessionId;
      state.ttl = data.ttl || 180;
      startCountdown();
      ttlInfo.textContent = `Code expires in ${state.ttl}s`;
      status.textContent = `Code re-sent to ${maskPhone(state.lastPhone)}.`;
      resendBtn.setAttribute('disabled', '');
    } catch (e) {
      state.error = e.message || 'Failed to resend code';
      render();
    } finally {
      state.sending = false;
    }
  });

  changeBtn.addEventListener('click', () => {
    state.step = 'phone';
    state.error = '';
    clearInterval(countdownTimer);
    render();
  });

  verifyBtn.addEventListener('click', () => doVerify(inputs));

  function autoVerifyIfReady() {
    const code = inputs.map(i => i.value).join('');
    if (code.length === 6) doVerify(inputs);
  }

  return el('div', {},
    el('div', { class: 'code-inputs' }, ...inputs),
    el('div', { class: 'cta-group' }, verifyBtn),
    ttlInfo,
    el('div', { class: 'cta-group' }, resendBtn, changeBtn),
    status,
    state.error ? el('div', { class: 'helper' }, state.error) : null
  );
}

async function doVerify(inputs) {
  if (state.verifying) return;
  const otp = inputs.map((i) => i.value).join('');
  if (!/^\d{6}$/.test(otp)) { state.error = 'Enter all 6 digits'; render(); return; }
  state.verifying = true; state.error = '';
  try {
    const res = await fetch(`${API_BASE}/api/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.sessionId, otp }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');
    state.accessToken = data.accessToken;
    localStorage.setItem('accessToken', state.accessToken);
    state.verified = true;
    state.step = 'done';
    clearInterval(countdownTimer);
    render();
  } catch (e) {
    state.error = e.message || 'Verification failed';
    render();
  } finally {
    state.verifying = false;
  }
}

function maskPhone(phone) {
  if (!phone) return '';
  return phone.replace(/(\+?\d{2})(\d+)(\d{2})$/, (_, a, b, c) => `${a}${'*'.repeat(Math.max(0, b.length))}${c}`);
}

function loadingBlock(text) {
  return el('div', { class: 'section' }, el('p', { class: 'p' }, text));
}

// --- Portfolio ---
function portfolioSections() {
  const wrapper = el('div');

  const projects = [
    { title: 'Nova UI', desc: 'A component library with motion-first design.', tags: ['TypeScript', 'CSS'] },
    { title: 'Pulse Analytics', desc: 'Real-time metrics with streaming charts.', tags: ['React', 'WebSockets'] },
    { title: 'Astra CMS', desc: 'Markdown-first content system.', tags: ['Node', 'Postgres'] }
  ];

  wrapper.append(
    el('section', { id: 'projects', class: 'section' },
      el('h3', {}, 'Featured Projects'),
      el('div', { class: 'grid' }, ...projects.map(card))
    ),
    el('section', { id: 'about', class: 'section' },
      el('h3', {}, 'About Me'),
      el('p', { class: 'p' }, 'I’m a full‑stack developer focused on crafting smooth user experiences with clean, reliable code.')
    ),
    el('section', { id: 'contact', class: 'section' },
      el('h3', {}, 'Contact'),
      el('p', { class: 'p' }, 'Email: you@example.com • Phone: available after verification')
    )
  );
  return wrapper;
}

function card(p) {
  const pill = (t) => el('span', { class: 'badge' }, t);
  return el('div', { class: 'card' },
    el('h4', {}, p.title),
    el('p', { class: 'p' }, p.desc),
    el('div', { class: 'cta-group' }, ...p.tags.map(pill))
  );
}

function footer() {
  const year = new Date().getFullYear();
  return el('div', { class: 'footer' }, `© ${year} Your Name · Built with ❤️`);
}

render();