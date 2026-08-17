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

  async function moveTask(task, status) {
    if (!task || task.status === status) return;
    try {
      await API.put('/api/tasks/' + task.id, { ...task, status });
      UI.toast('Estado actualizado', 'success');
      refresh();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  const board = UI.el('div', { class: 'kanban' });
  statuses.forEach((status) => {
    const colTasks = tasks.filter((t) => t.status === status);
    const col = UI.el('div', { class: 'kan-col', dataset: { status } });
    col.appendChild(
      UI.el('h3', {}, [status, UI.el('span', { class: 'count' }, colTasks.length)])
    );
    colTasks.forEach((t) => {
      const moveSelect = UI.select(
        statuses.filter((s) => s !== status).map((s) => ({ value: s, label: 'Mover a: ' + s })),
        '',
        { class: 'kan-move' }
      );
      moveSelect.insertBefore(UI.el('option', { value: '', disabled: true }, 'Mover a...'), moveSelect.firstChild);
      moveSelect.value = '';
      moveSelect.addEventListener('click', (e) => e.stopPropagation());
      moveSelect.addEventListener('change', () => {
        if (moveSelect.value) moveTask(t, moveSelect.value);
      });
      const card = UI.el('div', { class: 'kan-card', draggable: true, dataset: { id: t.id } }, [
        UI.el('strong', {}, t.name),
        t.project_code ? UI.el('div', { style: 'font-size:0.75rem;color:var(--muted)' }, t.project_code + ' · ' + t.project_name) : null,
        UI.el('small', {}, (t.user_name || 'Sin asignar') + ' · ' + (t.due_date || 'Sin fecha')),
        moveSelect
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
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      moveTask(tasks.find((t) => String(t.id) === id), status);
    });
    board.appendChild(col);
  });
  root.appendChild(board);
}
