const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ec-proyect-secret-key-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }
  })
);

app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  next();
}

function nextProjectCode() {
  const row = db.prepare("SELECT code FROM projects ORDER BY id DESC LIMIT 1").get();
  if (!row) return 'PRY-0001';
  const n = parseInt(row.code.split('-')[1] || '0', 10) + 1;
  return 'PRY-' + String(n).padStart(4, '0');
}

// ---------- Auth ----------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Faltan credenciales' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Credenciales inválidas' });
  req.session.userId = user.id;
  req.session.role = user.role;
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json(null);
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.userId);
  res.json(user);
});

// ---------- Users ----------
app.get('/api/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY name').all();
  users.forEach((u) => {
    u.areas = db
      .prepare('SELECT a.id, a.name FROM areas a JOIN user_areas ua ON ua.area_id = a.id WHERE ua.user_id = ?')
      .all(u.id);
    u.projects = db
      .prepare('SELECT p.id, p.name FROM projects p JOIN user_projects up ON up.project_id = p.id WHERE up.user_id = ?')
      .all(u.id);
  });
  res.json(users);
});

app.post('/api/users', requireAuth, (req, res) => {
  const { name, email, password, role, areas = [], projects = [] } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
      .run(name, email, hash, role || 'user');
    const uid = info.lastInsertRowid;
    const insA = db.prepare('INSERT INTO user_areas (user_id, area_id) VALUES (?, ?)');
    areas.forEach((a) => insA.run(uid, a));
    const insP = db.prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)');
    projects.forEach((p) => insP.run(uid, p));
    res.json({ id: uid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/users/:id', requireAuth, (req, res) => {
  const { name, email, password, role, areas = [], projects = [] } = req.body || {};
  const id = req.params.id;
  try {
    if (password && password.length > 0) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET name = ?, email = ?, password = ?, role = ? WHERE id = ?').run(
        name,
        email,
        hash,
        role || 'user',
        id
      );
    } else {
      db.prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?').run(name, email, role || 'user', id);
    }
    db.prepare('DELETE FROM user_areas WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM user_projects WHERE user_id = ?').run(id);
    const insA = db.prepare('INSERT INTO user_areas (user_id, area_id) VALUES (?, ?)');
    areas.forEach((a) => insA.run(id, a));
    const insP = db.prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)');
    projects.forEach((p) => insP.run(id, p));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/users/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Areas ----------
app.get('/api/areas', requireAuth, (req, res) => {
  const areas = db.prepare('SELECT * FROM areas ORDER BY name').all();
  areas.forEach((a) => {
    a.users = db
      .prepare('SELECT u.id, u.name FROM users u JOIN user_areas ua ON ua.user_id = u.id WHERE ua.area_id = ?')
      .all(a.id);
  });
  res.json(areas);
});

app.post('/api/areas', requireAuth, (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const info = db.prepare('INSERT INTO areas (name, description) VALUES (?, ?)').run(name, description || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/areas/:id', requireAuth, (req, res) => {
  const { name, description } = req.body || {};
  db.prepare('UPDATE areas SET name = ?, description = ? WHERE id = ?').run(name, description || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/areas/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM areas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Projects ----------
app.get('/api/projects', requireAuth, (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  projects.forEach((p) => {
    p.users = db
      .prepare('SELECT u.id, u.name FROM users u JOIN user_projects up ON up.user_id = u.id WHERE up.project_id = ?')
      .all(p.id);
    p.tasks_total = db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE project_id = ?').get(p.id).c;
    p.tasks_done = db
      .prepare("SELECT COUNT(*) AS c FROM tasks WHERE project_id = ? AND status = 'Completada'")
      .get(p.id).c;
    p.progress = p.tasks_total > 0 ? Math.round((p.tasks_done / p.tasks_total) * 100) : 0;
    if (p.depends_on_id) {
      const dep = db.prepare('SELECT id, name, status FROM projects WHERE id = ?').get(p.depends_on_id);
      p.depends_on = dep;
      p.can_start = dep && dep.status === 'Completado';
    } else {
      p.can_start = true;
    }
  });
  res.json(projects);
});

app.post('/api/projects', requireAuth, (req, res) => {
  const {
    name,
    objective,
    description,
    process_type,
    impact,
    effort,
    depends_on_id,
    budget,
    status,
    start_date,
    end_date,
    users = []
  } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const code = nextProjectCode();
    const info = db
      .prepare(
        `INSERT INTO projects (code, name, objective, description, process_type, impact, effort, depends_on_id, budget, status, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        name,
        objective || '',
        description || '',
        process_type || null,
        impact || null,
        effort || null,
        depends_on_id || null,
        budget || 0,
        status || 'Planificado',
        start_date || null,
        end_date || null
      );
    const pid = info.lastInsertRowid;
    const ins = db.prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)');
    users.forEach((u) => ins.run(u, pid));
    res.json({ id: pid, code });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/projects/:id', requireAuth, (req, res) => {
  const {
    name,
    objective,
    description,
    process_type,
    impact,
    effort,
    depends_on_id,
    budget,
    status,
    start_date,
    end_date,
    users = []
  } = req.body || {};
  const id = req.params.id;

  // If trying to move status away from Planificado, check dependency
  if (status && status !== 'Planificado' && depends_on_id) {
    const dep = db.prepare('SELECT status FROM projects WHERE id = ?').get(depends_on_id);
    if (dep && dep.status !== 'Completado') {
      return res.status(400).json({ error: 'No se puede iniciar: el proyecto del que depende no está completado.' });
    }
  }

  try {
    db.prepare(
      `UPDATE projects SET name=?, objective=?, description=?, process_type=?, impact=?, effort=?,
       depends_on_id=?, budget=?, status=?, start_date=?, end_date=? WHERE id=?`
    ).run(
      name,
      objective || '',
      description || '',
      process_type || null,
      impact || null,
      effort || null,
      depends_on_id || null,
      budget || 0,
      status || 'Planificado',
      start_date || null,
      end_date || null,
      id
    );
    db.prepare('DELETE FROM user_projects WHERE project_id = ?').run(id);
    const ins = db.prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)');
    users.forEach((u) => ins.run(u, id));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Tasks ----------
app.get('/api/tasks', requireAuth, (req, res) => {
  const { project_id, user_id, from, to } = req.query;
  let q = `SELECT t.*, p.name AS project_name, p.code AS project_code, u.name AS user_name
           FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
           LEFT JOIN users u ON u.id = t.user_id WHERE 1=1`;
  const params = [];
  if (project_id) {
    q += ' AND t.project_id = ?';
    params.push(project_id);
  }
  if (user_id) {
    q += ' AND t.user_id = ?';
    params.push(user_id);
  }
  if (from) {
    q += ' AND t.due_date >= ?';
    params.push(from);
  }
  if (to) {
    q += ' AND t.due_date <= ?';
    params.push(to);
  }
  q += ' ORDER BY t.due_date ASC';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const { project_id, name, objective, specifications, assigned_date, due_date, user_id, status, budget, role } =
    req.body || {};
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  // Check project dependency
  if (project_id) {
    const pr = db.prepare('SELECT status, depends_on_id FROM projects WHERE id = ?').get(project_id);
    if (pr && pr.depends_on_id) {
      const dep = db.prepare('SELECT status FROM projects WHERE id = ?').get(pr.depends_on_id);
      if (dep && dep.status !== 'Completado') {
        return res.status(400).json({ error: 'El proyecto depende de otro no completado.' });
      }
    }
  }
  const info = db
    .prepare(
      `INSERT INTO tasks (project_id, name, objective, specifications, assigned_date, due_date, user_id, status, budget, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      project_id || null,
      name,
      objective || '',
      specifications || '',
      assigned_date || null,
      due_date || null,
      user_id || null,
      status || 'Pendiente',
      budget || 0,
      role || ''
    );
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const { project_id, name, objective, specifications, assigned_date, due_date, user_id, status, budget, role } =
    req.body || {};
  db.prepare(
    `UPDATE tasks SET project_id=?, name=?, objective=?, specifications=?, assigned_date=?, due_date=?, user_id=?,
     status=?, budget=?, role=? WHERE id=?`
  ).run(
    project_id || null,
    name,
    objective || '',
    specifications || '',
    assigned_date || null,
    due_date || null,
    user_id || null,
    status || 'Pendiente',
    budget || 0,
    role || '',
    req.params.id
  );
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Creative Content ----------
app.get('/api/creative/content', requireAuth, (req, res) => {
  const { brand, status } = req.query;
  let q = 'SELECT * FROM creative_content WHERE 1=1';
  const params = [];
  if (brand) {
    q += ' AND brand = ?';
    params.push(brand);
  }
  if (status) {
    q += ' AND status = ?';
    params.push(status);
  }
  q += ' ORDER BY publish_date ASC, publish_time ASC';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/creative/content', requireAuth, (req, res) => {
  const {
    brand,
    publish_date,
    publish_time,
    objective,
    topic,
    format,
    networks = [],
    copy,
    design_notes,
    file_link,
    status
  } = req.body || {};
  if (!brand) return res.status(400).json({ error: 'Marca requerida' });
  const info = db
    .prepare(
      `INSERT INTO creative_content (brand, publish_date, publish_time, objective, topic, format, networks, copy, design_notes, file_link, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      brand,
      publish_date || null,
      publish_time || null,
      objective || null,
      topic || '',
      format || null,
      JSON.stringify(networks),
      copy || '',
      design_notes || '',
      file_link || '',
      status || 'Preproducción'
    );
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/creative/content/:id', requireAuth, (req, res) => {
  const {
    brand,
    publish_date,
    publish_time,
    objective,
    topic,
    format,
    networks = [],
    copy,
    design_notes,
    file_link,
    status
  } = req.body || {};
  db.prepare(
    `UPDATE creative_content SET brand=?, publish_date=?, publish_time=?, objective=?, topic=?, format=?, networks=?,
     copy=?, design_notes=?, file_link=?, status=? WHERE id=?`
  ).run(
    brand,
    publish_date || null,
    publish_time || null,
    objective || null,
    topic || '',
    format || null,
    JSON.stringify(networks),
    copy || '',
    design_notes || '',
    file_link || '',
    status || 'Preproducción',
    req.params.id
  );
  res.json({ ok: true });
});

app.delete('/api/creative/content/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM creative_content WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Creative Tasks ----------
app.get('/api/creative/tasks', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT ct.*, u.name AS user_name FROM creative_tasks ct
       LEFT JOIN users u ON u.id = ct.user_id ORDER BY ct.due_date ASC`
    )
    .all();
  res.json(rows);
});

app.post('/api/creative/tasks', requireAuth, (req, res) => {
  const { name, objective, specifications, assigned_date, due_date, user_id, status } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const info = db
    .prepare(
      `INSERT INTO creative_tasks (name, objective, specifications, assigned_date, due_date, user_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, objective || '', specifications || '', assigned_date || null, due_date || null, user_id || null, status || 'Pendiente');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/creative/tasks/:id', requireAuth, (req, res) => {
  const { name, objective, specifications, assigned_date, due_date, user_id, status } = req.body || {};
  db.prepare(
    `UPDATE creative_tasks SET name=?, objective=?, specifications=?, assigned_date=?, due_date=?, user_id=?, status=? WHERE id=?`
  ).run(name, objective || '', specifications || '', assigned_date || null, due_date || null, user_id || null, status || 'Pendiente', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/creative/tasks/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM creative_tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Content Requests (external, no auth) ----------
app.post('/api/requests', (req, res) => {
  const { request_type, subtype, payload, requester_name, requester_position, requester_email, scheduled_date } =
    req.body || {};
  if (!requester_name || !requester_email || !request_type)
    return res.status(400).json({ error: 'Datos obligatorios faltantes' });
  const info = db
    .prepare(
      `INSERT INTO content_requests (request_type, subtype, payload, requester_name, requester_position, requester_email, scheduled_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      request_type,
      subtype || null,
      JSON.stringify(payload || {}),
      requester_name,
      requester_position || '',
      requester_email,
      scheduled_date || null
    );
  res.json({ id: info.lastInsertRowid, ok: true });
});

app.get('/api/requests', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM content_requests ORDER BY created_at DESC').all();
  rows.forEach((r) => {
    try {
      r.payload = JSON.parse(r.payload || '{}');
    } catch (e) {
      r.payload = {};
    }
  });
  res.json(rows);
});

app.put('/api/requests/:id', requireAuth, (req, res) => {
  const { status } = req.body || {};
  db.prepare('UPDATE content_requests SET status = ? WHERE id = ?').run(status || 'Recibida', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/requests/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM content_requests WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Dashboard ----------
app.get('/api/dashboard', requireAuth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const active = db.prepare("SELECT COUNT(*) AS c FROM projects WHERE status IN ('En curso','Planificado')").get().c;
  const completed = db.prepare("SELECT COUNT(*) AS c FROM projects WHERE status = 'Completado'").get().c;
  const total = db.prepare('SELECT COUNT(*) AS c FROM projects').get().c;
  const overdueTasks = db
    .prepare("SELECT COUNT(*) AS c FROM tasks WHERE due_date < ? AND status != 'Completada'")
    .get(today).c;
  const pendingTasks = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status != 'Completada'").get().c;
  const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const totalAreas = db.prepare('SELECT COUNT(*) AS c FROM areas').get().c;
  const contentThisMonth = db
    .prepare("SELECT COUNT(*) AS c FROM creative_content WHERE substr(publish_date,1,7) = ?")
    .get(today.slice(0, 7)).c;
  const projectsProgress = db
    .prepare(
      `SELECT p.id, p.code, p.name, p.status,
       (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS total,
       (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'Completada') AS done
       FROM projects p ORDER BY p.created_at DESC LIMIT 10`
    )
    .all()
    .map((p) => ({ ...p, progress: p.total ? Math.round((p.done / p.total) * 100) : 0 }));
  res.json({
    active,
    completed,
    total,
    overdueTasks,
    pendingTasks,
    totalUsers,
    totalAreas,
    contentThisMonth,
    projectsProgress
  });
});

// Fallback: serve index for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`EC Proyect running at http://localhost:${PORT}`);
  console.log('Default login: admin@ecproyect.com / admin123');
});
