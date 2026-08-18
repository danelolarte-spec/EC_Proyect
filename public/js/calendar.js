async function CalendarView(root) {
  const state = { year: new Date().getFullYear(), month: new Date().getMonth(), project: '', brand: '' };

  async function render() {
    root.innerHTML = '';
    const [tasks, creative, projects] = await Promise.all([
      API.get('/api/tasks'),
      API.get('/api/creative/content'),
      API.get('/api/projects')
    ]);
    const projectById = {};
    projects.forEach((p) => (projectById[p.id] = p));

    root.appendChild(
      UI.el('div', { class: 'page-header' }, [
        UI.el('div', {}, [UI.el('h1', {}, 'Cronograma'), UI.el('span', { class: 'hint' }, 'Vista estratégica de entregas, publicaciones e hitos')]),
        UI.el('div', { class: 'view-toggle' }, [
          UI.el('button', { class: 'active' }, 'Calendario'),
          UI.el('button', { onClick: () => (window.location.hash = '#tasks') }, 'Lista'),
          UI.el('button', { onClick: () => (window.location.hash = '#kanban') }, 'Kanban')
        ])
      ])
    );

    // ---------- Filters ----------
    const projectF = UI.select(
      [{ value: '', label: 'Todos los proyectos' }].concat(projects.map((p) => ({ value: p.id, label: p.code + ' · ' + p.name }))),
      state.project
    );
    const brandF = UI.select(
      [{ value: '', label: 'Todas las marcas' }].concat(EC_BRANDS.map((b) => ({ value: b, label: b }))),
      state.brand
    );
    projectF.addEventListener('change', () => { state.project = projectF.value; render(); });
    brandF.addEventListener('change', () => { state.brand = brandF.value; render(); });
    root.appendChild(
      UI.el('div', { class: 'toolbar' }, [
        UI.el('span', { style: 'font-weight:600;color:var(--text);font-size:0.85rem' }, 'Filtrar por:'),
        projectF,
        brandF
      ])
    );

    // ---------- Apply filters ----------
    const brandOfProject = (pid) => (projectById[pid] ? projectById[pid].brand : null);
    const filteredTasks = tasks.filter(
      (t) => (!state.project || String(t.project_id) === String(state.project)) && (!state.brand || brandOfProject(t.project_id) === state.brand)
    );
    const filteredContent = state.project ? [] : creative.filter((c) => !state.brand || c.brand === state.brand);
    const milestoneProjects = projects.filter(
      (p) => p.end_date && (!state.project || String(p.id) === String(state.project)) && (!state.brand || p.brand === state.brand)
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toISOString().slice(0, 10);
    const monthStr = `${state.year}-${String(state.month + 1).padStart(2, '0')}`;

    // ---------- Strategic KPI strip ----------
    const overdueCount = filteredTasks.filter((t) => t.due_date && t.due_date < todayStr && t.status !== 'Completada').length;
    const next7Count =
      filteredTasks.filter((t) => t.due_date && t.due_date >= todayStr && t.due_date <= in7Str && t.status !== 'Completada').length +
      filteredContent.filter((c) => c.publish_date && c.publish_date >= todayStr && c.publish_date <= in7Str).length;
    const milestonesThisMonth = milestoneProjects.filter((p) => p.end_date && p.end_date.slice(0, 7) === monthStr).length;
    root.appendChild(
      UI.el('div', { class: 'cards-grid' }, [
        statTile('Vencidas', overdueCount, overdueCount ? 'danger' : 'ok'),
        statTile('Próximos 7 días', next7Count, next7Count ? 'warn' : 'ok'),
        statTile('Hitos este mes', milestonesThisMonth, '')
      ])
    );

    const layout = UI.el('div', { class: 'calendar-layout' });

    // ---------- Calendar grid ----------
    const first = new Date(state.year, state.month, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dows = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

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

    function rescheduleItem(kind, item, newDate) {
      const field = kind === 'task' ? 'due_date' : 'publish_date';
      if (item[field] === newDate) return;
      const req = kind === 'task'
        ? API.put('/api/tasks/' + item.id, { ...item, due_date: newDate })
        : API.put('/api/creative/content/' + item.id, { ...item, publish_date: newDate, networks: JSON.parse(item.networks || '[]') });
      req.then(
        () => { UI.toast('Fecha actualizada', 'success'); render(); },
        (err) => UI.toast(err.message, 'error')
      );
    }

    // Leading empty cells
    for (let i = 0; i < startDow; i++) {
      grid.appendChild(UI.el('div', { class: 'cal-cell other' }));
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${state.year}-${String(state.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const cell = UI.el('div', { class: 'cal-cell' + (isToday ? ' today' : '') });

      const dayTasks = filteredTasks.filter((t) => t.due_date === dateStr);
      const dayContent = filteredContent.filter((c) => c.publish_date === dateStr);
      const dayMilestones = milestoneProjects.filter((p) => p.end_date === dateStr);
      const dayOverdue = dayTasks.filter((t) => t.status !== 'Completada' && dateStr < todayStr).length;

      cell.appendChild(
        UI.el('div', { class: 'cal-date' }, [
          UI.el('span', {}, String(d)),
          dayOverdue ? UI.el('span', { class: 'cal-day-badge' }, dayOverdue) : null
        ])
      );

      dayMilestones.forEach((p) => {
        cell.appendChild(
          UI.el('div', { class: 'cal-item milestone', title: 'Hito: ' + p.name, onClick: (e) => { e.stopPropagation(); showMilestone(p); } }, '🏁 ' + p.name)
        );
      });
      dayTasks.slice(0, 3).forEach((t) => {
        const overdue = dateStr < todayStr && t.status !== 'Completada';
        const chip = UI.el(
          'div',
          {
            class: 'cal-item ' + (t.status === 'Completada' ? 'ok' : overdue ? 'danger' : ''),
            title: t.name + ' · ' + (t.user_name || ''),
            draggable: true,
            onClick: (e) => { e.stopPropagation(); showTaskDates(t, rescheduleItem); }
          },
          '✓ ' + t.name
        );
        chip.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', 'task:' + t.id); });
        cell.appendChild(chip);
      });
      dayContent.slice(0, 3).forEach((c) => {
        const chip = UI.el(
          'div',
          {
            class: 'cal-item warn',
            title: c.brand + ': ' + c.topic,
            draggable: true,
            onClick: (e) => { e.stopPropagation(); showContentDates(c, rescheduleItem); }
          },
          '✦ ' + c.topic
        );
        chip.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', 'content:' + c.id); });
        cell.appendChild(chip);
      });
      const extra = dayTasks.length + dayContent.length + dayMilestones.length - 6;
      if (extra > 0) cell.appendChild(UI.el('div', { style: 'font-size:0.7rem;color:var(--muted)' }, '+' + extra + ' más'));

      cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drop-target'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drop-target'));
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('drop-target');
        const raw = e.dataTransfer.getData('text/plain');
        const [kind, id] = raw.split(':');
        if (kind === 'task') {
          const t = tasks.find((x) => String(x.id) === id);
          if (t) rescheduleItem('task', t, dateStr);
        } else if (kind === 'content') {
          const c = creative.find((x) => String(x.id) === id);
          if (c) rescheduleItem('content', c, dateStr);
        }
      });

      grid.appendChild(cell);
    }
    cal.appendChild(grid);

    // Legend
    cal.appendChild(
      UI.el('div', { style: 'margin-top:14px;display:flex;gap:14px;flex-wrap:wrap;font-size:0.82rem;color:var(--muted)' }, [
        legendDot('var(--brand)', 'Tarea pendiente'),
        legendDot('var(--success)', 'Tarea completada'),
        legendDot('var(--danger)', 'Tarea vencida'),
        legendDot('var(--warn)', 'Publicación creativa'),
        legendDot('var(--info)', 'Hito de proyecto'),
        UI.el('span', { style: 'font-style:italic' }, 'Arrastra una tarjeta a otro día para reprogramarla')
      ])
    );
    layout.appendChild(cal);

    // ---------- Strategic agenda sidebar ----------
    const agendaItems = [];
    filteredTasks.forEach((t) => {
      if (!t.due_date || t.status === 'Completada') return;
      agendaItems.push({ date: t.due_date, name: t.name, meta: t.project_code || 'Sin proyecto', onClick: () => showTaskDates(t, rescheduleItem) });
    });
    filteredContent.forEach((c) => {
      if (!c.publish_date) return;
      agendaItems.push({ date: c.publish_date, name: c.topic || 'Contenido', meta: c.brand, onClick: () => showContentDates(c, rescheduleItem) });
    });
    milestoneProjects.forEach((p) => {
      agendaItems.push({ date: p.end_date, name: '🏁 ' + p.name, meta: 'Fin de proyecto', onClick: () => showMilestone(p) });
    });
    agendaItems.sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = agendaItems.filter((i) => i.date >= todayStr).slice(0, 10);

    const monShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const agendaCard = UI.el('div', { class: 'card agenda-card' }, [
      UI.el('h2', { style: 'margin:0 0 4px;font-size:1rem;color:var(--text)' }, 'Próximos vencimientos'),
      UI.el('div', { style: 'font-size:0.78rem;color:var(--muted);margin-bottom:10px' }, 'Los más próximos primero')
    ]);
    if (upcoming.length === 0) {
      agendaCard.appendChild(UI.el('div', { class: 'empty' }, 'No hay vencimientos próximos.'));
    } else {
      const list = UI.el('div', { class: 'agenda-list' });
      upcoming.forEach((item) => {
        const d = new Date(item.date + 'T00:00:00');
        list.appendChild(
          UI.el('div', { class: 'agenda-item', onClick: item.onClick }, [
            UI.el('div', { class: 'ai-date' }, [UI.el('div', { class: 'ai-day' }, String(d.getDate())), UI.el('div', { class: 'ai-mon' }, monShort[d.getMonth()])]),
            UI.el('div', { class: 'ai-main' }, [UI.el('div', { class: 'ai-name' }, item.name), UI.el('div', { class: 'ai-meta' }, item.meta || '')])
          ])
        );
      });
      agendaCard.appendChild(list);
    }
    layout.appendChild(agendaCard);

    root.appendChild(layout);
  }
  render();
}

function legendDot(color, label) {
  return UI.el('span', {}, [UI.el('span', { style: `display:inline-block;width:10px;height:10px;background:${color};border-radius:2px;margin-right:6px;vertical-align:middle` }), ' ' + label]);
}

function statTile(label, num, variant) {
  return UI.el('div', { class: 'stat-card ' + (variant || '') }, [UI.el('h3', {}, label), UI.el('div', { class: 'num' }, String(num))]);
}

function calInfoRow(label, value) {
  return UI.el('div', { style: 'display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)' }, [
    UI.el('span', { style: 'color:var(--muted);font-size:0.85rem' }, label),
    UI.el('span', { style: 'font-weight:600;color:var(--text);font-size:0.85rem;text-align:right' }, value || '—')
  ]);
}

function rescheduleRow(currentDate, onSave) {
  const dateI = UI.input({ type: 'date' }, currentDate || '');
  return UI.el('div', { style: 'display:flex;gap:8px;align-items:flex-end;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)' }, [
    UI.formRow('Reprogramar a', dateI),
    UI.el('button', { class: 'btn btn-gold small', onClick: () => dateI.value && onSave(dateI.value) }, 'Guardar')
  ]);
}

function showTaskDates(t, rescheduleItem) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = t.due_date && t.due_date < today && t.status !== 'Completada';
  const body = UI.el('div', {}, [
    UI.el('div', { style: 'margin-bottom:10px' }, [UI.badge(t.status, taskStatusVariant(t.status)), overdue ? ' ' : null, overdue ? UI.badge('Vencida', 'danger') : null]),
    calInfoRow('Proyecto', t.project_code ? t.project_code + ' · ' + t.project_name : 'Sin proyecto'),
    calInfoRow('Responsable', t.user_name || 'Sin asignar'),
    calInfoRow('Fecha de asignación', UI.fmtDate(t.assigned_date)),
    calInfoRow('Fecha de entrega', UI.fmtDate(t.due_date)),
    t.objective ? UI.el('div', { style: 'margin-top:12px;font-size:0.85rem;color:var(--muted)' }, [UI.el('strong', { style: 'color:var(--text)' }, 'Objetivo: '), t.objective]) : null,
    rescheduleRow(t.due_date, (newDate) => { m.close(); rescheduleItem('task', t, newDate); })
  ]);
  const m = UI.modal({
    title: t.name,
    body,
    footer: [
      t.project_id
        ? UI.el('button', { class: 'btn btn-gold', onClick: () => { m.close(); window.location.hash = '#project/' + t.project_id; } }, 'Ver proyecto')
        : null,
      UI.el('button', { class: 'btn btn-primary', onClick: () => { m.close(); window.location.hash = '#tasks'; } }, 'Ir a Tareas')
    ]
  });
}

function showContentDates(c, rescheduleItem) {
  const body = UI.el('div', {}, [
    UI.el('div', { style: 'margin-bottom:10px' }, [UI.badge(c.brand, 'dark'), ' ', UI.badge(c.status, 'gold')]),
    calInfoRow('Fecha de publicación', UI.fmtDate(c.publish_date)),
    calInfoRow('Hora', c.publish_time || '—'),
    calInfoRow('Responsable', c.user_name || 'Sin asignar'),
    calInfoRow('Formato', c.format || '—'),
    calInfoRow('Objetivo', c.objective || '—'),
    rescheduleRow(c.publish_date, (newDate) => { m.close(); rescheduleItem('content', c, newDate); })
  ]);
  const m = UI.modal({
    title: c.topic || 'Contenido creativo',
    body,
    footer: [UI.el('button', { class: 'btn btn-primary', onClick: () => { m.close(); window.location.hash = '#creative'; } }, 'Ir a Área Creativa')]
  });
}

function showMilestone(p) {
  const body = UI.el('div', {}, [
    UI.el('div', { style: 'margin-bottom:10px' }, [
      UI.badge(p.status, p.status === 'Completado' ? 'ok' : 'info'),
      p.category === 'Marca' ? UI.badge(p.brand, 'dark') : p.category === 'Innovación' ? UI.badge('Innovación', 'gold') : null
    ]),
    calInfoRow('Código', p.code),
    calInfoRow('Fecha de cierre', UI.fmtDate(p.end_date)),
    calInfoRow('Avance', p.progress + '% (' + p.tasks_done + '/' + p.tasks_total + ')'),
    calInfoRow('Presupuesto', '$' + (p.budget || 0).toLocaleString()),
    p.objective ? UI.el('div', { style: 'margin-top:12px;font-size:0.85rem;color:var(--muted)' }, [UI.el('strong', { style: 'color:var(--text)' }, 'Objetivo: '), p.objective]) : null
  ]);
  const m = UI.modal({
    title: '🏁 ' + p.name,
    body,
    footer: [UI.el('button', { class: 'btn btn-gold', onClick: () => { m.close(); window.location.hash = '#project/' + p.id; } }, 'Ver ficha del proyecto')]
  });
}
