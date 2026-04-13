// app.js — shared client helpers
async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let data = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data?.error || ('HTTP ' + r.status));
  return data;
}
async function getMe() { try { return await api('/api/me'); } catch { return null; } }
async function logout() { await api('/api/logout', { method: 'POST' }); window.location = '/index.html'; }

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

async function mountTopbar(active = '') {
  const me = await getMe();
  const bar = document.getElementById('topbar');
  if (!bar) return;
  const links = [
    { href: '/dashboard.html', label: 'Dashboard', key: 'dashboard', show: !!me },
    { href: '/tier.html?tier=1', label: 'Tier 1', key: 'tier1', show: !!me },
    { href: '/tier.html?tier=2', label: 'Tier 2', key: 'tier2', show: !!me },
    { href: '/tier.html?tier=3', label: 'Tier 3', key: 'tier3', show: !!me },
    { href: '/teacher.html', label: 'Teacher', key: 'teacher', show: me && (me.role === 'teacher' || me.role === 'admin') },
    { href: '/about.html', label: 'About', key: 'about', show: true },
  ];
  bar.innerHTML = '';
  bar.appendChild(el('a', { href: '/', class: 'brand' },
    el('div', { class: 'brand-logo' }, 'M'),
    el('span', {}, 'MathCode')
  ));
  const nav = el('nav');
  for (const l of links) {
    if (!l.show) continue;
    nav.appendChild(el('a', { href: l.href, style: l.key === active ? 'color: var(--accent-2)' : '' }, l.label));
  }
  bar.appendChild(nav);
  const actions = el('div', { class: 'topbar-actions' });
  if (me) {
    actions.appendChild(el('span', { class: 'muted', style: 'font-size:13px' }, me.full_name));
    actions.appendChild(el('button', { class: 'btn ghost', onclick: logout }, 'Sign out'));
  } else {
    actions.appendChild(el('a', { href: '/login.html', class: 'btn ghost' }, 'Sign in'));
    actions.appendChild(el('a', { href: '/register.html', class: 'btn primary' }, 'Get started'));
  }
  bar.appendChild(actions);
}
