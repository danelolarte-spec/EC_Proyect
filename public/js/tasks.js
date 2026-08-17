async function TasksView(root) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const filterProject = params.get('project') || '';
  const filterUser = params.get('user') || '';

  const [projects, users] = await Promise.all([API.get('/api/projects'), API.get('/api/users')]);

  const query = new URLSearchParams();
  if (filterProject) query.set('project_id', filterProject);
  if (filterUser) query.set('user_id', filterUser);
  const tasks = await API.get('/api/tasks' + (query.toString() ? '?' + query.toString() : ''));

  root.appendChild(
    UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h1', {}, 'Tareas'), UI.el('span', { class: 'hint' }, 'Planes de trabajo y asignaciones')]),
      UI.el('button', { class: 'btn btn-primary', onClick: () => taskForm(null, projects, users) }, '+ Nueva tarea')
    ])
  );

  // Filters
  const projFilter = UI.select(
    [{ value: '', label: 'Todos los proyectos' }].concat(projects.map((p) => ({ value: p.id, label: p.code + ' · ' + p.name }))),
    filterProject
  );
  const userFilter = UI.select(
    [{ value: '', label: 'Todos los usuarios' }].concat(users.map((u) => ({ value: u.id, label: u.name }))),
    filterUser
  );
  const updateHash = () => {
    const p = new URLSearchParams();
    if (projFilter.value) p.set('project', projFilter.value);
    if (userFilter.value) p.set('user', userFilter.value);
    window.location.hash = '#tasks' + (p.toString() ? '?' + p.toString() : '');
  };
  projFilter.addEventListener('change', updateHash);
  userFilter.addEventListener('change', updateHash);
  const filters = UI.el('div', { class: 'toolbar' }, [
    UI.el('span', { style: 'font-weight:600;color:var(--dark);font-size:0.85rem' }, 'Filtros:'),
    projFilter,
    userFilter,
    UI.el('span', { class: 'spacer' }),
    UI.el('div', { class: 'view-toggle' }, [
      UI.el('button', { class: 'active' }, 'Lista'),
      UI.el('button', { onClick: () => (window.location.hash = '#calendar') }, 'Calendario'),
      UI.el('button', { onClick: () => (window.location.hash = '#kanban') }, 'Kanban')
    ])
  ]);
  root.appendChild(filters);

  if (tasks.length === 0) {
    root.appendChild(UI.el('div', { class: 'empty' }, 'No hay tareas. Crea la primera.'));
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const table = UI.el('table', { class: 'data' }, [
    UI.el('thead', {}, UI.el('tr', {}, [
      UI.el('th', {}, 'Tarea'),
      UI.el('th', {}, 'Proyecto'),
      UI.el('th', {}, 'Responsable'),
      UI.el('th', {}, 'Asignación'),
      UI.el('th', {}, 'Entrega'),
      UI.el('th', {}, 'Estado'),
      UI.el('th', {}, 'Acciones')
    ])),
    UI.el(
      'tbody',
      {},
      tasks.map((t) => {
        const overdue = t.due_date && t.due_date < today && t.status !== 'Completada';
        return UI.el('tr', {}, [
          UI.el('td', { 'data-label': 'Tarea' }, [UI.el('strong', {}, t.name), t.role ? UI.el('div', { style: 'font-size:0.75rem;color:var(--muted)' }, 'Rol: ' + t.role) : null]),
          UI.el('td', { 'data-label': 'Proyecto' }, t.project_code ? UI.el('span', {}, t.project_code + ' · ' + t.project_name) : '—'),
          UI.el('td', { 'data-label': 'Responsable' }, t.user_name || '—'),
          UI.el('td', { 'data-label': 'Asignación' }, UI.fmtDate(t.assigned_date)),
          UI.el('td', { 'data-label': 'Entrega' }, [UI.fmtDate(t.due_date), overdue ? ' ' : null, overdue ? UI.badge('Vencida', 'danger') : null]),
          UI.el('td', { 'data-label': 'Estado' }, UI.badge(t.status, taskStatusVariant(t.status))),
          UI.el('td', { 'data-label': 'Acciones' }, UI.el('div', { class: 'actions' }, [
            UI.el('button', { class: 'btn btn-ghost', onClick: () => taskForm(t, projects, users) }, 'Editar'),
            UI.el('button', { class: 'btn btn-danger', onClick: () => UI.confirmDialog('¿Eliminar tarea "' + t.name + '"?', async () => {
              await API.del('/api/tasks/' + t.id);
              UI.toast('Tarea eliminada', 'success');
              refresh();
            }) }, 'Eliminar')
          ]))
        ]);
      })
    )
  ]);
  root.appendChild(UI.el('div', { class: 'tbl-wrap' }, table));
}

function taskStatusVariant(s) {
  if (!s) return '';
  s = s.toLowerCase();
  if (s.includes('complet')) return 'ok';
  if (s.includes('progres') || s.includes('curso')) return 'gold';
  if (s.includes('pend')) return 'warn';
  if (s.includes('cancel')) return 'danger';
  return '';
}

function taskForm(task, projects, users) {
  const nameI = UI.input({ type: 'text', required: true }, task ? task.name : '');
  const objI = UI.textarea({}, task ? task.objective : '');
  const specI = UI.textarea({}, task ? task.specifications : '');
  const projI = UI.select(
    [{ value: '', label: '— Sin proyecto —' }].concat(projects.map((p) => ({ value: p.id, label: p.code + ' · ' + p.name }))),
    task ? task.project_id || '' : ''
  );
  const userI = UI.select(
    [{ value: '', label: '— Sin asignar —' }].concat(users.map((u) => ({ value: u.id, label: u.name }))),
    task ? task.user_id || '' : ''
  );
  const assignedI = UI.input({ type: 'date' }, task ? task.assigned_date : new Date().toISOString().slice(0, 10));
  const dueI = UI.input({ type: 'date' }, task ? task.due_date : '');
  const statusI = UI.select(
    [
      { value: 'Pendiente', label: 'Pendiente' },
      { value: 'En progreso', label: 'En progreso' },
      { value: 'Revisión', label: 'Revisión' },
      { value: 'Completada', label: 'Completada' },
      { value: 'Cancelada', label: 'Cancelada' }
    ],
    task ? task.status : 'Pendiente'
  );
  const budgetI = UI.input({ type: 'number', min: 0, step: '0.01' }, task ? task.budget : 0);
  const roleI = UI.input({ type: 'text', placeholder: 'Ej. Diseñador, Project Manager' }, task ? task.role : '');

  const body = UI.el('div', {}, [
    UI.formRow('Nombre de la tarea', nameI),
    UI.formRow('Objetivo', objI),
    UI.formRow('Especificaciones', specI),
    UI.el('div', { class: 'grid-2' }, [UI.formRow('Proyecto', projI), UI.formRow('Responsable', userI)]),
    UI.el('div', { class: 'grid-3' }, [
      UI.formRow('Fecha de asignación', assignedI),
      UI.formRow('Fecha de entrega', dueI),
      UI.formRow('Estado', statusI)
    ]),
    UI.el('div', { class: 'grid-2' }, [UI.formRow('Presupuesto asignado', budgetI), UI.formRow('Rol / función', roleI)])
  ]);

  const m = UI.modal({
    title: task ? 'Editar tarea' : 'Nueva tarea',
    wide: true,
    body,
    footer: [
      UI.el('button', { class: 'btn btn-ghost', onClick: () => m.close() }, 'Cancelar'),
      UI.el('button', { class: 'btn btn-primary', onClick: async () => {
        try {
          const payload = {
            project_id: projI.value ? Number(projI.value) : null,
            name: nameI.value,
            objective: objI.value,
            specifications: specI.value,
            assigned_date: assignedI.value || null,
            due_date: dueI.value || null,
            user_id: userI.value ? Number(userI.value) : null,
            status: statusI.value,
            budget: Number(budgetI.value) || 0,
            role: roleI.value
          };
          if (task) await API.put('/api/tasks/' + task.id, payload);
          else await API.post('/api/tasks', payload);
          m.close();
          UI.toast('Tarea guardada', 'success');
          refresh();
        } catch (e) {
          UI.toast(e.message, 'error');
        }
      } }, 'Guardar')
    ]
  });
}
