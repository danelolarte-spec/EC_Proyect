(async function () {
  const me = await API.get('/api/auth/me');
  if (!me) {
    window.location.href = '/';
    return;
  }
  document.getElementById('userName').textContent = me.name;
  document.getElementById('userEmail').textContent = me.email;
  document.getElementById('userAvatar').textContent = (me.name || '?').charAt(0).toUpperCase();

  const isAdmin = me.role === 'admin';
  if (!isAdmin) {
    document.querySelectorAll('.nav a[data-route="users"], .nav a[data-route="areas"]').forEach((a) => a.remove());
  }

  document.getElementById('themeToggleHost').appendChild(Theme.widget());

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await API.post('/api/auth/logout', {});
    window.location.href = '/';
  });

  const sidebar = document.getElementById('sidebar');
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('show');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }

  document.getElementById('menuBtn').addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  overlay.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
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

  // Guards against a slow navigation (e.g. Render's cold-start delay) finishing after
  // a newer one started — otherwise both would render into the same #view element and
  // their content would mix together once the slow one's data finally arrives.
  let navToken = 0;

  async function navigate() {
    const myToken = ++navToken;
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const route = hash.split('?')[0];
    const projectDetailMatch = route.match(/^project\/(\d+)$/);
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === (projectDetailMatch ? 'projects' : route)));
    const view = document.getElementById('view');
    view.innerHTML = '';
    view.classList.remove('view-enter');
    const loadingEl = UI.loading();
    loadingEl.classList.add('view-loading-overlay');
    view.appendChild(loadingEl);

    // Each navigation builds into its own private container instead of the live #view
    // element, so a stale (superseded) navigation simply never gets attached — it can't
    // interleave its content with whatever navigation is current by the time it resolves.
    const container = document.createElement('div');
    try {
      if (!isAdmin && (route === 'users' || route === 'areas')) {
        container.appendChild(UI.el('div', { class: 'empty' }, 'No tienes permisos para ver esta sección.'));
      } else if (projectDetailMatch) {
        await ProjectDetailView(container, projectDetailMatch[1]);
      } else {
        const fn = routes[route] || DashboardView;
        await fn(container);
      }
    } catch (e) {
      if (myToken === navToken) view.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
      return;
    }
    if (myToken !== navToken) return; // a newer navigation started meanwhile; discard this one

    view.innerHTML = '';
    view.appendChild(container);
    // restart the fade-in animation on every navigation, including same-route refreshes
    void view.offsetWidth;
    view.classList.add('view-enter');
    if (window.innerWidth <= 900) closeSidebar();
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
