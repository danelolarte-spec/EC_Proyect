async function CreativeView(root) {
  const state = { brand: '', status: '' };

  async function render() {
    root.innerHTML = '';
    const query = new URLSearchParams();
    if (state.brand) query.set('brand', state.brand);
    if (state.status) query.set('status', state.status);
    const content = await API.get('/api/creative/content' + (query.toString() ? '?' + query.toString() : ''));

    root.appendChild(
      UI.el('div', { class: 'page-header' }, [
        UI.el('div', {}, [UI.el('h1', {}, 'Área Creativa'), UI.el('span', { class: 'hint' }, 'Parrilla de contenidos para EC Transportes, EC Tours y All Roads')]),
        UI.el('button', { class: 'btn btn-primary', onClick: () => contentForm(null) }, '+ Nueva publicación')
      ])
    );

    const brandF = UI.select(
      [
        { value: '', label: 'Todas las marcas' },
        { value: 'EC Transportes', label: 'EC Transportes' },
        { value: 'EC Tours', label: 'EC Tours' },
        { value: 'All Roads', label: 'All Roads' }
      ],
      state.brand
    );
    brandF.addEventListener('change', () => { state.brand = brandF.value; render(); });
    const statusF = UI.select(
      [
        { value: '', label: 'Todos los estados' },
        { value: 'Preproducción', label: 'Preproducción' },
        { value: 'Producción', label: 'Producción' },
        { value: 'Diseño', label: 'Diseño' },
        { value: 'Publicación', label: 'Publicación' },
        { value: 'Archivado', label: 'Archivado' },
        { value: 'Pendiente de autorización', label: 'Pendiente de autorización' }
      ],
      state.status
    );
    statusF.addEventListener('change', () => { state.status = statusF.value; render(); });
    const filters = UI.el('div', { class: 'content-grid-filters' }, [brandF, statusF]);
    root.appendChild(filters);

    if (content.length === 0) {
      root.appendChild(UI.el('div', { class: 'empty' }, 'No hay publicaciones. Agrega la primera.'));
      return;
    }

    const grid = UI.el('div', { class: 'parrilla-cards' });
    content.forEach((c) => {
      let networks = [];
      try { networks = JSON.parse(c.networks || '[]'); } catch (e) {}
      const card = UI.el('div', { class: 'parrilla-card', onClick: () => contentForm(c) }, [
        UI.el('div', { class: 'p-head' }, [
          UI.el('span', {}, c.publish_date ? c.publish_date + (c.publish_time ? ' ' + c.publish_time : '') : 'Sin fecha'),
          UI.badge(c.brand, 'dark')
        ]),
        UI.el('div', { class: 'p-title' }, c.topic || 'Sin título'),
        UI.el('div', { class: 'p-meta' }, [
          c.format ? UI.badge(c.format, 'gold') : null,
          c.objective ? UI.badge(c.objective, 'info') : null,
          UI.badge(c.status, statusVariantCreative(c.status))
        ]),
        networks.length ? UI.el('div', { class: 'networks' }, networks.map((n) => UI.el('span', { class: 'net' }, n))) : null,
        c.copy ? UI.el('p', { style: 'font-size:0.82rem;color:var(--muted);margin:6px 0 0;max-height:3em;overflow:hidden' }, c.copy) : null
      ]);
      grid.appendChild(card);
    });
    root.appendChild(grid);
  }
  render();
}

function statusVariantCreative(s) {
  if (!s) return '';
  const v = s.toLowerCase();
  if (v.includes('publica')) return 'ok';
  if (v.includes('archiv')) return '';
  if (v.includes('autorización') || v.includes('pend')) return 'warn';
  if (v.includes('dise')) return 'gold';
  return 'info';
}

function contentForm(c) {
  const brandI = UI.select(
    [
      { value: 'EC Transportes', label: 'EC Transportes' },
      { value: 'EC Tours', label: 'EC Tours' },
      { value: 'All Roads', label: 'All Roads' }
    ],
    c ? c.brand : 'EC Transportes'
  );
  const dateI = UI.input({ type: 'date' }, c ? c.publish_date : '');
  const timeI = UI.input({ type: 'time' }, c ? c.publish_time : '');
  const objI = UI.select(
    [
      { value: '', label: '— Selecciona —' },
      { value: 'Promocional', label: 'Promocional' },
      { value: 'Informativo', label: 'Informativo' },
      { value: 'Entretenimiento', label: 'Entretenimiento' },
      { value: 'Conexión', label: 'Conexión' }
    ],
    c ? c.objective : ''
  );
  const topicI = UI.input({ type: 'text', required: true }, c ? c.topic : '');
  const formatI = UI.select(
    [
      { value: '', label: '— Selecciona —' },
      { value: 'Foto', label: 'Foto' },
      { value: 'Pieza', label: 'Pieza' },
      { value: 'Historia', label: 'Historia' },
      { value: 'Reels', label: 'Reels' },
      { value: 'Carrusel', label: 'Carrusel' }
    ],
    c ? c.format : ''
  );
  let selectedNetworks = [];
  if (c) {
    try { selectedNetworks = JSON.parse(c.networks || '[]'); } catch (e) {}
  }
  const networksI = UI.multiCheck(
    [
      { value: 'Instagram', label: 'Instagram' },
      { value: 'Facebook', label: 'Facebook' },
      { value: 'TikTok', label: 'TikTok' },
      { value: 'LinkedIn', label: 'LinkedIn' }
    ],
    selectedNetworks,
    'nets'
  );
  const copyI = UI.textarea({ rows: 4 }, c ? c.copy : '');
  const designI = UI.textarea({ rows: 3 }, c ? c.design_notes : '');
  const linkI = UI.input({ type: 'url', placeholder: 'https://drive.google.com/...' }, c ? c.file_link : '');
  const statusI = UI.select(
    [
      { value: 'Preproducción', label: 'Preproducción' },
      { value: 'Producción', label: 'Producción' },
      { value: 'Diseño', label: 'Diseño' },
      { value: 'Publicación', label: 'Publicación' },
      { value: 'Archivado', label: 'Archivado' },
      { value: 'Pendiente de autorización', label: 'Pendiente de autorización' }
    ],
    c ? c.status : 'Preproducción'
  );

  const body = UI.el('div', {}, [
    UI.el('div', { class: 'grid-2' }, [UI.formRow('Marca', brandI), UI.formRow('Estado', statusI)]),
    UI.el('div', { class: 'grid-3' }, [
      UI.formRow('Fecha de publicación', dateI),
      UI.formRow('Hora', timeI),
      UI.formRow('Objetivo', objI)
    ]),
    UI.formRow('Tema (título)', topicI),
    UI.el('div', { class: 'grid-2' }, [UI.formRow('Formato', formatI), UI.formRow('Redes sociales', networksI)]),
    UI.formRow('Copy (texto de publicación)', copyI),
    UI.formRow('Indicaciones de diseño', designI),
    UI.formRow('Link de archivo (Drive u otro)', linkI)
  ]);

  const footer = [
    c ? UI.el('button', { class: 'btn btn-danger', style: 'margin-right:auto', onClick: () => UI.confirmDialog('¿Eliminar esta publicación?', async () => {
      await API.del('/api/creative/content/' + c.id);
      m.close();
      UI.toast('Publicación eliminada', 'success');
      refresh();
    }) }, 'Eliminar') : null,
    UI.el('button', { class: 'btn btn-ghost', onClick: () => m.close() }, 'Cancelar'),
    UI.el('button', { class: 'btn btn-primary', onClick: async () => {
      try {
        const payload = {
          brand: brandI.value,
          publish_date: dateI.value || null,
          publish_time: timeI.value || null,
          objective: objI.value || null,
          topic: topicI.value,
          format: formatI.value || null,
          networks: networksI.getValues(),
          copy: copyI.value,
          design_notes: designI.value,
          file_link: linkI.value,
          status: statusI.value
        };
        if (c) await API.put('/api/creative/content/' + c.id, payload);
        else await API.post('/api/creative/content', payload);
        m.close();
        UI.toast('Publicación guardada', 'success');
        refresh();
      } catch (e) {
        UI.toast(e.message, 'error');
      }
    } }, 'Guardar')
  ].filter(Boolean);

  const m = UI.modal({ title: c ? 'Editar publicación' : 'Nueva publicación', wide: true, body, footer });
}

// ===== Creative tasks =====
async function CreativeTasksView(root) {
  const [tasks, users] = await Promise.all([API.get('/api/creative/tasks'), API.get('/api/users')]);

  root.appendChild(
    UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h1', {}, 'Tareas Creativas'), UI.el('span', { class: 'hint' }, 'Tareas específicas del área creativa')]),
      UI.el('button', { class: 'btn btn-primary', onClick: () => creativeTaskForm(null, users) }, '+ Nueva tarea creativa')
    ])
  );

  if (tasks.length === 0) {
    root.appendChild(UI.el('div', { class: 'empty' }, 'No hay tareas creativas.'));
    return;
  }

  const table = UI.el('table', { class: 'data' }, [
    UI.el('thead', {}, UI.el('tr', {}, [
      UI.el('th', {}, 'Tarea'),
      UI.el('th', {}, 'Objetivo'),
      UI.el('th', {}, 'Responsable'),
      UI.el('th', {}, 'Asignación'),
      UI.el('th', {}, 'Entrega'),
      UI.el('th', {}, 'Estado'),
      UI.el('th', {}, 'Acciones')
    ])),
    UI.el('tbody', {}, tasks.map((t) => UI.el('tr', {}, [
      UI.el('td', { 'data-label': 'Tarea' }, UI.el('strong', {}, t.name)),
      UI.el('td', { 'data-label': 'Objetivo' }, t.objective || '—'),
      UI.el('td', { 'data-label': 'Responsable' }, t.user_name || '—'),
      UI.el('td', { 'data-label': 'Asignación' }, UI.fmtDate(t.assigned_date)),
      UI.el('td', { 'data-label': 'Entrega' }, UI.fmtDate(t.due_date)),
      UI.el('td', { 'data-label': 'Estado' }, UI.badge(t.status, taskStatusVariant(t.status))),
      UI.el('td', { 'data-label': 'Acciones' }, UI.el('div', { class: 'actions' }, [
        UI.el('button', { class: 'btn btn-ghost', onClick: () => creativeTaskForm(t, users) }, 'Editar'),
        UI.el('button', { class: 'btn btn-danger', onClick: () => UI.confirmDialog('¿Eliminar tarea?', async () => {
          await API.del('/api/creative/tasks/' + t.id);
          UI.toast('Tarea eliminada', 'success');
          refresh();
        }) }, 'Eliminar')
      ]))
    ])))
  ]);
  root.appendChild(UI.el('div', { class: 'tbl-wrap' }, table));
}

function creativeTaskForm(task, users) {
  const nameI = UI.input({ type: 'text', required: true }, task ? task.name : '');
  const objI = UI.textarea({}, task ? task.objective : '');
  const specI = UI.textarea({}, task ? task.specifications : '');
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
      { value: 'Completada', label: 'Completada' }
    ],
    task ? task.status : 'Pendiente'
  );

  const body = UI.el('div', {}, [
    UI.formRow('Nombre de la tarea', nameI),
    UI.formRow('Objetivo', objI),
    UI.formRow('Especificaciones', specI),
    UI.formRow('Responsable', userI),
    UI.el('div', { class: 'grid-3' }, [
      UI.formRow('Fecha de asignación', assignedI),
      UI.formRow('Fecha de entrega', dueI),
      UI.formRow('Estado', statusI)
    ])
  ]);

  const m = UI.modal({
    title: task ? 'Editar tarea creativa' : 'Nueva tarea creativa',
    body,
    footer: [
      UI.el('button', { class: 'btn btn-ghost', onClick: () => m.close() }, 'Cancelar'),
      UI.el('button', { class: 'btn btn-primary', onClick: async () => {
        try {
          const payload = {
            name: nameI.value,
            objective: objI.value,
            specifications: specI.value,
            assigned_date: assignedI.value || null,
            due_date: dueI.value || null,
            user_id: userI.value ? Number(userI.value) : null,
            status: statusI.value
          };
          if (task) await API.put('/api/creative/tasks/' + task.id, payload);
          else await API.post('/api/creative/tasks', payload);
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
