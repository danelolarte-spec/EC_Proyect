const db = require('../db');

function findAll({ project_id, user_id, from, to } = {}) {
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
  return db.prepare(q).all(...params);
}

function create({ project_id, name, objective, specifications, assigned_date, due_date, user_id, status, budget, role }) {
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
  return info.lastInsertRowid;
}

function update(id, { project_id, name, objective, specifications, assigned_date, due_date, user_id, status, budget, role }) {
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
    id
  );
}

function remove(id) {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

function countOverdue(today) {
  return db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE due_date < ? AND status != 'Completada'").get(today).c;
}

function countPending() {
  return db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status != 'Completada'").get().c;
}

module.exports = { findAll, create, update, remove, countOverdue, countPending };
