function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_areas (
      user_id INTEGER NOT NULL,
      area_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, area_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (depends_on_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS user_projects (
      user_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, project_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      name TEXT NOT NULL,
      objective TEXT,
      specifications TEXT,
      assigned_date TEXT,
      due_date TEXT,
      user_id INTEGER,
      status TEXT DEFAULT 'Pendiente',
      budget REAL DEFAULT 0,
      role TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS creative_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL CHECK (brand IN ('SC Transportes','SC Tours','Olros')),
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS creative_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      objective TEXT,
      specifications TEXT,
      assigned_date TEXT,
      due_date TEXT,
      user_id INTEGER,
      status TEXT DEFAULT 'Pendiente',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS content_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_type TEXT NOT NULL,
      subtype TEXT,
      payload TEXT,
      requester_name TEXT NOT NULL,
      requester_position TEXT,
      requester_email TEXT NOT NULL,
      scheduled_date TEXT,
      status TEXT DEFAULT 'Recibida',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

module.exports = { createSchema };
