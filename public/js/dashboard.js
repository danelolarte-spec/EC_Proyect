async function DashboardView(root) {
  const data = await API.get('/api/dashboard');
  const header = UI.el('div', { class: 'page-header' }, [
    UI.el('div', {}, [UI.el('h1', {}, 'Dashboard'), UI.el('span', { class: 'hint' }, 'Vista general del sistema')]),
  ]);
  root.appendChild(header);

  const stats = UI.el('div', { class: 'cards-grid' }, [
    statCard('Proyectos activos', data.active, '', '#projects'),
    statCard('Proyectos completados', data.completed, 'ok', '#projects'),
    statCard('Total proyectos', data.total, '', '#projects'),
    statCard('Tareas vencidas', data.overdueTasks, data.overdueTasks ? 'danger' : 'ok', '#tasks'),
    statCard('Tareas pendientes', data.pendingTasks, 'warn', '#tasks'),
    statCard('Usuarios', data.totalUsers, '', '#users'),
    statCard('Áreas', data.totalAreas, '', '#areas'),
    statCard('Contenido del mes', data.contentThisMonth, 'warn', '#creative')
  ]);
  root.appendChild(stats);

  const progressCard = UI.el('div', { class: 'card', style: 'margin-top:18px' }, [
    UI.el('h2', { style: 'margin-top:0;color:var(--dark);font-size:1.1rem' }, 'Avance por proyecto'),
    data.projectsProgress.length === 0
      ? UI.el('p', { class: 'empty' }, 'Aún no hay proyectos.')
      : UI.el(
          'div',
          { style: 'display:flex;flex-direction:column;gap:12px' },
          data.projectsProgress.map((p) =>
            UI.el('div', {}, [
              UI.el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px' }, [
                UI.el('span', {}, [UI.el('strong', {}, p.code + ' · ' + p.name), ' ', UI.badge(p.status, statusVariant(p.status))]),
                UI.el('span', { style: 'color:var(--muted);font-size:0.82rem' }, p.progress + '%')
              ]),
              UI.el('div', { class: 'progress' }, UI.el('span', { style: `width:${p.progress}%` }))
            ])
          )
        )
  ]);
  root.appendChild(progressCard);
}

function statCard(label, num, variant, link) {
  return UI.el(
    'div',
    {
      class: 'stat-card ' + (variant || '') + (link ? ' clickable' : ''),
      onClick: link ? () => (window.location.hash = link) : null,
      role: link ? 'button' : null,
      tabindex: link ? '0' : null
    },
    [UI.el('h3', {}, label), UI.el('div', { class: 'num' }, String(num || 0))]
  );
}

function statusVariant(status) {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s.includes('complet')) return 'ok';
  if (s.includes('curso') || s.includes('progreso')) return 'gold';
  if (s.includes('vencid') || s.includes('cancel')) return 'danger';
  if (s.includes('pend') || s.includes('plan')) return 'info';
  return '';
}
