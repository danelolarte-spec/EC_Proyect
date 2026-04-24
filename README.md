# EC Proyect — Plataforma de Gestión

Plataforma web integral para la gestión de proyectos, equipos, tareas, áreas organizacionales y contenido creativo, con identidad corporativa basada en los colores `#082633` (azul oscuro) y `#ddc16f` (dorado).

## Módulos

1. **Usuarios y Áreas** — creación, edición, eliminación; asignación múltiple a áreas y proyectos.
2. **Proyectos** — código único automático (`PRY-XXXX`), objetivo, descripción, clasificación de proceso (Estratégico / Misional / Apoyo), impacto y esfuerzo (1-5), dependencias entre proyectos (bloquea el inicio hasta completar el dependiente), presupuesto total y por tarea.
3. **Tareas y Planes de Trabajo** — asignación por proyecto y usuario, filtros por rango de fechas, rol/función y proyecto.
4. **Cronograma** — vista calendario mensual con tareas y publicaciones; vistas Lista y Kanban con drag-and-drop.
5. **Área Creativa (Parrilla)** — contenido para *SC Transportes*, *SC Tours* y *Olros*: fecha/hora, objetivo, tema, formato, redes sociales, copy, indicaciones, link y estado del flujo.
6. **Tareas Creativas** — tareas específicas del área creativa.
7. **Formulario externo** en `/solicitud.html` — sin login, con plantillas predeterminadas (Vacante, Foto corporativa, Firma corporativa, Parrilla de sensibilización) y tipo "Nueva solicitud".
8. **Dashboard** — métricas de proyectos activos, completados, tareas vencidas/pendientes, contenido del mes, y avance por proyecto.
9. **Buscador global** y filtros.

## Stack

- **Backend**: Node.js + Express + SQLite (better-sqlite3) + sesiones.
- **Frontend**: SPA vanilla JavaScript (sin build step) con enrutamiento por hash.
- **Autenticación**: sesión con contraseña hasheada (bcrypt).

## Instalación y ejecución

```bash
npm install
npm start
# Aplicación disponible en http://localhost:3000
```

### Credenciales por defecto

- Correo: `admin@ecproyect.com`
- Contraseña: `admin123`

El primer arranque crea la base de datos `data.sqlite`, el usuario administrador y algunas áreas de ejemplo.

## Estructura del proyecto

```
server.js            # Express server y rutas API
database.js          # Esquema SQLite y seed inicial
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

## Notas

- El `PORT` puede establecerse por variable de entorno (`PORT=8080 npm start`).
- Para producción, cambiar `SESSION_SECRET` por una clave segura.
