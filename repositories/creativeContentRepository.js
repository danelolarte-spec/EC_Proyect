const db = require('../db');

function findAll({ brand, status, network } = {}) {
  let q = `SELECT c.*, u.name AS user_name FROM creative_content c LEFT JOIN users u ON u.id = c.user_id WHERE 1=1`;
  const params = [];
  if (brand) {
    q += ' AND c.brand = ?';
    params.push(brand);
  }
  if (status) {
    q += ' AND c.status = ?';
    params.push(status);
  }
  if (network) {
    q += ' AND c.networks LIKE ?';
    params.push('%"' + network + '"%');
  }
  q += ' ORDER BY c.publish_date ASC, c.publish_time ASC';
  return db.prepare(q).all(...params);
}

function findById(id) {
  return db
    .prepare('SELECT c.*, u.name AS user_name FROM creative_content c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?')
    .get(id);
}

function create({ brand, publish_date, publish_time, objective, topic, format, networks, copy, design_notes, file_link, status, user_id }) {
  const info = db
    .prepare(
      `INSERT INTO creative_content (brand, publish_date, publish_time, objective, topic, format, networks, copy, design_notes, file_link, status, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      brand,
      publish_date || null,
      publish_time || null,
      objective || null,
      topic || '',
      format || null,
      JSON.stringify(networks || []),
      copy || '',
      design_notes || '',
      file_link || '',
      status || 'Preproducción',
      user_id || null
    );
  return info.lastInsertRowid;
}

function update(id, { brand, publish_date, publish_time, objective, topic, format, networks, copy, design_notes, file_link, status, user_id }) {
  db.prepare(
    `UPDATE creative_content SET brand=?, publish_date=?, publish_time=?, objective=?, topic=?, format=?, networks=?,
     copy=?, design_notes=?, file_link=?, status=?, user_id=? WHERE id=?`
  ).run(
    brand,
    publish_date || null,
    publish_time || null,
    objective || null,
    topic || '',
    format || null,
    JSON.stringify(networks || []),
    copy || '',
    design_notes || '',
    file_link || '',
    status || 'Preproducción',
    user_id || null,
    id
  );
}

function remove(id) {
  db.prepare('DELETE FROM creative_content WHERE id = ?').run(id);
}

function countThisMonth(yearMonth) {
  return db.prepare("SELECT COUNT(*) AS c FROM creative_content WHERE substr(publish_date,1,7) = ?").get(yearMonth).c;
}

module.exports = { findAll, findById, create, update, remove, countThisMonth };
