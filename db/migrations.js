// One-off migrations for databases created before a schema change.
// createSchema() uses CREATE TABLE IF NOT EXISTS, so changes to CHECK
// constraints have no effect on tables that already exist — this runs
// first to rebuild them when needed.

function migrateCreativeContentBrands(db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='creative_content'").get();
  if (!table) return; // will be created fresh by createSchema with the new constraint
  if (!table.sql.includes("'SC Transportes'")) return; // already up to date

  const { c: count } = db.prepare('SELECT COUNT(*) AS c FROM creative_content').get();
  if (count > 0) {
    throw new Error(
      'No se pudo migrar creative_content a las nuevas marcas (EC Transportes/EC Tours/All Roads): ' +
        'la tabla ya contiene datos con el esquema de marcas anterior. Resuelve manualmente antes de desplegar.'
    );
  }
  db.exec('DROP TABLE creative_content');
}

function runMigrations(db) {
  migrateCreativeContentBrands(db);
}

module.exports = { runMigrations };
