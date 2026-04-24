async function KanbanView(root) {
  const tasks = await API.get('/api/tasks');

  root.appendChild(
    UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h1', {}, 'Kanban'), UI.el('span', { class: 'hint' }, 'Arrastra tarjetas para cambiar de estado')]),
      UI.el('div', { class: 'view-toggle' }, [
        UI.el('button', { onClick: () => (window.location.hash = '#tasks') }, 'Lista'),
        UI.el('button', { onClick: () => (window.location.hash = '#calendar') }, 'Calendario'),
        UI.el('button', { class: 'active' }, 'Kanban')
      ])
    ])
  );

  const statuses = ['Pendiente', 'En progreso', 'Revisión', 'Completada', 'Cancelada'];
  const board = UI.el('div', { class: 'kanban' });
  statuses.forEach((status) => {
    const colTasks = tasks.filter((t) => t.status === status);
    const col = UI.el('div', { class: 'kan-col', dataset: { status } });
    col.appendChild(
      UI.el('h3', {}, [status, UI.el('span', { class: 'count' }, colTasks.length)])
    );
    colTasks.forEach((t) => {
      const card = UI.el('div', { class: 'kan-card', draggable: true, dataset: { id: t.id } }, [
        UI.el('strong', {}, t.name),
        t.project_code ? UI.el('div', { style: 'font-size:0.75rem;color:var(--muted)' }, t.project_code + ' · ' + t.project_name) : null,
        UI.el('small', {}, (t.user_name || 'Sin asignar') + ' · ' + (t.due_date || 'Sin fecha'))
      ]);
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        card.style.opacity = '0.5';
      });
      card.addEventListener('dragend', () => (card.style.opacity = '1'));
      col.appendChild(card);
    });
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      const task = tasks.find((t) => String(t.id) === id);
      if (!task || task.status === status) return;
      try {
        await API.put('/api/tasks/' + id, { ...task, status });
        UI.toast('Estado actualizado', 'success');
        refresh();
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    });
    board.appendChild(col);
  });
  root.appendChild(board);
}
