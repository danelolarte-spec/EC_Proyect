const db = require('../db');

function nextCode() {
  const row = db.prepare('SELECT code FROM projects ORDER BY id DESC LIMIT 1').get();
  if (!row) return 'PRY-0001';
  const n = parseInt(row.code.split('-')[1] || '0', 10) + 1;
  return 'PRY-' + String(n).padStart(4, '0');
}

function enrich(p) {
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
  return p;
}

function findAllWithDetails() {
  return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all().map(enrich);
}

function findById(id) {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  return p ? enrich(p) : null;
}

function findRawById(id) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

function findStatusById(id) {
  return db.prepare('SELECT status FROM projects WHERE id = ?').get(id);
}

function findDependencyById(id) {
  return db.prepare('SELECT status, depends_on_id FROM projects WHERE id = ?').get(id);
}

function create({
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
}) {
  const info = db
    .prepare(
      `INSERT INTO projects (code, name, objective, description, process_type, impact, effort, depends_on_id, budget, status, start_date, end_date, category, brand)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      end_date || null,
      category || null,
      category === 'Marca' ? brand || null : null
    );
  return info.lastInsertRowid;
}

function update(
  id,
  {
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
  }
) {
  db.prepare(
    `UPDATE projects SET name=?, objective=?, description=?, process_type=?, impact=?, effort=?,
     depends_on_id=?, budget=?, status=?, start_date=?, end_date=?, category=?, brand=? WHERE id=?`
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
    category || null,
    category === 'Marca' ? brand || null : null,
    id
  );
}

function remove(id) {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

function setUsers(projectId, userIds) {
  db.prepare('DELETE FROM user_projects WHERE project_id = ?').run(projectId);
  const ins = db.prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)');
  userIds.forEach((u) => ins.run(u, projectId));
}

function addUsers(projectId, userIds) {
  const ins = db.prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)');
  userIds.forEach((u) => ins.run(u, projectId));
}

function countAll() {
  return db.prepare('SELECT COUNT(*) AS c FROM projects').get().c;
}

function countActive() {
  return db.prepare("SELECT COUNT(*) AS c FROM projects WHERE status IN ('En curso','Planificado')").get().c;
}

function countCompleted() {
  return db.prepare("SELECT COUNT(*) AS c FROM projects WHERE status = 'Completado'").get().c;
}

function topProgress(limit) {
  return db
    .prepare(
      `SELECT p.id, p.code, p.name, p.status,
       (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS total,
       (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'Completada') AS done
       FROM projects p ORDER BY p.created_at DESC LIMIT ?`
    )
    .all(limit)
    .map((p) => ({ ...p, progress: p.total ? Math.round((p.done / p.total) * 100) : 0 }));
}

module.exports = {
  nextCode,
  findAllWithDetails,
  findById,
  findRawById,
  findStatusById,
  findDependencyById,
  create,
  update,
  remove,
  setUsers,
  addUsers,
  countAll,
  countActive,
  countCompleted,
  topProgress
};
