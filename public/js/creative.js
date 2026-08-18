const CREATIVE_NETWORKS = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn'];
const CREATIVE_BRAND_ACCENT = { 'EC Group': 'dark', 'EC Transportes': 'info', 'EC Tours': 'ok', 'All Roads': 'warn' };

async function CreativeView(root) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const state = {
    brand: params.get('brand') || '',
    status: params.get('status') || '',
    network: params.get('network') || '',
    view: params.get('view') || 'cards',
    year: new Date().getFullYear(),
    month: new Date().getMonth()
  };

  async function render() {
    root.innerHTML = '';
    const [content, users] = await Promise.all([
      API.get('/api/creative/content' + toQuery({ brand: state.brand, status: state.status, network: state.network })),
      API.get('/api/users')
    ]);

    root.appendChild(
      UI.el('div', { class: 'page-header' }, [
        UI.el('div', {}, [UI.el('h1', {}, 'Área Creativa'), UI.el('span', { class: 'hint' }, 'Parrilla de contenidos para EC Group, EC Transportes, EC Tours y All Roads')]),
        UI.el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [
          UI.el('div', { class: 'view-toggle' }, [
            UI.el('button', { class: state.view === 'cards' ? 'active' : '', onClick: () => { state.view = 'cards'; syncHash(); render(); } }, 'Tarjetas'),
            UI.el('button', { class: state.view === 'calendar' ? 'active' : '', onClick: () => { state.view = 'calendar'; syncHash(); render(); } }, 'Calendario')
          ]),
          UI.el('button', { class: 'btn btn-primary', onClick: () => contentForm(null, users) }, '+ Nueva publicación')
        ])
      ])
    );

    function syncHash() {
      const q = new URLSearchParams();
      if (state.brand) q.set('brand', state.brand);
      if (state.status) q.set('status', state.status);
      if (state.network) q.set('network', state.network);
      if (state.view !== 'cards') q.set('view', state.view);
      window.history.replaceState(null, '', '#creative' + (q.toString() ? '?' + q.toString() : ''));
    }

    const brandF = UI.select([{ value: '', label: 'Todas las marcas' }].concat(EC_BRANDS.map((b) => ({ value: b, label: b }))), state.brand);
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
    const networkF = UI.select(
      [{ value: '', label: 'Todas las redes' }].concat(CREATIVE_NETWORKS.map((n) => ({ value: n, label: n }))),
      state.network
    );
    brandF.addEventListener('change', () => { state.brand = brandF.value; syncHash(); render(); });
    statusF.addEventListener('change', () => { state.status = statusF.value; syncHash(); render(); });
    networkF.addEventListener('change', () => { state.network = networkF.value; syncHash(); render(); });
    root.appendChild(UI.el('div', { class: 'content-grid-filters' }, [brandF, statusF, networkF]));

    if (content.length === 0) {
      root.appendChild(UI.el('div', { class: 'empty' }, 'No hay publicaciones con estos filtros.'));
      return;
    }

    if (state.view === 'calendar') {
      root.appendChild(calendarGrid(content, users));
    } else {
      const grid = UI.el('div', { class: 'parrilla-cards' });
      content.forEach((c) => grid.appendChild(contentCard(c, users)));
      root.appendChild(grid);
    }
  }

  function calendarGrid(content, users) {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dows = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const wrap = UI.el('div', {});
    const prevBtn = UI.el('button', { class: 'btn btn-ghost small', onClick: () => { state.month--; if (state.month < 0) { state.month = 11; state.year--; } render(); } }, '‹');
    const nextBtn = UI.el('button', { class: 'btn btn-ghost small', onClick: () => { state.month++; if (state.month > 11) { state.month = 0; state.year++; } render(); } }, '›');
    const todayBtn = UI.el('button', { class: 'btn btn-ghost small', onClick: () => { state.year = new Date().getFullYear(); state.month = new Date().getMonth(); render(); } }, 'Hoy');

    const cal = UI.el('div', { class: 'calendar' });
    cal.appendChild(
      UI.el('div', { class: 'calendar-head' }, [
        UI.el('h2', {}, monthNames[state.month] + ' ' + state.year),
        UI.el('div', { class: 'nav-btns' }, [prevBtn, todayBtn, nextBtn])
      ])
    );
    const grid = UI.el('div', { class: 'calendar-grid' });
    dows.forEach((d) => grid.appendChild(UI.el('div', { class: 'cal-dow' }, d)));

    const first = new Date(state.year, state.month, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < startDow; i++) grid.appendChild(UI.el('div', { class: 'cal-cell other' }));
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${state.year}-${String(state.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cell = UI.el('div', { class: 'cal-cell' + (dateStr === todayStr ? ' today' : '') });
      cell.appendChild(UI.el('div', { class: 'cal-date' }, String(d)));
      content
        .filter((c) => c.publish_date === dateStr)
        .forEach((c) => {
          const accent = CREATIVE_BRAND_ACCENT[c.brand] || '';
          cell.appendChild(
            UI.el(
              'div',
              { class: 'cal-item ' + (accent === 'dark' ? '' : accent), title: c.brand + ': ' + c.topic, onClick: (e) => { e.stopPropagation(); contentFicha(c, users); } },
              c.brand + ' · ' + (c.topic || 'Sin título')
            )
          );
        });
      grid.appendChild(cell);
    }
    cal.appendChild(grid);
    wrap.appendChild(cal);
    wrap.appendChild(
      UI.el('div', { style: 'margin-top:14px;display:flex;gap:14px;flex-wrap:wrap;font-size:0.82rem;color:var(--muted)' }, [
        UI.el('span', {}, [UI.el('span', { style: 'display:inline-block;width:10px;height:10px;background:var(--brand);border-radius:2px;margin-right:6px;vertical-align:middle' }), ' EC Group']),
        UI.el('span', {}, [UI.el('span', { style: 'display:inline-block;width:10px;height:10px;background:var(--info);border-radius:2px;margin-right:6px;vertical-align:middle' }), ' EC Transportes']),
        UI.el('span', {}, [UI.el('span', { style: 'display:inline-block;width:10px;height:10px;background:var(--success);border-radius:2px;margin-right:6px;vertical-align:middle' }), ' EC Tours']),
        UI.el('span', {}, [UI.el('span', { style: 'display:inline-block;width:10px;height:10px;background:var(--warn);border-radius:2px;margin-right:6px;vertical-align:middle' }), ' All Roads'])
      ])
    );
    return wrap;
  }

  function contentCard(c, users) {
    let networks = [];
    try { networks = JSON.parse(c.networks || '[]'); } catch (e) {}
    return UI.el('div', { class: 'parrilla-card', onClick: () => contentFicha(c, users) }, [
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
      UI.el('div', { style: 'font-size:0.78rem;color:var(--muted);margin-top:6px' }, 'Responsable: ' + (c.user_name || 'Sin asignar')),
      c.copy ? UI.el('p', { style: 'font-size:0.82rem;color:var(--muted);margin:6px 0 0;max-height:3em;overflow:hidden' }, c.copy) : null
    ]);
  }
  render();
}

function toQuery(obj) {
  const q = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => v && q.set(k, v));
  const s = q.toString();
  return s ? '?' + s : '';
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

// ---------- Ficha (read-only detail) ----------
function contentFicha(c, users) {
  let networks = [];
  try { networks = JSON.parse(c.networks || '[]'); } catch (e) {}
  const body = UI.el('div', {}, [
    UI.el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px' }, [
      UI.badge(c.brand, 'dark'),
      UI.badge(c.status, statusVariantCreative(c.status)),
      c.format ? UI.badge(c.format, 'gold') : null,
      c.objective ? UI.badge(c.objective, 'info') : null
    ]),
    fichaRow('Fecha de publicación', UI.fmtDate(c.publish_date) + (c.publish_time ? ' · ' + c.publish_time : '')),
    fichaRow('Responsable', c.user_name || 'Sin asignar'),
    fichaRow('Redes sociales', networks.length ? networks.join(', ') : '—'),
    c.copy ? UI.el('div', { style: 'margin-top:12px' }, [UI.el('strong', { style: 'color:var(--text);font-size:0.85rem' }, 'Copy'), UI.el('p', { style: 'color:var(--muted);font-size:0.88rem;white-space:pre-wrap;margin:4px 0 0' }, c.copy)]) : null,
    c.design_notes ? UI.el('div', { style: 'margin-top:10px' }, [UI.el('strong', { style: 'color:var(--text);font-size:0.85rem' }, 'Indicaciones de diseño'), UI.el('p', { style: 'color:var(--muted);font-size:0.88rem;white-space:pre-wrap;margin:4px 0 0' }, c.design_notes)]) : null,
    c.file_link ? UI.el('div', { style: 'margin-top:10px' }, UI.el('a', { href: c.file_link, target: '_blank', style: 'color:var(--gold-2);font-weight:600;font-size:0.85rem' }, '↗ Ver archivo')) : null
  ]);
  const m = UI.modal({
    title: c.topic || 'Publicación creativa',
    body,
    footer: [
      UI.el('button', { class: 'btn btn-danger', style: 'margin-right:auto', onClick: () => UI.confirmDialog('¿Eliminar esta publicación?', async () => {
        await API.del('/api/creative/content/' + c.id);
        m.close();
        UI.toast('Publicación eliminada', 'success');
        refresh();
      }) }, 'Eliminar'),
      UI.el('button', { class: 'btn btn-ghost', onClick: () => m.close() }, 'Cerrar'),
      UI.el('button', { class: 'btn btn-primary', onClick: () => { m.close(); contentForm(c, users); } }, 'Editar')
    ]
  });
}

function fichaRow(label, value) {
  return UI.el('div', { style: 'display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--border)' }, [
    UI.el('span', { style: 'color:var(--muted);font-size:0.85rem' }, label),
    UI.el('span', { style: 'font-weight:600;color:var(--text);font-size:0.85rem;text-align:right' }, value || '—')
  ]);
}

function contentForm(c, users) {
  const brandI = UI.select(EC_BRANDS.map((b) => ({ value: b, label: b })), c ? c.brand : 'EC Group');
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
  const userI = UI.select(
    [{ value: '', label: '— Sin asignar —' }].concat(users.map((u) => ({ value: u.id, label: u.name }))),
    c ? c.user_id || '' : ''
  );
  let selectedNetworks = [];
  if (c) {
    try { selectedNetworks = JSON.parse(c.networks || '[]'); } catch (e) {}
  }
  const networksI = UI.multiCheck(CREATIVE_NETWORKS.map((n) => ({ value: n, label: n })), selectedNetworks, 'nets');
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
    UI.el('div', { class: 'grid-2' }, [UI.formRow('Formato', formatI), UI.formRow('Responsable', userI)]),
    UI.formRow('Redes sociales', networksI),
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
          status: statusI.value,
          user_id: userI.value ? Number(userI.value) : null
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
      UI.el('div', {}, [UI.el('h1', {}, 'Tareas Creativas'), UI.el('span', { class: 'hint' }, 'Equipo, responsables y tareas del área creativa')]),
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
    UI.el('tbody', {}, tasks.map((t) => UI.el('tr', { onClick: () => creativeTaskFicha(t, users), style: 'cursor:pointer' }, [
      UI.el('td', { 'data-label': 'Tarea' }, UI.el('strong', {}, t.name)),
      UI.el('td', { 'data-label': 'Objetivo' }, t.objective || '—'),
      UI.el('td', { 'data-label': 'Responsable' }, t.user_name || '—'),
      UI.el('td', { 'data-label': 'Asignación' }, UI.fmtDate(t.assigned_date)),
      UI.el('td', { 'data-label': 'Entrega' }, UI.fmtDate(t.due_date)),
      UI.el('td', { 'data-label': 'Estado' }, UI.badge(t.status, taskStatusVariant(t.status))),
      UI.el('td', { 'data-label': 'Acciones' }, UI.el('div', { class: 'actions' }, [
        UI.el('button', { class: 'btn btn-ghost', onClick: (e) => { e.stopPropagation(); creativeTaskForm(t, users); } }, 'Editar'),
        UI.el('button', { class: 'btn btn-danger', onClick: (e) => { e.stopPropagation(); UI.confirmDialog('¿Eliminar tarea?', async () => {
          await API.del('/api/creative/tasks/' + t.id);
          UI.toast('Tarea eliminada', 'success');
          refresh();
        }); } }, 'Eliminar')
      ]))
    ])))
  ]);
  root.appendChild(UI.el('div', { class: 'tbl-wrap' }, table));
}

function creativeTaskFicha(t, users) {
  const body = UI.el('div', {}, [
    UI.el('div', { style: 'margin-bottom:10px' }, UI.badge(t.status, taskStatusVariant(t.status))),
    fichaRow('Responsable', t.user_name || 'Sin asignar'),
    fichaRow('Fecha de asignación', UI.fmtDate(t.assigned_date)),
    fichaRow('Fecha de entrega', UI.fmtDate(t.due_date)),
    t.objective ? UI.el('div', { style: 'margin-top:12px' }, [UI.el('strong', { style: 'color:var(--text);font-size:0.85rem' }, 'Objetivo'), UI.el('p', { style: 'color:var(--muted);font-size:0.88rem;margin:4px 0 0' }, t.objective)]) : null,
    t.specifications ? UI.el('div', { style: 'margin-top:10px' }, [UI.el('strong', { style: 'color:var(--text);font-size:0.85rem' }, 'Especificaciones'), UI.el('p', { style: 'color:var(--muted);font-size:0.88rem;white-space:pre-wrap;margin:4px 0 0' }, t.specifications)]) : null
  ]);
  const m = UI.modal({
    title: t.name,
    body,
    footer: [
      UI.el('button', { class: 'btn btn-ghost', onClick: () => m.close() }, 'Cerrar'),
      UI.el('button', { class: 'btn btn-primary', onClick: () => { m.close(); creativeTaskForm(t, users); } }, 'Editar')
    ]
  });
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
