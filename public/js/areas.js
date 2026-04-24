async function AreasView(root) {
  const areas = await API.get('/api/areas');

  root.appendChild(
    UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h1', {}, 'Áreas'), UI.el('span', { class: 'hint' }, 'Áreas organizacionales de la empresa')]),
      UI.el('button', { class: 'btn btn-primary', onClick: () => areaForm(null) }, '+ Nueva área')
    ])
  );

  if (areas.length === 0) {
    root.appendChild(UI.el('div', { class: 'empty' }, 'No hay áreas creadas. Crea la primera área.'));
    return;
  }

  const grid = UI.el('div', { class: 'cards-grid' });
  areas.forEach((a) => {
    grid.appendChild(
      UI.el('div', { class: 'card' }, [
        UI.el('h3', { style: 'margin:0 0 6px;color:var(--dark)' }, a.name),
        UI.el('p', { style: 'color:var(--muted);font-size:0.88rem;margin:0 0 10px' }, a.description || 'Sin descripción'),
        UI.el('div', { style: 'font-size:0.82rem;color:var(--muted);margin-bottom:10px' }, [
          UI.badge(a.users.length + ' usuarios', 'gold')
        ]),
        UI.el('div', { style: 'font-size:0.82rem;margin-bottom:10px' }, a.users.map((u) => u.name).join(', ') || '—'),
        UI.el('div', { style: 'display:flex;gap:6px' }, [
          UI.el('button', { class: 'btn btn-ghost small', onClick: () => areaForm(a) }, 'Editar'),
          UI.el('button', { class: 'btn btn-danger small', onClick: () => UI.confirmDialog('¿Eliminar área "' + a.name + '"?', async () => {
            await API.del('/api/areas/' + a.id);
            UI.toast('Área eliminada', 'success');
            refresh();
          }) }, 'Eliminar')
        ])
      ])
    );
  });
  root.appendChild(grid);
}

function areaForm(area) {
  const nameI = UI.input({ type: 'text', required: true }, area ? area.name : '');
  const descI = UI.textarea({}, area ? area.description : '');
  const body = UI.el('div', {}, [UI.formRow('Nombre del área', nameI), UI.formRow('Descripción', descI)]);
  const m = UI.modal({
    title: area ? 'Editar área' : 'Nueva área',
    body,
    footer: [
      UI.el('button', { class: 'btn btn-ghost', onClick: () => m.close() }, 'Cancelar'),
      UI.el('button', { class: 'btn btn-primary', onClick: async () => {
        try {
          const payload = { name: nameI.value, description: descI.value };
          if (area) await API.put('/api/areas/' + area.id, payload);
          else await API.post('/api/areas', payload);
          m.close();
          UI.toast('Área guardada', 'success');
          refresh();
        } catch (e) {
          UI.toast(e.message, 'error');
        }
      } }, 'Guardar')
    ]
  });
}
