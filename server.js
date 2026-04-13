// server.js — MathCode Learning Platform
// TAS&BA LLC — Integrated Math + Computer Science instruction (K-12)
//
// Stack: Node.js + Express + better-sqlite3 + express-session + bcryptjs

const express        = require('express');
const session        = require('express-session');
const cookieParser   = require('cookie-parser');
const bcrypt         = require('bcryptjs');
const path           = require('path');
const Database       = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db', 'mathcode.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'mathcode-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
}));

// ---------- Helpers ----------
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    if (req.accepts('html')) return res.redirect('/login.html');
    return res.status(401).json({ error: 'auth required' });
  }
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'auth required' });
    const u = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (!u || !roles.includes(u.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}
function logEvent(userId, projectId, event, metadata = null) {
  db.prepare('INSERT INTO sessions_log (user_id, project_id, event, metadata) VALUES (?, ?, ?, ?)')
    .run(userId, projectId, event, metadata ? JSON.stringify(metadata) : null);
}

// ---------- Auth API ----------
app.post('/api/register', (req, res) => {
  const { email, password, full_name, grade_level } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, password, full_name required' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'password must be 8+ chars' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'email already registered' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role, grade_level)
    VALUES (?, ?, ?, 'student', ?)
  `).run(email.toLowerCase(), hash, full_name, grade_level || null);
  req.session.userId = info.lastInsertRowid;
  logEvent(info.lastInsertRowid, null, 'register');
  res.json({ ok: true, user_id: info.lastInsertRowid });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!u || !bcrypt.compareSync(password, u.password_hash)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  req.session.userId = u.id;
  logEvent(u.id, null, 'login');
  res.json({ ok: true, user: { id: u.id, full_name: u.full_name, role: u.role } });
});

app.post('/api/logout', (req, res) => {
  if (req.session.userId) logEvent(req.session.userId, null, 'logout');
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', requireAuth, (req, res) => {
  const u = db.prepare('SELECT id, email, full_name, role, grade_level, created_at FROM users WHERE id = ?')
              .get(req.session.userId);
  res.json(u);
});

// ---------- Project + Progress API ----------
app.get('/api/projects', requireAuth, (req, res) => {
  const tier = req.query.tier ? Number(req.query.tier) : null;
  let rows;
  if (tier) {
    rows = db.prepare('SELECT * FROM projects WHERE tier = ? ORDER BY ordinal').all(tier);
  } else {
    rows = db.prepare('SELECT * FROM projects ORDER BY tier, ordinal').all();
  }
  // Attach this user's progress
  const prog = db.prepare('SELECT project_id, status, score, updated_at FROM progress WHERE user_id = ?')
                 .all(req.session.userId);
  const map = Object.fromEntries(prog.map(p => [p.project_id, p]));
  rows.forEach(r => { r.progress = map[r.id] || null; });
  res.json(rows);
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const prog = db.prepare('SELECT status, score, updated_at FROM progress WHERE user_id = ? AND project_id = ?')
                 .get(req.session.userId, req.params.id);
  p.progress = prog || null;
  res.json(p);
});

app.post('/api/progress', requireAuth, (req, res) => {
  const { project_id, status, score } = req.body;
  if (!project_id || !status) return res.status(400).json({ error: 'project_id and status required' });
  if (!['in_progress','completed'].includes(status)) {
    return res.status(400).json({ error: 'status must be in_progress or completed' });
  }
  db.prepare(`
    INSERT INTO progress (user_id, project_id, status, score, started_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(user_id, project_id) DO UPDATE SET
      status = excluded.status,
      score = COALESCE(excluded.score, progress.score),
      updated_at = datetime('now')
  `).run(req.session.userId, project_id, status, score ?? null);
  logEvent(req.session.userId, project_id, status === 'completed' ? 'project_completed' : 'project_progress',
           score ? { score } : null);
  res.json({ ok: true });
});

app.get('/api/dashboard', requireAuth, (req, res) => {
  const totals = db.prepare('SELECT COUNT(*) AS total FROM projects').get().total;
  const summary = db.prepare(`
    SELECT
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END)   AS completed,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
      AVG(score)                                            AS avg_score
    FROM progress WHERE user_id = ?
  `).get(req.session.userId);
  const recent = db.prepare(`
    SELECT p.id, p.title, p.tier, pr.status, pr.score, pr.updated_at
    FROM progress pr JOIN projects p ON p.id = pr.project_id
    WHERE pr.user_id = ?
    ORDER BY pr.updated_at DESC LIMIT 5
  `).all(req.session.userId);
  const tierStats = db.prepare(`
    SELECT p.tier,
           COUNT(p.id) AS total,
           SUM(CASE WHEN pr.status='completed' THEN 1 ELSE 0 END) AS completed
    FROM projects p
    LEFT JOIN progress pr ON pr.project_id = p.id AND pr.user_id = ?
    GROUP BY p.tier ORDER BY p.tier
  `).all(req.session.userId);
  res.json({
    total_projects: totals,
    completed: summary.completed || 0,
    in_progress: summary.in_progress || 0,
    avg_score: summary.avg_score ? Math.round(summary.avg_score) : null,
    recent, tierStats
  });
});

// ---------- Teacher / Admin API ----------
app.get('/api/teacher/students', requireRole('teacher','admin'), (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.full_name, u.email, u.grade_level, u.created_at,
           COUNT(pr.id) AS attempted,
           SUM(CASE WHEN pr.status='completed' THEN 1 ELSE 0 END) AS completed,
           AVG(pr.score) AS avg_score
    FROM users u
    LEFT JOIN progress pr ON pr.user_id = u.id
    WHERE u.role = 'student'
    GROUP BY u.id ORDER BY u.created_at DESC
  `).all();
  res.json(rows);
});

app.get('/api/teacher/student/:id', requireRole('teacher','admin'), (req, res) => {
  const u = db.prepare('SELECT id, full_name, email, grade_level, created_at FROM users WHERE id = ?')
              .get(req.params.id);
  if (!u) return res.status(404).json({ error: 'not found' });
  const prog = db.prepare(`
    SELECT pr.*, p.title, p.tier, p.ordinal
    FROM progress pr JOIN projects p ON p.id = pr.project_id
    WHERE pr.user_id = ? ORDER BY p.tier, p.ordinal
  `).all(req.params.id);
  const log = db.prepare(`
    SELECT * FROM sessions_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(req.params.id);
  res.json({ user: u, progress: prog, log });
});

// ---------- Static + page routes ----------
app.use(express.static(path.join(__dirname, 'public')));

// Authenticated wrapper around the integrated project HTMLs.
// Renders a frame with the project HTML inside, plus a "Mark complete" bar.
app.get('/learn/:id', requireAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).send('Project not found');
  // Mark in_progress on first view
  db.prepare(`
    INSERT INTO progress (user_id, project_id, status) VALUES (?, ?, 'in_progress')
    ON CONFLICT(user_id, project_id) DO NOTHING
  `).run(req.session.userId, p.id);
  logEvent(req.session.userId, p.id, 'project_opened');

  res.send(`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><title>${escapeHtml(p.title)} — MathCode</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/css/styles.css">
</head><body class="learn-shell">
<header class="learn-bar">
  <a href="/dashboard.html" class="back">← Dashboard</a>
  <div class="learn-title">
    <span class="tier-pill tier-${p.tier}">Tier ${p.tier} · ${escapeHtml(p.grade_band)}</span>
    <strong>${escapeHtml(p.title)}</strong>
    <span class="muted">${escapeHtml(p.subtitle)}</span>
  </div>
  <div class="learn-actions">
    <button id="complete-btn" class="btn primary">Mark complete</button>
  </div>
</header>
<iframe class="learn-frame" src="/${p.file_path}" title="${escapeHtml(p.title)}"></iframe>
<script>
  document.getElementById('complete-btn').addEventListener('click', async () => {
    const score = prompt('Optional: enter a self-assessed score 0-100, or leave blank.');
    const body = { project_id: ${JSON.stringify(p.id)}, status: 'completed' };
    if (score && !isNaN(Number(score))) body.score = Number(score);
    const r = await fetch('/api/progress', { method:'POST',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (r.ok) { alert('Marked complete!'); window.location='/dashboard.html'; }
    else { alert('Could not save progress.'); }
  });
</script>
</body></html>`);
});

function escapeHtml(s) { return String(s).replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Default route
app.get('/', (_req, res) => res.redirect('/index.html'));

app.listen(PORT, () => {
  console.log(`MathCode Platform running at http://localhost:${PORT}`);
});
