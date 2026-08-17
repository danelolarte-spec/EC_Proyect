# EC Proyect — Plataforma de Gestión

Plataforma web integral para la gestión de proyectos, equipos, tareas, áreas organizacionales y contenido creativo, con identidad corporativa basada en los colores `#082633` (azul oscuro) y `#ddc16f` (dorado).

## Módulos

1. **Usuarios y Áreas** — creación, edición, eliminación; asignación múltiple a áreas y proyectos.
2. **Proyectos** — código único automático (`PRY-XXXX`), objetivo, descripción, clasificación de proceso (Estratégico / Misional / Apoyo), clasificación por **Marca** (EC Transportes / EC Tours / All Roads) o **Innovación** (con agrupación automática en el listado), impacto y esfuerzo (1-5), dependencias entre proyectos (bloquea el inicio hasta completar el dependiente), presupuesto total y por tarea. Cada proyecto tiene una **ficha de detalle** (`#project/<id>`) con información editable en línea, tareas del proyecto, equipo asignado e historial de actividad.
3. **Tareas y Planes de Trabajo** — asignación por proyecto y usuario, filtros por rango de fechas, rol/función y proyecto.
4. **Cronograma** — vista calendario mensual con tareas y publicaciones; vistas Lista y Kanban con drag-and-drop.
5. **Área Creativa (Parrilla)** — contenido para *EC Transportes*, *EC Tours* y *All Roads*: fecha/hora, objetivo, tema, formato, redes sociales, copy, indicaciones, link y estado del flujo.
6. **Tareas Creativas** — tareas específicas del área creativa.
7. **Formulario externo** en `/solicitud.html` — sin login, con plantillas predeterminadas (Vacante, Foto corporativa, Firma corporativa, Parrilla de sensibilización) y tipo "Nueva solicitud".
8. **Dashboard** — métricas de proyectos activos, completados, tareas vencidas/pendientes, contenido del mes, y avance por proyecto.
9. **Buscador global** y filtros.

## Stack

- **Backend**: Node.js + Express + SQLite (better-sqlite3) + sesiones.
- **Frontend**: SPA vanilla JavaScript (sin build step) con enrutamiento por hash.
- **Autenticación**: sesión con contraseña hasheada (bcrypt).
- **Acceso a datos**: patrón repositorio — las rutas de `server.js` no ejecutan SQL directamente, delegan en los módulos de `repositories/`.

## Instalación y ejecución

```bash
npm install
npm start
# Aplicación disponible en http://localhost:3000
```

El primer arranque crea la base de datos `data.sqlite`, un usuario administrador inicial (ver `db/seed.js`) y algunas áreas de ejemplo. **Cambia esa contraseña (o elimina esa cuenta) desde Usuarios en cuanto tengas un administrador real configurado** — no la dejes con su valor de fábrica en producción.

## Estructura del proyecto

```
server.js            # Express server y rutas API (usa repositories/, sin SQL directo)
db/
  connection.js       # Conexión SQLite (pragmas: WAL, foreign_keys)
  schema.js            # Definición de tablas (CREATE TABLE IF NOT EXISTS)
  seed.js               # Usuario administrador y áreas de ejemplo iniciales
  index.js               # Punto de entrada: conecta, crea esquema y siembra datos
repositories/
  userRepository.js
  areaRepository.js
  projectRepository.js
  taskRepository.js
  creativeContentRepository.js
  creativeTaskRepository.js
  requestRepository.js
  index.js              # Agrupa y exporta todos los repositorios
public/
  index.html         # Login
  app.html           # SPA principal
  solicitud.html     # Formulario externo
  css/styles.css     # Estilos (colores corporativos + responsive)
  js/
    api.js           # Cliente HTTP
    ui.js            # Helpers de UI y modales
    app.js           # Router SPA
    dashboard.js
    users.js
    areas.js
    projects.js
    tasks.js
    calendar.js
    kanban.js
    creative.js
    requests.js
```

## Responsive

La interfaz se adapta a escritorio, tablet y móvil. Sidebar colapsable, tablas con scroll horizontal, calendario ajustado.

## Despliegue en Render

El repositorio incluye `render.yaml` (Blueprint) para desplegar con un clic:

1. Entra a [render.com](https://render.com) e inicia sesión (o crea una cuenta) con GitHub.
2. **New +** → **Blueprint** → selecciona el repositorio `EC_Proyect` y la rama deseada.
3. Render detecta `render.yaml` y crea el servicio web automáticamente (`npm install` + `npm start`), generando `SESSION_SECRET` por ti.
4. Al finalizar el despliegue obtendrás una URL pública tipo `https://ec-proyect.onrender.com`.

**Persistencia de datos**: el servicio corre en el plan `starter` con un disco persistente de 1GB montado en `/var/data` (`DATABASE_PATH=/var/data/data.sqlite`), así que `data.sqlite` sobrevive entre despliegues. El plan `free` no soporta disco persistente — si el servicio se baja a `free`, cada despliegue vuelve a dejar la base de datos vacía (solo el usuario admin por defecto).

## Notas

- El `PORT` puede establecerse por variable de entorno (`PORT=8080 npm start`).
- Para producción, cambiar `SESSION_SECRET` por una clave segura (Render la genera automáticamente vía Blueprint).
- La ruta del archivo SQLite puede configurarse con `DATABASE_PATH` (por defecto usa `data.sqlite` en la raíz del proyecto).
