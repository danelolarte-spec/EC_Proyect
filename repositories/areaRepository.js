const db = require('../db');

function findAllWithUsers() {
  const areas = db.prepare('SELECT * FROM areas ORDER BY name').all();
  areas.forEach((a) => {
    a.users = db
      .prepare('SELECT u.id, u.name FROM users u JOIN user_areas ua ON ua.user_id = u.id WHERE ua.area_id = ?')
      .all(a.id);
  });
  return areas;
}

function create({ name, description }) {
  const info = db.prepare('INSERT INTO areas (name, description) VALUES (?, ?)').run(name, description || '');
  return info.lastInsertRowid;
}

function update(id, { name, description }) {
  db.prepare('UPDATE areas SET name = ?, description = ? WHERE id = ?').run(name, description || '', id);
}

function remove(id) {
  db.prepare('DELETE FROM areas WHERE id = ?').run(id);
}

function countAll() {
  return db.prepare('SELECT COUNT(*) AS c FROM areas').get().c;
}

module.exports = { findAllWithUsers, create, update, remove, countAll };
