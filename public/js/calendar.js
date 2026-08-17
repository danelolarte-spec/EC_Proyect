async function CalendarView(root) {
  const state = { year: new Date().getFullYear(), month: new Date().getMonth() };

  async function render() {
    root.innerHTML = '';
    const [tasks, creative] = await Promise.all([API.get('/api/tasks'), API.get('/api/creative/content')]);

    root.appendChild(
      UI.el('div', { class: 'page-header' }, [
        UI.el('div', {}, [UI.el('h1', {}, 'Cronograma'), UI.el('span', { class: 'hint' }, 'Tareas y publicaciones por fecha de entrega')]),
        UI.el('div', { class: 'view-toggle' }, [
          UI.el('button', { class: 'active' }, 'Calendario'),
          UI.el('button', { onClick: () => (window.location.hash = '#tasks') }, 'Lista'),
          UI.el('button', { onClick: () => (window.location.hash = '#kanban') }, 'Kanban')
        ])
      ])
    );

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

    const todayStr = new Date().toISOString().slice(0, 10);

    // Leading empty cells
    for (let i = 0; i < startDow; i++) {
      grid.appendChild(UI.el('div', { class: 'cal-cell other' }));
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${state.year}-${String(state.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const cell = UI.el('div', { class: 'cal-cell' + (isToday ? ' today' : '') });
      cell.appendChild(UI.el('div', { class: 'cal-date' }, String(d)));

      const dayTasks = tasks.filter((t) => t.due_date === dateStr);
      const dayContent = creative.filter((c) => c.publish_date === dateStr);

      dayTasks.slice(0, 3).forEach((t) => {
        const overdue = dateStr < todayStr && t.status !== 'Completada';
        cell.appendChild(
          UI.el(
            'div',
            {
              class: 'cal-item ' + (t.status === 'Completada' ? 'ok' : overdue ? 'danger' : ''),
              title: t.name + ' · ' + (t.user_name || ''),
              onClick: (e) => { e.stopPropagation(); showTaskDates(t); }
            },
            '✓ ' + t.name
          )
        );
      });
      dayContent.slice(0, 3).forEach((c) => {
        cell.appendChild(
          UI.el(
            'div',
            {
              class: 'cal-item warn',
              title: c.brand + ': ' + c.topic,
              onClick: (e) => { e.stopPropagation(); showContentDates(c); }
            },
            '✦ ' + c.topic
          )
        );
      });
      const extra = dayTasks.length + dayContent.length - 6;
      if (extra > 0) cell.appendChild(UI.el('div', { style: 'font-size:0.7rem;color:var(--muted)' }, '+' + extra + ' más'));

      grid.appendChild(cell);
    }
    cal.appendChild(grid);
    root.appendChild(cal);

    // Legend
    root.appendChild(
      UI.el('div', { style: 'margin-top:14px;display:flex;gap:14px;flex-wrap:wrap;font-size:0.82rem;color:var(--muted)' }, [
        UI.el('span', {}, [UI.el('span', { style: 'display:inline-block;width:10px;height:10px;background:var(--dark);border-radius:2px;margin-right:6px;vertical-align:middle' }), ' Tarea pendiente']),
        UI.el('span', {}, [UI.el('span', { style: 'display:inline-block;width:10px;height:10px;background:var(--success);border-radius:2px;margin-right:6px;vertical-align:middle' }), ' Tarea completada']),
        UI.el('span', {}, [UI.el('span', { style: 'display:inline-block;width:10px;height:10px;background:var(--danger);border-radius:2px;margin-right:6px;vertical-align:middle' }), ' Tarea vencida']),
        UI.el('span', {}, [UI.el('span', { style: 'display:inline-block;width:10px;height:10px;background:var(--warn);border-radius:2px;margin-right:6px;vertical-align:middle' }), ' Publicación creativa'])
      ])
    );
  }
  render();
}

function calInfoRow(label, value) {
  return UI.el('div', { style: 'display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)' }, [
    UI.el('span', { style: 'color:var(--muted);font-size:0.85rem' }, label),
    UI.el('span', { style: 'font-weight:600;color:var(--text);font-size:0.85rem;text-align:right' }, value || '—')
  ]);
}

function showTaskDates(t) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = t.due_date && t.due_date < today && t.status !== 'Completada';
  const body = UI.el('div', {}, [
    UI.el('div', { style: 'margin-bottom:10px' }, [UI.badge(t.status, taskStatusVariant(t.status)), overdue ? ' ' : null, overdue ? UI.badge('Vencida', 'danger') : null]),
    calInfoRow('Proyecto', t.project_code ? t.project_code + ' · ' + t.project_name : 'Sin proyecto'),
    calInfoRow('Responsable', t.user_name || 'Sin asignar'),
    calInfoRow('Fecha de asignación', UI.fmtDate(t.assigned_date)),
    calInfoRow('Fecha de entrega', UI.fmtDate(t.due_date)),
    t.objective ? UI.el('div', { style: 'margin-top:12px;font-size:0.85rem;color:var(--muted)' }, [UI.el('strong', { style: 'color:var(--text)' }, 'Objetivo: '), t.objective]) : null
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

function showContentDates(c) {
  const body = UI.el('div', {}, [
    UI.el('div', { style: 'margin-bottom:10px' }, [UI.badge(c.brand, 'dark'), ' ', UI.badge(c.status, 'gold')]),
    calInfoRow('Fecha de publicación', UI.fmtDate(c.publish_date)),
    calInfoRow('Hora', c.publish_time || '—'),
    calInfoRow('Formato', c.format || '—'),
    calInfoRow('Objetivo', c.objective || '—')
  ]);
  const m = UI.modal({
    title: c.topic || 'Contenido creativo',
    body,
    footer: [UI.el('button', { class: 'btn btn-primary', onClick: () => { m.close(); window.location.hash = '#creative'; } }, 'Ir a Área Creativa')]
  });
}
