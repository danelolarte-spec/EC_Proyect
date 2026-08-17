const db = require('../db');

function findAll() {
  return db
    .prepare(
      `SELECT ct.*, u.name AS user_name FROM creative_tasks ct
       LEFT JOIN users u ON u.id = ct.user_id ORDER BY ct.due_date ASC`
    )
    .all();
}

function create({ name, objective, specifications, assigned_date, due_date, user_id, status }) {
  const info = db
    .prepare(
      `INSERT INTO creative_tasks (name, objective, specifications, assigned_date, due_date, user_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, objective || '', specifications || '', assigned_date || null, due_date || null, user_id || null, status || 'Pendiente');
  return info.lastInsertRowid;
}

function update(id, { name, objective, specifications, assigned_date, due_date, user_id, status }) {
  db.prepare(
    `UPDATE creative_tasks SET name=?, objective=?, specifications=?, assigned_date=?, due_date=?, user_id=?, status=? WHERE id=?`
  ).run(name, objective || '', specifications || '', assigned_date || null, due_date || null, user_id || null, status || 'Pendiente', id);
}

function remove(id) {
  db.prepare('DELETE FROM creative_tasks WHERE id = ?').run(id);
}

module.exports = { findAll, create, update, remove };
