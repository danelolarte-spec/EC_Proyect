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

function migrateProjectClassification(db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'").get();
  if (!table) return; // will be created fresh by createSchema with the new columns
  const columns = db.prepare('PRAGMA table_info(projects)').all().map((c) => c.name);
  if (!columns.includes('category')) {
    db.exec("ALTER TABLE projects ADD COLUMN category TEXT CHECK (category IN ('Marca','Innovación'))");
  }
  if (!columns.includes('brand')) {
    db.exec("ALTER TABLE projects ADD COLUMN brand TEXT CHECK (brand IN ('EC Transportes','EC Tours','All Roads'))");
  }
}

// Adds 'EC Group' as an allowed creative_content.brand and a user_id
// (responsable) column. SQLite can't ALTER a CHECK constraint in place,
// so this rebuilds the table — unlike the earlier brand migration, this
// one preserves existing rows (real content may exist by now).
function migrateCreativeContentEcGroupAndOwner(db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='creative_content'").get();
  if (!table) return; // will be created fresh by createSchema with the new shape
  const columns = db.prepare('PRAGMA table_info(creative_content)').all().map((c) => c.name);
  const hasEcGroup = table.sql.includes("'EC Group'");
  const hasUserId = columns.includes('user_id');
  if (hasEcGroup && hasUserId) return; // already up to date

  const rebuild = db.transaction(() => {
    db.exec(`
      CREATE TABLE creative_content_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand TEXT NOT NULL CHECK (brand IN ('EC Group','EC Transportes','EC Tours','All Roads')),
        publish_date TEXT,
        publish_time TEXT,
        objective TEXT CHECK (objective IN ('Promocional','Informativo','Entretenimiento','Conexión')),
        topic TEXT,
        format TEXT CHECK (format IN ('Foto','Pieza','Historia','Reels','Carrusel')),
        networks TEXT,
        copy TEXT,
        design_notes TEXT,
        file_link TEXT,
        status TEXT CHECK (status IN ('Preproducción','Producción','Diseño','Publicación','Archivado','Pendiente de autorización')) DEFAULT 'Preproducción',
        user_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    const insertCols = ['id', 'brand', 'publish_date', 'publish_time', 'objective', 'topic', 'format', 'networks', 'copy', 'design_notes', 'file_link', 'status', 'created_at'];
    if (hasUserId) insertCols.push('user_id');
    const colList = insertCols.join(', ');
    db.exec(`INSERT INTO creative_content_new (${colList}) SELECT ${colList} FROM creative_content;`);
    db.exec('DROP TABLE creative_content;');
    db.exec('ALTER TABLE creative_content_new RENAME TO creative_content;');
  });

  db.pragma('foreign_keys = OFF');
  try {
    rebuild();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

// Adds 'EC Group' as an allowed projects.brand. Same rebuild reasoning as
// above; preserves ids so tasks/user_projects/project_activity foreign
// keys stay valid, and preserves all existing project data.
function migrateProjectsEcGroupBrand(db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'").get();
  if (!table) return; // will be created fresh by createSchema with the new constraint
  if (table.sql.includes("'EC Group'")) return; // already up to date

  const rebuild = db.transaction(() => {
    db.exec(`
      CREATE TABLE projects_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        objective TEXT,
        description TEXT,
        process_type TEXT CHECK (process_type IN ('Estratégico','Misional','Apoyo')),
        impact INTEGER CHECK (impact BETWEEN 1 AND 5),
        effort INTEGER CHECK (effort BETWEEN 1 AND 5),
        depends_on_id INTEGER,
        budget REAL DEFAULT 0,
        status TEXT DEFAULT 'Planificado',
        start_date TEXT,
        end_date TEXT,
        category TEXT CHECK (category IN ('Marca','Innovación')),
        brand TEXT CHECK (brand IN ('EC Group','EC Transportes','EC Tours','All Roads')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (depends_on_id) REFERENCES projects(id) ON DELETE SET NULL
      );
    `);
    const cols = ['id', 'code', 'name', 'objective', 'description', 'process_type', 'impact', 'effort', 'depends_on_id', 'budget', 'status', 'start_date', 'end_date', 'category', 'brand', 'created_at'];
    const colList = cols.join(', ');
    db.exec(`INSERT INTO projects_new (${colList}) SELECT ${colList} FROM projects;`);
    db.exec('DROP TABLE projects;');
    db.exec('ALTER TABLE projects_new RENAME TO projects;');
  });

  db.pragma('foreign_keys = OFF');
  try {
    rebuild();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function runMigrations(db) {
  migrateCreativeContentBrands(db);
  migrateProjectClassification(db);
  migrateProjectsEcGroupBrand(db);
  migrateCreativeContentEcGroupAndOwner(db);
}

module.exports = { runMigrations };
