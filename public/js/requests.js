async function RequestsView(root) {
  const reqs = await API.get('/api/requests');

  root.appendChild(
    UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h1', {}, 'Solicitudes de Contenido'), UI.el('span', { class: 'hint' }, 'Solicitudes enviadas a través del formulario externo')]),
      UI.el('a', { href: '/solicitud.html', target: '_blank', class: 'btn btn-gold' }, '↗ Abrir formulario')
    ])
  );

  if (reqs.length === 0) {
    root.appendChild(UI.el('div', { class: 'empty' }, 'No hay solicitudes. Comparte el enlace /solicitud.html para recibir requerimientos.'));
    return;
  }

  const table = UI.el('table', { class: 'data' }, [
    UI.el('thead', {}, UI.el('tr', {}, [
      UI.el('th', {}, '#'),
      UI.el('th', {}, 'Tipo'),
      UI.el('th', {}, 'Subtipo'),
      UI.el('th', {}, 'Solicitante'),
      UI.el('th', {}, 'Correo'),
      UI.el('th', {}, 'Fecha programada'),
      UI.el('th', {}, 'Estado'),
      UI.el('th', {}, 'Acciones')
    ])),
    UI.el('tbody', {}, reqs.map((r) => UI.el('tr', {}, [
      UI.el('td', {}, '#' + r.id),
      UI.el('td', {}, UI.badge(r.request_type, 'info')),
      UI.el('td', {}, r.subtype || '—'),
      UI.el('td', {}, [UI.el('strong', {}, r.requester_name), UI.el('div', { style: 'font-size:0.75rem;color:var(--muted)' }, r.requester_position || '')]),
      UI.el('td', {}, r.requester_email),
      UI.el('td', {}, UI.fmtDate(r.scheduled_date)),
      UI.el('td', {}, UI.badge(r.status, r.status === 'Completada' ? 'ok' : r.status === 'En curso' ? 'gold' : 'warn')),
      UI.el('td', {}, UI.el('div', { class: 'actions' }, [
        UI.el('button', { class: 'btn btn-ghost', onClick: () => showRequest(r) }, 'Ver'),
        UI.el('button', { class: 'btn btn-danger', onClick: () => UI.confirmDialog('¿Eliminar solicitud?', async () => {
          await API.del('/api/requests/' + r.id);
          UI.toast('Solicitud eliminada', 'success');
          refresh();
        }) }, 'Eliminar')
      ]))
    ])))
  ]);
  root.appendChild(UI.el('div', { class: 'tbl-wrap' }, table));
}

function showRequest(r) {
  const rows = [];
  Object.entries(r.payload || {}).forEach(([k, v]) => {
    if (!v) return;
    rows.push(UI.el('tr', {}, [UI.el('td', { style: 'font-weight:600;color:var(--dark);padding:6px 10px' }, k), UI.el('td', { style: 'padding:6px 10px' }, String(v))]));
  });

  const statusI = UI.select(
    [
      { value: 'Recibida', label: 'Recibida' },
      { value: 'En curso', label: 'En curso' },
      { value: 'Completada', label: 'Completada' },
      { value: 'Rechazada', label: 'Rechazada' }
    ],
    r.status
  );

  const body = UI.el('div', {}, [
    UI.el('p', { style: 'color:var(--muted);font-size:0.85rem' }, `Folio #${r.id} · ${r.request_type}${r.subtype ? ' / ' + r.subtype : ''} · Recibida: ${r.created_at}`),
    UI.el('p', {}, [UI.el('strong', {}, 'Solicitante: '), r.requester_name, ' · ', r.requester_position, ' · ', r.requester_email]),
    r.scheduled_date ? UI.el('p', {}, [UI.el('strong', {}, 'Fecha programada: '), r.scheduled_date]) : null,
    rows.length ? UI.el('table', { class: 'data', style: 'margin-top:10px' }, UI.el('tbody', {}, rows)) : null,
    UI.formRow('Actualizar estado', statusI)
  ]);

  const m = UI.modal({
    title: 'Detalle de solicitud',
    wide: true,
    body,
    footer: [
      UI.el('button', { class: 'btn btn-ghost', onClick: () => m.close() }, 'Cerrar'),
      UI.el('button', { class: 'btn btn-primary', onClick: async () => {
        await API.put('/api/requests/' + r.id, { status: statusI.value });
        m.close();
        UI.toast('Solicitud actualizada', 'success');
        refresh();
      } }, 'Guardar')
    ]
  });
}
