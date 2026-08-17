#!/usr/bin/env node
// Importa un backup del sistema anterior (JSON con users/projects/tasks/
// contentItems/solicitudes) hacia una instancia de EC Proyect en ejecución,
// usando su API REST pública. Pensado para correrse UNA SOLA VEZ contra una
// base de datos recién creada: no es idempotente — volver a correrlo
// duplicará proyectos y tareas (los usuarios sí están protegidos por el
// email único).
//
// Uso:
//   node scripts/import-backup.js <backup.json> <baseUrl> [adminEmail] [adminPassword]
//
// Ejemplo:
//   node scripts/import-backup.js ./EC_Project_backup_20260817.json https://ec-proyect.onrender.com
//
// Requiere Node.js >= 18 (usa fetch nativo). No tiene dependencias externas.

const fs = require('fs');
const crypto = require('crypto');

const [, , backupPath, baseUrlArg, adminEmailArg, adminPasswordArg] = process.argv;

if (!backupPath || !baseUrlArg) {
  console.error('Uso: node scripts/import-backup.js <backup.json> <baseUrl> [adminEmail] [adminPassword]');
  process.exit(1);
}

const BASE_URL = baseUrlArg.replace(/\/$/, '');
const ADMIN_EMAIL = adminEmailArg || 'admin@ecproyect.com';
const ADMIN_PASSWORD = adminPasswordArg || 'admin123';

const PROJECT_STATUS_MAP = {
  'Pendiente de dependencia': 'Planificado',
  Ejecución: 'En curso',
  Finalizado: 'Completado'
};

const TASK_STATUS_MAP = {
  Completada: 'Completada',
  Pendiente: 'Pendiente',
  'En proceso': 'En progreso',
  Bloqueada: 'Bloqueada'
};

const BRAND_MAP = {
  'ec transportes': 'EC Transportes',
  'ec tours': 'EC Tours',
  'all roads': 'All Roads'
};

const GENERIC_OWNER_NAMES = new Set(['proveedor externo', 'ti externo']);

let cookie = null;
const warnings = [];

function warn(msg) {
  warnings.push(msg);
  console.warn('  ⚠ ' + msg);
}

async function api(method, path, body) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no body */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function parseMoney(str) {
  if (!str) return 0;
  const digits = String(str).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function clamp1to5(n) {
  const v = Math.round(Number(n) || 1);
  return Math.min(5, Math.max(1, v));
}

function normalizeBrand(company) {
  const key = String(company || '').trim().toLowerCase();
  if (BRAND_MAP[key]) return BRAND_MAP[key];
  warn(`Marca "${company}" no reconocida, se usó "EC Transportes" por defecto.`);
  return 'EC Transportes';
}

function randomPassword() {
  return 'Tmp-' + crypto.randomBytes(9).toString('base64url');
}

async function main() {
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  console.log(`Conectando a ${BASE_URL} como ${ADMIN_EMAIL}...`);
  await api('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  console.log('Login OK.\n');

  // ---------- Áreas (a partir de los "dept" de los usuarios del backup) ----------
  console.log('Creando áreas...');
  const depts = [...new Set(backup.users.map((u) => u.dept).filter(Boolean))];
  const areaIdByDept = {};
  for (const dept of depts) {
    const { id } = await api('POST', '/api/areas', { name: dept, description: `${dept} (importado del backup)` });
    areaIdByDept[dept] = id;
    console.log(`  + Área "${dept}" -> id ${id}`);
  }

  // ---------- Usuarios del backup ----------
  console.log('\nCreando usuarios del backup...');
  const userIdByName = {}; // nombre normalizado -> id nuevo
  for (const u of backup.users) {
    try {
      const areas = u.dept && areaIdByDept[u.dept] ? [areaIdByDept[u.dept]] : [];
      const { id } = await api('POST', '/api/users', {
        name: u.name,
        email: u.email,
        password: randomPassword(),
        role: u.role || 'user',
        areas
      });
      userIdByName[u.name.trim().toLowerCase()] = id;
      console.log(`  + ${u.name} <${u.email}> -> id ${id}`);
    } catch (e) {
      warn(`Usuario "${u.name}" (${u.email}) no se pudo crear: ${e.message}`);
    }
  }

  // ---------- Usuarios externos detectados en las tareas (con email real) ----------
  console.log('\nCreando usuarios externos detectados en tareas...');
  const externalCandidates = new Map(); // nombre normalizado -> email
  backup.tasks.forEach((t) => {
    const name = (t.owner || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (userIdByName[key] || GENERIC_OWNER_NAMES.has(key) || externalCandidates.has(key)) return;
    const email = t.ownerEmail || (t.owners || []).find((o) => (o.name || '').trim().toLowerCase() === key)?.email;
    if (email) externalCandidates.set(key, { name, email });
  });
  for (const [key, { name, email }] of externalCandidates) {
    try {
      const { id } = await api('POST', '/api/users', {
        name,
        email,
        password: randomPassword(),
        role: 'user'
      });
      userIdByName[key] = id;
      console.log(`  + ${name} <${email}> -> id ${id}`);
    } catch (e) {
      warn(`Usuario externo "${name}" (${email}) no se pudo crear: ${e.message}`);
    }
  }

  function resolveOwnerId(ownerName) {
    if (!ownerName) return null;
    const key = ownerName.trim().toLowerCase();
    return userIdByName[key] || null;
  }

  // ---------- Proyectos (sin depends_on_id todavía) ----------
  console.log('\nCreando proyectos...');
  const projectIdByCode = {};
  const projectFieldsByCode = {}; // para poder reenviar en el PUT de dependencias
  for (const p of backup.projects) {
    const fields = {
      name: p.name,
      objective: p.obj || '',
      description: (p.tags ? `Tags: ${p.tags}\n\n` : '') + (p.desc || ''),
      process_type: null,
      impact: clamp1to5(p.impTotal),
      effort: clamp1to5(p.effTotal),
      budget: parseMoney(p.budget),
      status: PROJECT_STATUS_MAP[p.status] || 'Planificado',
      start_date: p.start || null,
      end_date: p.end || null
    };
    const leaderId = resolveOwnerId(p.leader);
    try {
      const { id, code } = await api('POST', '/api/projects', { ...fields, users: leaderId ? [leaderId] : [] });
      projectIdByCode[p.id] = id;
      projectFieldsByCode[p.id] = { ...fields, users: leaderId ? [leaderId] : [] };
      console.log(`  + ${p.id} "${p.name}" -> ${code} (id ${id})`);
    } catch (e) {
      warn(`Proyecto "${p.id} - ${p.name}" no se pudo crear: ${e.message}`);
    }
  }

  // ---------- Tareas (ya con project_id resuelto, antes de enlazar dependencias) ----------
  console.log('\nCreando tareas...');
  let taskCount = 0;
  for (const t of backup.tasks) {
    const projectId = projectIdByCode[t.project] || null;
    const ownerId = resolveOwnerId(t.owner);
    let specifications = t.notes || '';
    if (t.owner && !ownerId) {
      specifications = `[Responsable original: ${t.owner}]\n\n${specifications}`;
    }
    const fields = {
      project_id: projectId,
      name: t.name,
      objective: t.obj || '',
      specifications,
      assigned_date: t.assign || null,
      due_date: t.due || null,
      user_id: ownerId,
      status: TASK_STATUS_MAP[t.status] || 'Pendiente',
      budget: parseMoney(t.cost),
      role: ''
    };
    try {
      await api('POST', '/api/tasks', fields);
      taskCount++;
    } catch (e) {
      warn(`Tarea "${t.name}" (proyecto ${t.project}) no se pudo crear: ${e.message}`);
    }
  }
  console.log(`  ${taskCount}/${backup.tasks.length} tareas creadas.`);

  // ---------- Dependencias entre proyectos (después de crear las tareas) ----------
  console.log('\nEnlazando dependencias entre proyectos...');
  for (const p of backup.projects) {
    const deps = (p.deps || []).filter(Boolean);
    if (deps.length === 0) continue;
    const myId = projectIdByCode[p.id];
    const depId = projectIdByCode[deps[0]];
    if (!myId || !depId) continue;
    if (deps.length > 1) {
      warn(`Proyecto "${p.id}" tenía ${deps.length} dependencias en el backup; el sistema solo soporta una, se usó "${deps[0]}".`);
    }
    try {
      await api('PUT', `/api/projects/${myId}`, { ...projectFieldsByCode[p.id], depends_on_id: depId });
      console.log(`  + ${p.id} depende de ${deps[0]}`);
    } catch (e) {
      warn(
        `Proyecto "${p.id}" no se pudo enlazar a su dependencia "${deps[0]}" (regla de negocio: la dependencia no está Completada): ${e.message}. Se dejó sin enlace de dependencia.`
      );
    }
  }

  // ---------- Contenido creativo ----------
  console.log('\nCreando contenido creativo...');
  for (const c of backup.contentItems || []) {
    try {
      const { id } = await api('POST', '/api/creative/content', {
        brand: normalizeBrand(c.company),
        publish_date: c.date || null,
        publish_time: c.time || null,
        objective: null, // "Video / Reel" del backup no corresponde a las categorías del sistema
        topic: c.title || '',
        format: '',
        networks: c.platform ? [c.platform] : [],
        copy: c.copy || '',
        design_notes: c.designNotes || '',
        file_link: c.driveLink || '',
        status: c.status || 'Preproducción'
      });
      console.log(`  + Contenido "${c.title}" -> id ${id}`);
    } catch (e) {
      warn(`Contenido "${c.title}" no se pudo crear: ${e.message}`);
    }
  }

  // ---------- Solicitudes externas ----------
  console.log('\nCreando solicitudes...');
  for (const s of backup.solicitudes || []) {
    try {
      const { id } = await api('POST', '/api/requests', {
        request_type: 'Nueva solicitud',
        subtype: s.type || null,
        payload: {
          title: s.title,
          description: s.description,
          type: s.type,
          company: s.company,
          approvedBy: s.approvedBy,
          approvedDate: s.approvedDate,
          source: s.source
        },
        requester_name: s.requestor,
        requester_position: '',
        requester_email: s.email,
        scheduled_date: s.dateRequired || null
      });
      if (s.status) {
        await api('PUT', `/api/requests/${id}`, { status: s.status });
      }
      console.log(`  + Solicitud "${s.title}" -> id ${id}`);
    } catch (e) {
      warn(`Solicitud "${s.title}" no se pudo crear: ${e.message}`);
    }
  }

  console.log('\n=== Resumen ===');
  console.log(`Áreas: ${depts.length}`);
  console.log(`Usuarios del backup: ${backup.users.length}`);
  console.log(`Usuarios externos creados: ${externalCandidates.size}`);
  console.log(`Proyectos: ${Object.keys(projectIdByCode).length}/${backup.projects.length}`);
  console.log(`Tareas: ${taskCount}/${backup.tasks.length}`);
  console.log(`Contenido creativo: ${(backup.contentItems || []).length}`);
  console.log(`Solicitudes: ${(backup.solicitudes || []).length}`);
  if (warnings.length) {
    console.log(`\n${warnings.length} advertencias (revisa arriba con ⚠).`);
  }
  console.log(
    '\nLos usuarios importados quedaron con contraseñas temporales aleatorias desconocidas.\n' +
      'Entra a Usuarios (como admin) y usa "Editar" para asignarle una contraseña real a cada persona\n' +
      'antes de compartirles el acceso.'
  );
}

main().catch((e) => {
  console.error('\nError fatal:', e.message);
  process.exit(1);
});
