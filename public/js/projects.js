const PROJECT_BRANDS = ['EC Transportes', 'EC Tours', 'All Roads'];

async function ProjectsView(root) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const state = { category: params.get('category') || '', brand: params.get('brand') || '' };

  const [projects, users] = await Promise.all([API.get('/api/projects'), API.get('/api/users')]);

  root.appendChild(
    UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h1', {}, 'Proyectos'), UI.el('span', { class: 'hint' }, 'Administra los proyectos de la organización')]),
      UI.el('button', { class: 'btn btn-primary', onClick: () => projectForm(null, projects, users) }, '+ Nuevo proyecto')
    ])
  );

  if (projects.length === 0) {
    root.appendChild(UI.el('div', { class: 'empty' }, 'No hay proyectos. Crea el primer proyecto para comenzar.'));
    return;
  }

  // ---------- Filters ----------
  const categoryF = UI.select(
    [
      { value: '', label: 'Todas las categorías' },
      { value: 'Marca', label: 'Marca' },
      { value: 'Innovación', label: 'Innovación' },
      { value: 'sin-clasificar', label: 'Sin clasificar' }
    ],
    state.category
  );
  const brandF = UI.select(
    [{ value: '', label: 'Todas las marcas' }].concat(PROJECT_BRANDS.map((b) => ({ value: b, label: b }))),
    state.brand
  );
  brandF.disabled = state.category !== 'Marca';
  const applyFilters = () => {
    const q = new URLSearchParams();
    if (categoryF.value) q.set('category', categoryF.value);
    if (categoryF.value === 'Marca' && brandF.value) q.set('brand', brandF.value);
    window.location.hash = '#projects' + (q.toString() ? '?' + q.toString() : '');
  };
  categoryF.addEventListener('change', () => {
    brandF.disabled = categoryF.value !== 'Marca';
    applyFilters();
  });
  brandF.addEventListener('change', applyFilters);
  root.appendChild(
    UI.el('div', { class: 'toolbar' }, [
      UI.el('span', { style: 'font-weight:600;color:var(--dark);font-size:0.85rem' }, 'Organizar por:'),
      categoryF,
      brandF
    ])
  );

  // ---------- Filter + group ----------
  let filtered = projects;
  if (state.category === 'Marca') {
    filtered = projects.filter((p) => p.category === 'Marca' && (!state.brand || p.brand === state.brand));
  } else if (state.category === 'Innovación') {
    filtered = projects.filter((p) => p.category === 'Innovación');
  } else if (state.category === 'sin-clasificar') {
    filtered = projects.filter((p) => !p.category);
  }

  if (filtered.length === 0) {
    root.appendChild(UI.el('div', { class: 'empty' }, 'Ningún proyecto coincide con este filtro.'));
    return;
  }

  const groups = [];
  if (!state.category) {
    // No filter active: organize the whole list by Marca / Innovación automatically.
    PROJECT_BRANDS.forEach((b) => {
      const items = projects.filter((p) => p.category === 'Marca' && p.brand === b);
      if (items.length) groups.push({ label: b, items });
    });
    const innovation = projects.filter((p) => p.category === 'Innovación');
    if (innovation.length) groups.push({ label: 'Innovación', items: innovation });
    const unclassified = projects.filter((p) => !p.category);
    if (unclassified.length) groups.push({ label: 'Sin clasificar', items: unclassified });
  } else {
    groups.push({ label: null, items: filtered });
  }

  groups.forEach((group) => {
    if (group.label) {
      root.appendChild(
        UI.el('div', { class: 'group-heading' }, [
          UI.el('h2', {}, group.label),
          UI.el('span', { class: 'badge gold' }, group.items.length)
        ])
      );
    }
    const grid = UI.el('div', { class: 'cards-grid' });
    group.items.forEach((p) => grid.appendChild(projectCard(p, projects, users)));
    root.appendChild(grid);
  });
}

function projectCard(p, projects, users) {
  const score = (p.impact || 0) * (p.effort || 0);
  const openDetail = () => (window.location.hash = '#project/' + p.id);
  const card = UI.el('div', { class: 'card card-clickable', onClick: openDetail }, [
    UI.el('div', { style: 'display:flex;justify-content:space-between;align-items:start;margin-bottom:8px' }, [
      UI.el('div', {}, [
        UI.el('div', { style: 'color:var(--gold-2);font-size:0.78rem;font-weight:700;letter-spacing:0.5px' }, p.code),
        UI.el('h3', { style: 'margin:4px 0 0;color:var(--dark)' }, p.name)
      ]),
      UI.badge(p.status, statusVariant(p.status))
    ]),
    UI.el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px' }, [
      p.category === 'Marca' ? UI.badge(p.brand, 'dark') : null,
      p.category === 'Innovación' ? UI.badge('Innovación', 'gold') : null,
      p.process_type ? UI.badge(p.process_type, 'info') : null
    ]),
    UI.el('p', { style: 'color:var(--muted);font-size:0.85rem;margin:4px 0 10px;min-height:36px' }, p.objective || p.description || 'Sin objetivo'),
    UI.el('div', { style: 'display:flex;gap:12px;font-size:0.8rem;color:var(--muted);margin-bottom:10px' }, [
      UI.el('span', {}, 'Impacto: ' + (p.impact || '—') + '/5'),
      UI.el('span', {}, 'Esfuerzo: ' + (p.effort || '—') + '/5'),
      UI.el('span', {}, 'Score: ' + score)
    ]),
    UI.el('div', { style: 'font-size:0.82rem;margin-bottom:6px;color:var(--dark)' }, 'Presupuesto: $' + (p.budget || 0).toLocaleString()),
    UI.el('div', { style: 'font-size:0.78rem;margin-bottom:6px' }, 'Avance: ' + p.progress + '% (' + p.tasks_done + '/' + p.tasks_total + ')'),
    UI.el('div', { class: 'progress', style: 'margin-bottom:10px' }, UI.el('span', { style: `width:${p.progress}%` })),
    p.depends_on ? UI.el('div', { style: 'font-size:0.78rem;color:var(--muted);margin-bottom:8px' }, ['Depende de: ', UI.el('strong', {}, p.depends_on.name), ' (', p.depends_on.status, ')', !p.can_start ? ' — bloqueado' : '']) : null,
    UI.el('div', { style: 'font-size:0.78rem;color:var(--muted);margin-bottom:10px' }, 'Responsables: ' + (p.users.map((u) => u.name).join(', ') || '—')),
    UI.el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, [
      UI.el('button', { class: 'btn btn-gold small', onClick: (e) => { e.stopPropagation(); openDetail(); } }, 'Ver ficha'),
      UI.el('button', { class: 'btn btn-ghost small', onClick: (e) => { e.stopPropagation(); projectForm(p, projects, users); } }, 'Editar'),
      UI.el('button', { class: 'btn btn-danger small', onClick: (e) => {
        e.stopPropagation();
        UI.confirmDialog('¿Eliminar proyecto "' + p.name + '"? Se eliminarán sus tareas.', async () => {
          await API.del('/api/projects/' + p.id);
          UI.toast('Proyecto eliminado', 'success');
          refresh();
        });
      } }, 'Eliminar')
    ])
  ]);
  return card;
}

function statusVariant(status) {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s.includes('complet')) return 'ok';
  if (s.includes('curso')) return 'gold';
  if (s.includes('cancel')) return 'danger';
  if (s.includes('pausa')) return 'warn';
  if (s.includes('plan')) return 'info';
  return '';
}

function projectForm(project, allProjects, users) {
  const nameI = UI.input({ type: 'text', required: true }, project ? project.name : '');
  const objI = UI.textarea({}, project ? project.objective : '');
  const descI = UI.textarea({}, project ? project.description : '');
  const typeI = UI.select(
    [
      { value: '', label: '— Selecciona —' },
      { value: 'Estratégico', label: 'Estratégico (Gerencia y gestión integral)' },
      { value: 'Misional', label: 'Misional (Operación y trámites)' },
      { value: 'Apoyo', label: 'Apoyo (Gestión humana, compras, mantenimiento, inspecciones)' }
    ],
    project ? project.process_type : ''
  );
  const categoryI = UI.select(
    [
      { value: '', label: '— Sin clasificar —' },
      { value: 'Marca', label: 'Marca' },
      { value: 'Innovación', label: 'Innovación' }
    ],
    project ? project.category || '' : ''
  );
  const brandI = UI.select(
    [{ value: '', label: '— Selecciona la marca —' }].concat(PROJECT_BRANDS.map((b) => ({ value: b, label: b }))),
    project ? project.brand || '' : ''
  );
  const brandRow = UI.formRow('Marca', brandI);
  brandRow.style.display = categoryI.value === 'Marca' ? '' : 'none';
  categoryI.addEventListener('change', () => {
    brandRow.style.display = categoryI.value === 'Marca' ? '' : 'none';
  });
  const impactI = UI.select(
    [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })),
    project ? project.impact : 3
  );
  const effortI = UI.select(
    [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })),
    project ? project.effort : 3
  );
  const depOptions = [{ value: '', label: '— Sin dependencia —' }].concat(
    allProjects.filter((p) => !project || p.id !== project.id).map((p) => ({ value: p.id, label: p.code + ' · ' + p.name }))
  );
  const depI = UI.select(depOptions, project ? project.depends_on_id || '' : '');
  const budgetI = UI.input({ type: 'number', min: 0, step: '0.01' }, project ? project.budget : 0);
  const statusI = UI.select(
    [
      { value: 'Planificado', label: 'Planificado' },
      { value: 'En curso', label: 'En curso' },
      { value: 'Pausado', label: 'Pausado' },
      { value: 'Completado', label: 'Completado' },
      { value: 'Cancelado', label: 'Cancelado' }
    ],
    project ? project.status : 'Planificado'
  );
  const startI = UI.input({ type: 'date' }, project ? project.start_date : '');
  const endI = UI.input({ type: 'date' }, project ? project.end_date : '');
  const usersI = UI.multiCheck(
    users.map((u) => ({ value: u.id, label: u.name })),
    project ? project.users.map((u) => u.id) : [],
    'projusers'
  );

  const body = UI.el('div', {}, [
    project ? UI.el('p', { style: 'color:var(--muted);font-size:0.85rem' }, 'Código: ' + project.code) : null,
    UI.formRow('Nombre del proyecto', nameI),
    UI.formRow('Objetivo', objI),
    UI.formRow('Descripción', descI),
    UI.el('div', { class: 'grid-2' }, [UI.formRow('Tipo de proceso', typeI), UI.formRow('Categoría', categoryI)]),
    brandRow,
    UI.el('div', { class: 'grid-3' }, [
      UI.formRow('Impacto (1-5)', impactI),
      UI.formRow('Esfuerzo (1-5)', effortI),
      UI.formRow('Estado', statusI)
    ]),
    UI.formRow('Depende de', depI),
    UI.el('div', { class: 'grid-3' }, [
      UI.formRow('Presupuesto total', budgetI),
      UI.formRow('Inicio', startI),
      UI.formRow('Fin', endI)
    ]),
    UI.formRow('Responsables', usersI)
  ]);

  const m = UI.modal({
    title: project ? 'Editar proyecto' : 'Nuevo proyecto',
    wide: true,
    body,
    footer: [
      UI.el('button', { class: 'btn btn-ghost', onClick: () => m.close() }, 'Cancelar'),
      UI.el('button', { class: 'btn btn-primary', onClick: async () => {
        try {
          const payload = {
            name: nameI.value,
            objective: objI.value,
            description: descI.value,
            process_type: typeI.value || null,
            impact: Number(impactI.value) || null,
            effort: Number(effortI.value) || null,
            depends_on_id: depI.value ? Number(depI.value) : null,
            budget: Number(budgetI.value) || 0,
            status: statusI.value,
            start_date: startI.value || null,
            end_date: endI.value || null,
            category: categoryI.value || null,
            brand: categoryI.value === 'Marca' ? brandI.value || null : null,
            users: usersI.getValues().map(Number)
          };
          if (project) await API.put('/api/projects/' + project.id, payload);
          else await API.post('/api/projects', payload);
          m.close();
          UI.toast('Proyecto guardado', 'success');
          refresh();
        } catch (e) {
          UI.toast(e.message, 'error');
        }
      } }, 'Guardar')
    ]
  });
}
