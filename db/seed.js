const bcrypt = require('bcryptjs');

function seed(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;

  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
    'Administrador',
    'admin@ecproyect.com',
    hash,
    'admin'
  );

  const areaIds = [];
  ['Gerencia', 'Operaciones', 'Área Creativa', 'Gestión Humana'].forEach((n) => {
    const r = db.prepare('INSERT INTO areas (name, description) VALUES (?, ?)').run(n, `${n} de la empresa`);
    areaIds.push(r.lastInsertRowid);
  });
  db.prepare('INSERT INTO user_areas (user_id, area_id) VALUES (?, ?)').run(1, areaIds[0]);
}

module.exports = { seed };
