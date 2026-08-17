const db = require('../db');

function log(projectId, description, userName) {
  db.prepare('INSERT INTO project_activity (project_id, description, user_name) VALUES (?, ?, ?)').run(
    projectId,
    description,
    userName || null
  );
}

function findByProject(projectId) {
  return db
    .prepare('SELECT * FROM project_activity WHERE project_id = ? ORDER BY created_at DESC, id DESC')
    .all(projectId);
}

module.exports = { log, findByProject };
