const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
require('./db');
const {
  userRepository,
  areaRepository,
  projectRepository,
  projectActivityRepository,
  taskRepository,
  creativeContentRepository,
  creativeTaskRepository,
  requestRepository
} = require('./repositories');

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

function currentUserName(req) {
  const u = req.session.userId ? userRepository.findPublicById(req.session.userId) : null;
  return u ? u.name : null;
}

function isAdmin(req) {
  return req.session.role === 'admin';
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'No autorizado' });
  next();
}

function isProjectMember(project, userId) {
  return !!project && project.users.some((u) => u.id === userId);
}

// ---------- Auth ----------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Faltan credenciales' });
  const user = userRepository.findByEmail(email);
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
  res.json(userRepository.findPublicById(req.session.userId));
});

// ---------- Users ----------
// GET stays open to any authenticated user: other views (tasks, projects, creative)
// resolve assignee names and populate "responsable" selects from this list. Only
// the management actions (and the Usuarios page itself) are admin-only.
app.get('/api/users', requireAuth, (req, res) => {
  res.json(userRepository.findAllWithDetails());
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { name, email, password, role, areas = [], projects = [] } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    const uid = userRepository.create({ name, email, passwordHash, role });
    userRepository.addAreas(uid, areas);
    userRepository.addProjects(uid, projects);
    res.json({ id: uid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { name, email, password, role, areas = [], projects = [] } = req.body || {};
  const id = req.params.id;
  try {
    const passwordHash = password && password.length > 0 ? bcrypt.hashSync(password, 10) : null;
    userRepository.update(id, { name, email, passwordHash, role });
    userRepository.setAreas(id, areas);
    userRepository.setProjects(id, projects);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  userRepository.remove(req.params.id);
  res.json({ ok: true });
});

// ---------- Areas ----------
// Admin-only: area management is not visible or reachable for regular users.
app.get('/api/areas', requireAuth, requireAdmin, (req, res) => {
  res.json(areaRepository.findAllWithUsers());
});

app.post('/api/areas', requireAuth, requireAdmin, (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const id = areaRepository.create({ name, description });
  res.json({ id });
});

app.put('/api/areas/:id', requireAuth, requireAdmin, (req, res) => {
  const { name, description } = req.body || {};
  areaRepository.update(req.params.id, { name, description });
  res.json({ ok: true });
});

app.delete('/api/areas/:id', requireAuth, requireAdmin, (req, res) => {
  areaRepository.remove(req.params.id);
  res.json({ ok: true });
});

// ---------- Projects ----------
// Non-admin users only see projects they're personally assigned to.
app.get('/api/projects', requireAuth, (req, res) => {
  let projects = projectRepository.findAllWithDetails();
  if (!isAdmin(req)) projects = projects.filter((p) => isProjectMember(p, req.session.userId));
  res.json(projects);
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
  const project = projectRepository.findById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
  if (!isAdmin(req) && !isProjectMember(project, req.session.userId)) {
    return res.status(404).json({ error: 'Proyecto no encontrado' });
  }
  res.json(project);
});

app.get('/api/projects/:id/activity', requireAuth, (req, res) => {
  if (!isAdmin(req)) {
    const project = projectRepository.findById(req.params.id);
    if (!isProjectMember(project, req.session.userId)) return res.status(404).json({ error: 'Proyecto no encontrado' });
  }
  res.json(projectActivityRepository.findByProject(req.params.id));
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
    category,
    brand,
    users = []
  } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  if (category === 'Marca' && !brand) return res.status(400).json({ error: 'Selecciona la marca' });
  try {
    const code = projectRepository.nextCode();
    const pid = projectRepository.create({
      code,
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
      category,
      brand
    });
    projectRepository.addUsers(pid, users);
    projectActivityRepository.log(pid, 'Proyecto creado', currentUserName(req));
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
    category,
    brand,
    users = []
  } = req.body || {};
  const id = req.params.id;
  if (category === 'Marca' && !brand) return res.status(400).json({ error: 'Selecciona la marca' });

  // If trying to move status away from Planificado, check dependency
  if (status && status !== 'Planificado' && depends_on_id) {
    const dep = projectRepository.findStatusById(depends_on_id);
    if (dep && dep.status !== 'Completado') {
      return res.status(400).json({ error: 'No se puede iniciar: el proyecto del que depende no está completado.' });
    }
  }

  const before = projectRepository.findRawById(id);
  if (!before) return res.status(404).json({ error: 'Proyecto no encontrado' });

  try {
    projectRepository.update(id, {
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
      category,
      brand
    });
    projectRepository.setUsers(id, users);

    const userName = currentUserName(req);
    if (status && status !== before.status) {
      projectActivityRepository.log(id, `Estado: "${before.status}" → "${status}"`, userName);
    }
    const newBudget = Number(budget) || 0;
    if (newBudget !== Number(before.budget)) {
      projectActivityRepository.log(
        id,
        `Presupuesto: $${Number(before.budget || 0).toLocaleString()} → $${newBudget.toLocaleString()}`,
        userName
      );
    }
    const newCategory = category || null;
    const newBrand = newCategory === 'Marca' ? brand || null : null;
    if (newCategory !== before.category || newBrand !== before.brand) {
      const label = newCategory === 'Marca' ? `Marca (${newBrand})` : newCategory === 'Innovación' ? 'Innovación' : 'Sin clasificar';
      projectActivityRepository.log(id, `Clasificación cambiada a: ${label}`, userName);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  projectRepository.remove(req.params.id);
  res.json({ ok: true });
});

// ---------- Tasks ----------
// Non-admins see only tasks assigned to them — except when browsing a
// specific project they're a member of, where they see that project's
// whole task board (needed for the project ficha and team collaboration).
app.get('/api/tasks', requireAuth, (req, res) => {
  const { project_id, from, to } = req.query;
  let user_id = req.query.user_id;
  if (!isAdmin(req)) {
    if (project_id) {
      const project = projectRepository.findById(project_id);
      if (!isProjectMember(project, req.session.userId)) return res.status(404).json({ error: 'Proyecto no encontrado' });
    } else {
      user_id = req.session.userId;
    }
  }
  res.json(taskRepository.findAll({ project_id, user_id, from, to }));
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const { project_id, name, objective, specifications, assigned_date, due_date, user_id, status, budget, role } =
    req.body || {};
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  // Check project dependency
  if (project_id) {
    const pr = projectRepository.findDependencyById(project_id);
    if (pr && pr.depends_on_id) {
      const dep = projectRepository.findStatusById(pr.depends_on_id);
      if (dep && dep.status !== 'Completado') {
        return res.status(400).json({ error: 'El proyecto depende de otro no completado.' });
      }
    }
  }
  const id = taskRepository.create({
    project_id,
    name,
    objective,
    specifications,
    assigned_date,
    due_date,
    user_id,
    status,
    budget,
    role
  });
  if (project_id) projectActivityRepository.log(project_id, `Tarea creada: "${name}"`, currentUserName(req));
  res.json({ id });
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const { project_id, name, objective, specifications, assigned_date, due_date, user_id, status, budget, role } =
    req.body || {};
  const before = taskRepository.findById(req.params.id);
  taskRepository.update(req.params.id, {
    project_id,
    name,
    objective,
    specifications,
    assigned_date,
    due_date,
    user_id,
    status,
    budget,
    role
  });
  if (project_id && before && status && status !== before.status) {
    projectActivityRepository.log(project_id, `Tarea "${name}": estado "${before.status}" → "${status}"`, currentUserName(req));
  }
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const task = taskRepository.findById(req.params.id);
  taskRepository.remove(req.params.id);
  if (task && task.project_id) {
    projectActivityRepository.log(task.project_id, `Tarea eliminada: "${task.name}"`, currentUserName(req));
  }
  res.json({ ok: true });
});

// ---------- Creative Content ----------
app.get('/api/creative/content', requireAuth, (req, res) => {
  const { brand, status, network } = req.query;
  res.json(creativeContentRepository.findAll({ brand, status, network }));
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
    status,
    user_id
  } = req.body || {};
  if (!brand) return res.status(400).json({ error: 'Marca requerida' });
  const id = creativeContentRepository.create({
    brand,
    publish_date,
    publish_time,
    objective,
    topic,
    format,
    networks,
    copy,
    design_notes,
    file_link,
    status,
    user_id
  });
  res.json({ id });
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
    status,
    user_id
  } = req.body || {};
  creativeContentRepository.update(req.params.id, {
    brand,
    publish_date,
    publish_time,
    objective,
    topic,
    format,
    networks,
    copy,
    design_notes,
    file_link,
    status,
    user_id
  });
  res.json({ ok: true });
});

app.delete('/api/creative/content/:id', requireAuth, (req, res) => {
  creativeContentRepository.remove(req.params.id);
  res.json({ ok: true });
});

// ---------- Creative Tasks ----------
app.get('/api/creative/tasks', requireAuth, (req, res) => {
  res.json(creativeTaskRepository.findAll());
});

app.post('/api/creative/tasks', requireAuth, (req, res) => {
  const { name, objective, specifications, assigned_date, due_date, user_id, status } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const id = creativeTaskRepository.create({ name, objective, specifications, assigned_date, due_date, user_id, status });
  res.json({ id });
});

app.put('/api/creative/tasks/:id', requireAuth, (req, res) => {
  const { name, objective, specifications, assigned_date, due_date, user_id, status } = req.body || {};
  creativeTaskRepository.update(req.params.id, { name, objective, specifications, assigned_date, due_date, user_id, status });
  res.json({ ok: true });
});

app.delete('/api/creative/tasks/:id', requireAuth, (req, res) => {
  creativeTaskRepository.remove(req.params.id);
  res.json({ ok: true });
});

// ---------- Content Requests (external, no auth) ----------
app.post('/api/requests', (req, res) => {
  const { request_type, subtype, payload, requester_name, requester_position, requester_email, scheduled_date } =
    req.body || {};
  if (!requester_name || !requester_email || !request_type)
    return res.status(400).json({ error: 'Datos obligatorios faltantes' });
  const id = requestRepository.create({
    request_type,
    subtype,
    payload,
    requester_name,
    requester_position,
    requester_email,
    scheduled_date
  });
  res.json({ id, ok: true });
});

app.get('/api/requests', requireAuth, (req, res) => {
  res.json(requestRepository.findAll());
});

app.put('/api/requests/:id', requireAuth, (req, res) => {
  const { status } = req.body || {};
  requestRepository.updateStatus(req.params.id, status);
  res.json({ ok: true });
});

app.delete('/api/requests/:id', requireAuth, (req, res) => {
  requestRepository.remove(req.params.id);
  res.json({ ok: true });
});

// ---------- Dashboard ----------
// Admins get the organization-wide executive view. Everyone else gets a
// personal view scoped to their own assigned projects and tasks.
app.get('/api/dashboard', requireAuth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  if (isAdmin(req)) {
    return res.json({
      scope: 'admin',
      active: projectRepository.countActive(),
      completed: projectRepository.countCompleted(),
      total: projectRepository.countAll(),
      overdueTasks: taskRepository.countOverdue(today),
      pendingTasks: taskRepository.countPending(),
      totalUsers: userRepository.countAll(),
      totalAreas: areaRepository.countAll(),
      contentThisMonth: creativeContentRepository.countThisMonth(today.slice(0, 7)),
      projectsProgress: projectRepository.topProgress(10)
    });
  }

  const uid = req.session.userId;
  const myProjects = projectRepository.findAllWithDetails().filter((p) => isProjectMember(p, uid));
  const myTasks = taskRepository.findAll({ user_id: uid });
  res.json({
    scope: 'personal',
    active: myProjects.filter((p) => p.status === 'En curso' || p.status === 'Planificado').length,
    completed: myProjects.filter((p) => p.status === 'Completado').length,
    total: myProjects.length,
    overdueTasks: myTasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'Completada').length,
    pendingTasks: myTasks.filter((t) => t.status !== 'Completada').length,
    totalUsers: userRepository.countAll(),
    totalAreas: areaRepository.countAll(),
    contentThisMonth: creativeContentRepository.countThisMonth(today.slice(0, 7)),
    projectsProgress: myProjects
      .slice()
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 10)
      .map((p) => ({ id: p.id, code: p.code, name: p.name, status: p.status, total: p.tasks_total, done: p.tasks_done, progress: p.progress }))
  });
});

// Fallback: serve index for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`EC Proyect running at http://localhost:${PORT}`);
});
