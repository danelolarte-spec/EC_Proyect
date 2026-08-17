const db = require('../db');

function attachAreasAndProjects(user) {
  user.areas = db
    .prepare('SELECT a.id, a.name FROM areas a JOIN user_areas ua ON ua.area_id = a.id WHERE ua.user_id = ?')
    .all(user.id);
  user.projects = db
    .prepare('SELECT p.id, p.name FROM projects p JOIN user_projects up ON up.project_id = p.id WHERE up.user_id = ?')
    .all(user.id);
  return user;
}

function findAllWithDetails() {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY name').all();
  return users.map(attachAreasAndProjects);
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findPublicById(id) {
  return db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(id);
}

function create({ name, email, passwordHash, role }) {
  const info = db
    .prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run(name, email, passwordHash, role || 'user');
  return info.lastInsertRowid;
}

function update(id, { name, email, passwordHash, role }) {
  if (passwordHash) {
    db.prepare('UPDATE users SET name = ?, email = ?, password = ?, role = ? WHERE id = ?').run(
      name,
      email,
      passwordHash,
      role || 'user',
      id
    );
  } else {
    db.prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?').run(name, email, role || 'user', id);
  }
}

function remove(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

function setAreas(userId, areaIds) {
  db.prepare('DELETE FROM user_areas WHERE user_id = ?').run(userId);
  const ins = db.prepare('INSERT INTO user_areas (user_id, area_id) VALUES (?, ?)');
  areaIds.forEach((a) => ins.run(userId, a));
}

function setProjects(userId, projectIds) {
  db.prepare('DELETE FROM user_projects WHERE user_id = ?').run(userId);
  const ins = db.prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)');
  projectIds.forEach((p) => ins.run(userId, p));
}

function addAreas(userId, areaIds) {
  const ins = db.prepare('INSERT INTO user_areas (user_id, area_id) VALUES (?, ?)');
  areaIds.forEach((a) => ins.run(userId, a));
}

function addProjects(userId, projectIds) {
  const ins = db.prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)');
  projectIds.forEach((p) => ins.run(userId, p));
}

function countAll() {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
}

module.exports = {
  findAllWithDetails,
  findByEmail,
  findPublicById,
  create,
  update,
  remove,
  setAreas,
  setProjects,
  addAreas,
  addProjects,
  countAll
};
