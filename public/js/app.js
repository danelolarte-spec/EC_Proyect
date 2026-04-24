(async function () {
  const me = await API.get('/api/auth/me');
  if (!me) {
    window.location.href = '/';
    return;
  }
  document.getElementById('userName').textContent = me.name;
  document.getElementById('userEmail').textContent = me.email;
  document.getElementById('userAvatar').textContent = (me.name || '?').charAt(0).toUpperCase();

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await API.post('/api/auth/logout', {});
    window.location.href = '/';
  });

  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  const routes = {
    dashboard: DashboardView,
    projects: ProjectsView,
    tasks: TasksView,
    calendar: CalendarView,
    kanban: KanbanView,
    creative: CreativeView,
    'creative-tasks': CreativeTasksView,
    requests: RequestsView,
    users: UsersView,
    areas: AreasView
  };

  async function navigate() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const route = hash.split('?')[0];
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
    const view = document.getElementById('view');
    view.innerHTML = '';
    const fn = routes[route] || DashboardView;
    try {
      await fn(view);
    } catch (e) {
      view.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
    }
    if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
  }

  window.addEventListener('hashchange', navigate);
  navigate();

  // Global search
  document.getElementById('globalSearch').addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const q = e.target.value.trim().toLowerCase();
    if (!q) return;
    const [projects, tasks, content] = await Promise.all([
      API.get('/api/projects'),
      API.get('/api/tasks'),
      API.get('/api/creative/content')
    ]);
    const matches = [
      ...projects.filter((p) => (p.name + ' ' + p.code).toLowerCase().includes(q)).map((p) => ({ type: 'Proyecto', label: `${p.code} · ${p.name}`, link: '#projects' })),
      ...tasks.filter((t) => t.name.toLowerCase().includes(q)).map((t) => ({ type: 'Tarea', label: t.name, link: '#tasks' })),
      ...content.filter((c) => (c.topic || '').toLowerCase().includes(q)).map((c) => ({ type: 'Contenido', label: `${c.brand}: ${c.topic}`, link: '#creative' }))
    ];
    const body = UI.el('div', {}, [
      matches.length === 0
        ? UI.el('p', {}, 'Sin resultados.')
        : UI.el(
            'ul',
            { style: 'list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px' },
            matches.slice(0, 30).map((m) =>
              UI.el(
                'li',
                { style: 'padding:10px;border:1px solid #e3e8ec;border-radius:8px;cursor:pointer', onClick: () => { window.location.hash = m.link; document.querySelector('.modal-backdrop').remove(); } },
                [UI.el('strong', {}, m.type + ': '), m.label]
              )
            )
          )
    ]);
    UI.modal({ title: `Búsqueda: "${q}"`, body });
  });
})();
