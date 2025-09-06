// Theme + OTP gate + simple portfolio renderer
const root = document.documentElement;
const app = document.getElementById('app');

const state = {
  theme: localStorage.getItem('theme') || 'dark',
  sessionId: null,
  accessToken: localStorage.getItem('accessToken') || null,
  verified: false,
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
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  });
  children.forEach((c) => node.append(c));
  return node;
}

function render() {
  app.innerHTML = '';
  app.append(
    header(),
    el('div', { class: 'container' },
      el('div', { class: 'hero' }, heroCard(), gateCard()),
      el('div', { class: 'divider' }),
      portfolioSections(),
      footer()
    )
  );
}

function header() {
  return el('div', { class: 'container' },
    el('div', { class: 'header' },
      el('div', { class: 'logo' }, el('div', { class: 'dot' }), el('span', {}, 'Your Name')),
      el('button', { class: 'theme-toggle', onClick: () => setTheme(state.theme === 'dark' ? 'light' : 'dark') }, state.theme === 'dark' ? '☀️ Light' : '🌙 Dark')
    )
  );
}

function heroCard() {
  return el('div', { class: 'hero-card' },
    el('span', { class: 'badge' }, 'Design • Code • Build'),
    el('div', { class: 'h1' }, 'Crafting delightful experiences'),
    el('p', { class: 'p' }, 'I build fast, accessible, and elegant web apps. Check my selected work below.'),
    el('div', { class: 'cta-group' },
      el('a', { class: 'btn primary', href: '#projects' }, 'View Projects'),
      el('a', { class: 'btn ghost', href: '#contact' }, 'Contact Me')
    )
  );
}

function gateCard() {
  const phoneInput = el('input', { class: 'input', placeholder: '+15555555555', type: 'tel' });
  const startBtn = el('button', { class: 'btn primary' }, 'Get Access');
  const helper = el('div', { class: 'helper' }, 'Enter your phone in E.164 format. A 6-digit OTP will be sent.');

  const codeInputs = Array.from({ length: 6 }, (_, i) => el('input', { maxLength: 1, inputmode: 'numeric', pattern: '[0-9]*' }));
  codeInputs.forEach((inp, idx) => {
    inp.addEventListener('input', () => { if (inp.value && idx < 5) codeInputs[idx+1].focus(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !inp.value && idx > 0) codeInputs[idx-1].focus(); });
  });
  const verifyBtn = el('button', { class: 'btn primary' }, 'Verify');
  const status = el('div', { class: 'helper' });

  startBtn.addEventListener('click', async () => {
    status.textContent = 'Sending OTP...';
    try {
      const res = await fetch('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phoneInput.value.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      state.sessionId = data.sessionId;
      status.textContent = `OTP sent. Expires in ${data.ttl}s`;
    } catch (e) {
      status.textContent = e.message;
    }
  });

  verifyBtn.addEventListener('click', async () => {
    const otp = codeInputs.map((i) => i.value).join('');
    if (otp.length !== 6) { status.textContent = 'Enter all 6 digits'; return; }
    status.textContent = 'Verifying...';
    try {
      const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.sessionId, otp }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      state.accessToken = data.accessToken;
      localStorage.setItem('accessToken', state.accessToken);
      state.verified = true;
      status.textContent = 'Access granted';
      render();
    } catch (e) {
      status.textContent = e.message;
    }
  });

  const gate = el('div', { class: 'gate' },
    el('h3', {}, 'Unlock Portfolio'),
    el('div', { class: 'input-row' }, phoneInput, startBtn),
    helper,
    el('div', { class: 'code-inputs' }, ...codeInputs),
    el('div', { class: 'cta-group' }, verifyBtn),
    status
  );

  if (state.accessToken) {
    // try a quick guard ping
    fetch('/api/guard', { headers: { Authorization: `Bearer ${state.accessToken}` } }).then(r => {
      if (r.ok) { state.verified = true; render(); }
    });
  }

  return gate;
}

function portfolioSections() {
  const wrapper = el('div');

  if (!state.verified) {
    wrapper.append(el('div', { class: 'section' },
      el('strong', {}, 'Portfolio locked'),
      el('p', { class: 'p' }, 'Verify your phone to view projects and contact details.')
    ));
    return wrapper;
  }

  // Projects
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

render();