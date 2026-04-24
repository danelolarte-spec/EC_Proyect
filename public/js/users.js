async function UsersView(root) {
  const [users, areas, projects] = await Promise.all([
    API.get('/api/users'),
    API.get('/api/areas'),
    API.get('/api/projects')
  ]);

  root.appendChild(
    UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h1', {}, 'Usuarios'), UI.el('span', { class: 'hint' }, 'Administra los usuarios del sistema')]),
      UI.el('button', { class: 'btn btn-primary', onClick: () => userForm(null, areas, projects) }, '+ Nuevo usuario')
    ])
  );

  const table = UI.el('table', { class: 'data' }, [
    UI.el('thead', {}, UI.el('tr', {}, [
      UI.el('th', {}, 'Nombre'),
      UI.el('th', {}, 'Correo'),
      UI.el('th', {}, 'Rol'),
      UI.el('th', {}, 'Áreas'),
      UI.el('th', {}, 'Proyectos'),
      UI.el('th', {}, 'Acciones')
    ])),
    UI.el(
      'tbody',
      {},
      users.map((u) =>
        UI.el('tr', {}, [
          UI.el('td', {}, UI.el('strong', {}, u.name)),
          UI.el('td', {}, u.email),
          UI.el('td', {}, UI.badge(u.role, u.role === 'admin' ? 'dark' : '')),
          UI.el('td', {}, u.areas.map((a) => a.name).join(', ') || '—'),
          UI.el('td', {}, u.projects.map((p) => p.name).join(', ') || '—'),
          UI.el('td', {}, UI.el('div', { class: 'actions' }, [
            UI.el('button', { class: 'btn btn-ghost', onClick: () => userForm(u, areas, projects) }, 'Editar'),
            UI.el(
              'button',
              { class: 'btn btn-danger', onClick: () => UI.confirmDialog('¿Eliminar usuario "' + u.name + '"?', async () => {
                await API.del('/api/users/' + u.id);
                UI.toast('Usuario eliminado', 'success');
                refresh();
              }) },
              'Eliminar'
            )
          ]))
        ])
      )
    )
  ]);
  root.appendChild(UI.el('div', { class: 'tbl-wrap' }, table));
}

function userForm(user, areas, projects) {
  const nameI = UI.input({ type: 'text', required: true }, user ? user.name : '');
  const emailI = UI.input({ type: 'email', required: true }, user ? user.email : '');
  const passI = UI.input({ type: 'password', placeholder: user ? 'Dejar vacío para mantener' : '' }, '');
  const roleI = UI.select(
    [
      { value: 'user', label: 'Usuario' },
      { value: 'admin', label: 'Administrador' }
    ],
    user ? user.role : 'user'
  );
  const areasI = UI.multiCheck(
    areas.map((a) => ({ value: a.id, label: a.name })),
    user ? user.areas.map((a) => a.id) : [],
    'areas'
  );
  const projectsI = UI.multiCheck(
    projects.map((p) => ({ value: p.id, label: p.code + ' · ' + p.name })),
    user ? user.projects.map((p) => p.id) : [],
    'projects'
  );

  const body = UI.el('div', {}, [
    UI.formRow('Nombre', nameI),
    UI.formRow('Correo electrónico', emailI),
    UI.formRow(user ? 'Nueva contraseña (opcional)' : 'Contraseña', passI),
    UI.formRow('Rol', roleI),
    UI.formRow('Áreas asignadas', areasI),
    UI.formRow('Proyectos asignados', projectsI)
  ]);

  const m = UI.modal({
    title: user ? 'Editar usuario' : 'Nuevo usuario',
    body,
    footer: [
      UI.el('button', { class: 'btn btn-ghost', onClick: () => m.close() }, 'Cancelar'),
      UI.el(
        'button',
        {
          class: 'btn btn-primary',
          onClick: async () => {
            try {
              const payload = {
                name: nameI.value,
                email: emailI.value,
                password: passI.value,
                role: roleI.value,
                areas: areasI.getValues().map(Number),
                projects: projectsI.getValues().map(Number)
              };
              if (user) await API.put('/api/users/' + user.id, payload);
              else await API.post('/api/users', payload);
              m.close();
              UI.toast('Usuario guardado', 'success');
              refresh();
            } catch (e) {
              UI.toast(e.message, 'error');
            }
          }
        },
        'Guardar'
      )
    ]
  });
}

function refresh() {
  // Re-trigger the current view
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
