const db = require('../db');

function create({ request_type, subtype, payload, requester_name, requester_position, requester_email, scheduled_date }) {
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
  return info.lastInsertRowid;
}

function findAll() {
  const rows = db.prepare('SELECT * FROM content_requests ORDER BY created_at DESC').all();
  rows.forEach((r) => {
    try {
      r.payload = JSON.parse(r.payload || '{}');
    } catch (e) {
      r.payload = {};
    }
  });
  return rows;
}

function updateStatus(id, status) {
  db.prepare('UPDATE content_requests SET status = ? WHERE id = ?').run(status || 'Recibida', id);
}

function remove(id) {
  db.prepare('DELETE FROM content_requests WHERE id = ?').run(id);
}

module.exports = { create, findAll, updateStatus, remove };
