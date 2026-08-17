const db = require('../db');

function findAll({ brand, status } = {}) {
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
  return db.prepare(q).all(...params);
}

function create({ brand, publish_date, publish_time, objective, topic, format, networks, copy, design_notes, file_link, status }) {
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
      JSON.stringify(networks || []),
      copy || '',
      design_notes || '',
      file_link || '',
      status || 'Preproducción'
    );
  return info.lastInsertRowid;
}

function update(id, { brand, publish_date, publish_time, objective, topic, format, networks, copy, design_notes, file_link, status }) {
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
    JSON.stringify(networks || []),
    copy || '',
    design_notes || '',
    file_link || '',
    status || 'Preproducción',
    id
  );
}

function remove(id) {
  db.prepare('DELETE FROM creative_content WHERE id = ?').run(id);
}

function countThisMonth(yearMonth) {
  return db.prepare("SELECT COUNT(*) AS c FROM creative_content WHERE substr(publish_date,1,7) = ?").get(yearMonth).c;
}

module.exports = { findAll, create, update, remove, countThisMonth };
