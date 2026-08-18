async function ProjectDetailView(root, id) {
  const [project, tasks, users, allProjects, activity] = await Promise.all([
    API.get('/api/projects/' + id),
    API.get('/api/tasks?project_id=' + id),
    API.get('/api/users'),
    API.get('/api/projects'),
    API.get('/api/projects/' + id + '/activity')
  ]);

  if (!project) {
    root.appendChild(UI.el('div', { class: 'empty' }, 'Proyecto no encontrado.'));
    return;
  }

  let editingInfo = false;
  let editingTeam = false;
  const calState = { year: new Date().getFullYear(), month: new Date().getMonth() };

  function toPayload(overrides = {}) {
    return {
      name: project.name,
      objective: project.objective,
      description: project.description,
      process_type: project.process_type,
      impact: project.impact,
      effort: project.effort,
      depends_on_id: project.depends_on_id,
      budget: project.budget,
      status: project.status,
      start_date: project.start_date,
      end_date: project.end_date,
      category: project.category,
      brand: project.brand,
      users: project.users.map((u) => u.id),
      ...overrides
    };
  }

  function render() {
    root.innerHTML = '';
    root.appendChild(header());
    root.appendChild(UI.el('div', { class: 'detail-grid' }, [
      UI.el('div', { class: 'detail-main' }, [infoCard(), tasksCard(), scheduleCard()]),
      UI.el('div', { class: 'detail-side' }, [teamCard(), activityCard()])
    ]));
  }

  function header() {
    const score = (project.impact || 0) * (project.effort || 0);
    return UI.el('div', {}, [
      UI.el('a', { href: '#projects', style: 'display:inline-block;margin-bottom:10px;color:var(--muted);font-size:0.85rem' }, '← Volver a Proyectos'),
      UI.el('div', { class: 'page-header' }, [
        UI.el('div', {}, [
          UI.el('div', { style: 'color:var(--gold-2);font-size:0.8rem;font-weight:700;letter-spacing:0.5px' }, project.code),
          UI.el('h1', { style: 'margin:2px 0 6px' }, project.name),
          UI.el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, [
            UI.badge(project.status, statusVariant(project.status)),
            project.category === 'Marca' ? UI.badge(project.brand, 'dark') : null,
            project.category === 'Innovación' ? UI.badge('Innovación', 'gold') : null,
            project.process_type ? UI.badge(project.process_type, 'info') : null
          ])
        ]),
        UI.el('button', { class: 'btn btn-danger small', onClick: () => UI.confirmDialog('¿Eliminar proyecto "' + project.name + '"? Se eliminarán sus tareas.', async () => {
          await API.del('/api/projects/' + project.id);
          UI.toast('Proyecto eliminado', 'success');
          window.location.hash = '#projects';
        }) }, 'Eliminar proyecto')
      ]),
      UI.el('div', { style: 'display:flex;gap:16px;flex-wrap:wrap;font-size:0.85rem;color:var(--muted);margin:-6px 0 16px' }, [
        UI.el('span', {}, 'Impacto ' + (project.impact || '—') + '/5'),
        UI.el('span', {}, 'Esfuerzo ' + (project.effort || '—') + '/5'),
        UI.el('span', {}, 'Score ' + score),
        UI.el('span', {}, 'Avance ' + project.progress + '% (' + project.tasks_done + '/' + project.tasks_total + ')')
      ])
    ]);
  }

  // ---------- Info card ----------
  function infoCard() {
    const card = UI.el('div', { class: 'card', style: 'margin-bottom:16px' });
    card.appendChild(
      UI.el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' }, [
        UI.el('h2', { style: 'margin:0;font-size:1.05rem;color:var(--dark)' }, 'Información'),
        !editingInfo
          ? UI.el('button', { class: 'btn btn-ghost small', onClick: () => { editingInfo = true; render(); } }, 'Editar información')
          : null
      ])
    );
    card.appendChild(editingInfo ? infoEditForm() : infoDisplay());
    return card;
  }

  function infoDisplay() {
    return UI.el('div', {}, [
      project.objective ? UI.el('p', { style: 'margin:0 0 10px' }, [UI.el('strong', {}, 'Objetivo: '), project.objective]) : null,
      project.description ? UI.el('p', { style: 'color:var(--muted);font-size:0.9rem;white-space:pre-wrap;margin:0 0 14px' }, project.description) : null,
      UI.el('div', { class: 'progress', style: 'margin-bottom:6px' }, UI.el('span', { style: `width:${project.progress}%` })),
      UI.el('div', { class: 'grid-3', style: 'margin-top:14px' }, [
        detailStat('Presupuesto', '$' + (project.budget || 0).toLocaleString()),
        detailStat('Inicio', UI.fmtDate(project.start_date)),
        detailStat('Fin', UI.fmtDate(project.end_date))
      ]),
      project.depends_on
        ? UI.el('div', { style: 'font-size:0.85rem;color:var(--muted);margin-top:14px' }, [
            'Depende de: ',
            UI.el('a', { href: '#project/' + project.depends_on.id, style: 'font-weight:600' }, project.depends_on.name),
            ' (', project.depends_on.status, ')',
            !project.can_start ? ' — bloqueado hasta que se complete' : ''
          ])
        : null
    ]);
  }

  function detailStat(label, value) {
    return UI.el('div', {}, [
      UI.el('div', { style: 'font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.3px' }, label),
      UI.el('div', { style: 'font-size:0.95rem;color:var(--dark);font-weight:600' }, value)
    ]);
  }

  function infoEditForm() {
    const objI = UI.textarea({}, project.objective);
    const descI = UI.textarea({}, project.description);
    const typeI = UI.select(
      [
        { value: '', label: '— Selecciona —' },
        { value: 'Estratégico', label: 'Estratégico' },
        { value: 'Misional', label: 'Misional' },
        { value: 'Apoyo', label: 'Apoyo' }
      ],
      project.process_type || ''
    );
    const categoryI = UI.select(
      [
        { value: '', label: '— Sin clasificar —' },
        { value: 'Marca', label: 'Marca' },
        { value: 'Innovación', label: 'Innovación' }
      ],
      project.category || ''
    );
    const brandI = UI.select(
      [{ value: '', label: '— Selecciona la marca —' }].concat(EC_BRANDS.map((b) => ({ value: b, label: b }))),
      project.brand || ''
    );
    const brandRow = UI.formRow('Marca', brandI);
    brandRow.style.display = categoryI.value === 'Marca' ? '' : 'none';
    categoryI.addEventListener('change', () => (brandRow.style.display = categoryI.value === 'Marca' ? '' : 'none'));
    const impactI = UI.select([1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })), project.impact || 3);
    const effortI = UI.select([1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })), project.effort || 3);
    const statusI = UI.select(
      [
        { value: 'Planificado', label: 'Planificado' },
        { value: 'En curso', label: 'En curso' },
        { value: 'Pausado', label: 'Pausado' },
        { value: 'Completado', label: 'Completado' },
        { value: 'Cancelado', label: 'Cancelado' }
      ],
      project.status
    );
    const depOptions = [{ value: '', label: '— Sin dependencia —' }].concat(
      allProjects.filter((p) => p.id !== project.id).map((p) => ({ value: p.id, label: p.code + ' · ' + p.name }))
    );
    const depI = UI.select(depOptions, project.depends_on_id || '');
    const budgetI = UI.input({ type: 'number', min: 0, step: '0.01' }, project.budget);
    const startI = UI.input({ type: 'date' }, project.start_date);
    const endI = UI.input({ type: 'date' }, project.end_date);

    return UI.el('div', {}, [
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
      UI.el('div', { style: 'display:flex;gap:8px;margin-top:6px' }, [
        UI.el('button', { class: 'btn btn-primary', onClick: async () => {
          try {
            await API.put('/api/projects/' + project.id, toPayload({
              objective: objI.value,
              description: descI.value,
              process_type: typeI.value || null,
              category: categoryI.value || null,
              brand: categoryI.value === 'Marca' ? brandI.value || null : null,
              impact: Number(impactI.value) || null,
              effort: Number(effortI.value) || null,
              status: statusI.value,
              depends_on_id: depI.value ? Number(depI.value) : null,
              budget: Number(budgetI.value) || 0,
              start_date: startI.value || null,
              end_date: endI.value || null
            }));
            UI.toast('Información actualizada', 'success');
            refresh();
          } catch (e) {
            UI.toast(e.message, 'error');
          }
        } }, 'Guardar'),
        UI.el('button', { class: 'btn btn-ghost', onClick: () => { editingInfo = false; render(); } }, 'Cancelar')
      ])
    ]);
  }

  // ---------- Team card ----------
  function teamCard() {
    const card = UI.el('div', { class: 'card', style: 'margin-bottom:16px' });
    card.appendChild(
      UI.el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px' }, [
        UI.el('h2', { style: 'margin:0;font-size:1rem;color:var(--dark)' }, 'Equipo asignado'),
        !editingTeam ? UI.el('button', { class: 'btn btn-ghost small', onClick: () => { editingTeam = true; render(); } }, 'Editar') : null
      ])
    );
    if (!editingTeam) {
      card.appendChild(
        project.users.length
          ? UI.el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }, project.users.map((u) => UI.badge(u.name, 'info')))
          : UI.el('p', { style: 'color:var(--muted);font-size:0.85rem' }, 'Sin responsables asignados.')
      );
    } else {
      const usersI = UI.multiCheck(users.map((u) => ({ value: u.id, label: u.name })), project.users.map((u) => u.id), 'teamusers');
      card.appendChild(usersI);
      card.appendChild(
        UI.el('div', { style: 'display:flex;gap:8px;margin-top:10px' }, [
          UI.el('button', { class: 'btn btn-primary small', onClick: async () => {
            try {
              await API.put('/api/projects/' + project.id, toPayload({ users: usersI.getValues().map(Number) }));
              UI.toast('Equipo actualizado', 'success');
              refresh();
            } catch (e) {
              UI.toast(e.message, 'error');
            }
          } }, 'Guardar'),
          UI.el('button', { class: 'btn btn-ghost small', onClick: () => { editingTeam = false; render(); } }, 'Cancelar')
        ])
      );
    }
    return card;
  }

  // ---------- Tasks card ----------
  function tasksCard() {
    const card = UI.el('div', { class: 'card' });
    card.appendChild(
      UI.el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' }, [
        UI.el('h2', { style: 'margin:0;font-size:1.05rem;color:var(--dark)' }, 'Tareas del proyecto'),
        UI.el('button', { class: 'btn btn-primary small', onClick: () => taskForm(null, allProjects, users, project.id) }, '+ Nueva tarea')
      ])
    );
    if (tasks.length === 0) {
      card.appendChild(UI.el('div', { class: 'empty' }, 'Este proyecto todavía no tiene tareas.'));
      return card;
    }
    const today = new Date().toISOString().slice(0, 10);
    const table = UI.el('table', { class: 'data' }, [
      UI.el('thead', {}, UI.el('tr', {}, [
        UI.el('th', {}, 'Tarea'),
        UI.el('th', {}, 'Responsable'),
        UI.el('th', {}, 'Entrega'),
        UI.el('th', {}, 'Estado'),
        UI.el('th', {}, 'Acciones')
      ])),
      UI.el('tbody', {}, tasks.map((t) => {
        const overdue = t.due_date && t.due_date < today && t.status !== 'Completada';
        return UI.el('tr', {}, [
          UI.el('td', { 'data-label': 'Tarea' }, UI.el('strong', {}, t.name)),
          UI.el('td', { 'data-label': 'Responsable' }, t.user_name || '—'),
          UI.el('td', { 'data-label': 'Entrega' }, [UI.fmtDate(t.due_date), overdue ? ' ' : null, overdue ? UI.badge('Vencida', 'danger') : null]),
          UI.el('td', { 'data-label': 'Estado' }, UI.badge(t.status, taskStatusVariant(t.status))),
          UI.el('td', { 'data-label': 'Acciones' }, UI.el('div', { class: 'actions' }, [
            UI.el('button', { class: 'btn btn-ghost', onClick: () => taskForm(t, allProjects, users, project.id) }, 'Editar'),
            UI.el('button', { class: 'btn btn-danger', onClick: () => UI.confirmDialog('¿Eliminar tarea "' + t.name + '"?', async () => {
              await API.del('/api/tasks/' + t.id);
              UI.toast('Tarea eliminada', 'success');
              refresh();
            }) }, 'Eliminar')
          ]))
        ]);
      }))
    ]);
    card.appendChild(UI.el('div', { class: 'tbl-wrap' }, table));
    return card;
  }

  // ---------- Schedule (mini calendar) card ----------
  function scheduleCard() {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dows = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const card = UI.el('div', { class: 'card', style: 'margin-top:16px' });
    const prevBtn = UI.el('button', { class: 'btn btn-ghost small', onClick: () => { calState.month--; if (calState.month < 0) { calState.month = 11; calState.year--; } render(); } }, '‹');
    const nextBtn = UI.el('button', { class: 'btn btn-ghost small', onClick: () => { calState.month++; if (calState.month > 11) { calState.month = 0; calState.year++; } render(); } }, '›');
    const todayBtn = UI.el('button', { class: 'btn btn-ghost small', onClick: () => { calState.year = new Date().getFullYear(); calState.month = new Date().getMonth(); render(); } }, 'Hoy');
    card.appendChild(
      UI.el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' }, [
        UI.el('h2', { style: 'margin:0;font-size:1.05rem;color:var(--dark)' }, 'Cronograma del proyecto'),
        UI.el('div', { class: 'nav-btns' }, [prevBtn, todayBtn, nextBtn])
      ])
    );

    const first = new Date(calState.year, calState.month, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(calState.year, calState.month + 1, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);

    const cal = UI.el('div', { class: 'calendar', style: 'box-shadow:none;padding:0' });
    cal.appendChild(UI.el('div', { style: 'text-align:center;font-weight:700;color:var(--text);margin-bottom:8px;text-transform:capitalize' }, monthNames[calState.month] + ' ' + calState.year));
    const grid = UI.el('div', { class: 'calendar-grid' });
    dows.forEach((d) => grid.appendChild(UI.el('div', { class: 'cal-dow' }, d)));
    for (let i = 0; i < startDow; i++) grid.appendChild(UI.el('div', { class: 'cal-cell other' }));
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calState.year}-${String(calState.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cell = UI.el('div', { class: 'cal-cell' + (dateStr === todayStr ? ' today' : ''), style: 'min-height:60px' });
      cell.appendChild(UI.el('div', { class: 'cal-date' }, String(d)));
      tasks
        .filter((t) => t.due_date === dateStr)
        .forEach((t) => {
          const overdue = dateStr < todayStr && t.status !== 'Completada';
          cell.appendChild(
            UI.el(
              'div',
              {
                class: 'cal-item ' + (t.status === 'Completada' ? 'ok' : overdue ? 'danger' : ''),
                title: t.name + ' · ' + (t.user_name || 'Sin asignar'),
                onClick: (e) => { e.stopPropagation(); taskForm(t, allProjects, users, project.id); }
              },
              t.name
            )
          );
        });
      grid.appendChild(cell);
    }
    cal.appendChild(grid);
    card.appendChild(cal);
    return card;
  }

  // ---------- Activity card ----------
  function activityCard() {
    const card = UI.el('div', { class: 'card' });
    card.appendChild(UI.el('h2', { style: 'margin:0 0 10px;font-size:1rem;color:var(--dark)' }, 'Historial de actividad'));
    if (activity.length === 0) {
      card.appendChild(UI.el('p', { style: 'color:var(--muted);font-size:0.85rem' }, 'Sin actividad registrada todavía.'));
    } else {
      card.appendChild(
        UI.el(
          'div',
          { class: 'activity-list' },
          activity.map((a) =>
            UI.el('div', { class: 'activity-item' }, [
              UI.el('div', { style: 'font-size:0.85rem;color:var(--dark)' }, a.description),
              UI.el('div', { style: 'font-size:0.72rem;color:var(--muted);margin-top:2px' }, [a.user_name || 'Sistema', ' · ', a.created_at])
            ])
          )
        )
      );
    }
    return card;
  }

  render();
}
