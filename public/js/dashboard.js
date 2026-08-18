async function DashboardView(root) {
  const [data, projects, tasks] = await Promise.all([
    API.get('/api/dashboard'),
    API.get('/api/projects'),
    API.get('/api/tasks')
  ]);

  const personal = data.scope === 'personal';
  root.appendChild(
    UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [
        UI.el('h1', {}, personal ? 'Mi panorama' : 'Dashboard'),
        UI.el('span', { class: 'hint' }, personal ? 'Tus proyectos y tareas asignadas' : 'Panorama estratégico para la toma de decisiones')
      ])
    ])
  );

  const today = new Date().toISOString().slice(0, 10);
  const activeProjects = projects.filter((p) => p.status === 'En curso' || p.status === 'Planificado');
  const budgetActive = activeProjects.reduce((s, p) => s + (p.budget || 0), 0);
  const budgetTotal = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const doneTasks = projects.reduce((s, p) => s + (p.tasks_done || 0), 0);
  const totalTasksAll = projects.reduce((s, p) => s + (p.tasks_total || 0), 0);
  const completionRate = totalTasksAll > 0 ? Math.round((doneTasks / totalTasksAll) * 100) : 0;

  const tasksByProject = {};
  tasks.forEach((t) => {
    if (!t.project_id) return;
    (tasksByProject[t.project_id] = tasksByProject[t.project_id] || []).push(t);
  });

  function riskOf(p) {
    if (p.status === 'Completado' || p.status === 'Cancelado') return 'ok';
    const pTasks = tasksByProject[p.id] || [];
    const hasOverdue = pTasks.some((t) => t.due_date && t.due_date < today && t.status !== 'Completada');
    const pastEnd = p.end_date && p.end_date < today;
    if (hasOverdue || pastEnd || !p.can_start) return 'danger';
    const daysToEnd = p.end_date ? (new Date(p.end_date) - new Date(today)) / 86400000 : null;
    if (daysToEnd !== null && daysToEnd <= 7 && p.progress < 80) return 'warn';
    return 'ok';
  }

  const riskLabel = { ok: 'En curso normal', warn: 'Por vencer', danger: 'En riesgo' };
  const atRiskCount = projects.filter((p) => riskOf(p) === 'danger').length;

  // ---------- KPI row ----------
  const stats = UI.el('div', { class: 'cards-grid' }, [
    statCard(personal ? 'Presupuesto de mis proyectos' : 'Presupuesto activo', '$' + budgetActive.toLocaleString(), '', '#projects', '$' + budgetTotal.toLocaleString() + ' en total'),
    statCard('Cumplimiento global', completionRate + '%', completionRate >= 70 ? 'ok' : completionRate >= 40 ? 'warn' : 'danger', '#projects', doneTasks + '/' + totalTasksAll + ' tareas'),
    statCard(personal ? 'Mis proyectos en riesgo' : 'Proyectos en riesgo', atRiskCount, atRiskCount ? 'danger' : 'ok', '#projects', atRiskCount ? 'requieren atención' : 'todo en orden'),
    statCard('Tareas vencidas', data.overdueTasks, data.overdueTasks ? 'danger' : 'ok', '#tasks')
  ]);
  root.appendChild(stats);

  // ---------- Priority projects + workload ----------
  const execGrid = UI.el('div', { class: 'exec-grid' });

  const priorityCard = UI.el('div', { class: 'card' }, [
    UI.el('div', { class: 'exec-section-head' }, [
      UI.el('h2', {}, personal ? 'Mis proyectos prioritarios' : 'Proyectos prioritarios'),
      UI.el('span', { class: 'hint' }, 'Por impacto × esfuerzo')
    ])
  ]);
  const topPriority = [...activeProjects].sort((a, b) => (b.impact || 0) * (b.effort || 0) - (a.impact || 0) * (a.effort || 0)).slice(0, 5);
  if (topPriority.length === 0) {
    priorityCard.appendChild(UI.el('div', { class: 'empty' }, 'No hay proyectos activos.'));
  } else {
    const list = UI.el('div', { class: 'priority-list' });
    topPriority.forEach((p, i) => {
      const score = (p.impact || 0) * (p.effort || 0);
      const risk = riskOf(p);
      list.appendChild(
        UI.el('div', { class: 'priority-item card-clickable', onClick: () => (window.location.hash = '#project/' + p.id) }, [
          UI.el('div', { class: 'priority-rank' }, String(i + 1)),
          UI.el('div', { class: 'pi-main' }, [
            UI.el('div', { class: 'pi-name' }, p.code + ' · ' + p.name),
            UI.el('div', { class: 'pi-meta' }, [
              UI.el('span', { class: 'risk-pill ' + risk }, riskLabel[risk]),
              ' · ' + p.progress + '% avance'
            ])
          ]),
          UI.el('div', { class: 'pi-score' }, [String(score), UI.el('small', {}, 'score')])
        ])
      );
    });
    priorityCard.appendChild(list);
  }
  priorityCard.appendChild(
    UI.el('div', { style: 'margin-top:14px;text-align:right' }, [
      UI.el('a', { href: '#projects', style: 'color:var(--gold-2);font-size:0.85rem;font-weight:600' }, 'Ver todos los proyectos →')
    ])
  );

  execGrid.appendChild(priorityCard);

  if (!personal) {
    const workloadCard = UI.el('div', { class: 'card' }, [
      UI.el('div', { class: 'exec-section-head' }, [UI.el('h2', {}, 'Carga de trabajo'), UI.el('span', { class: 'hint' }, 'Tareas pendientes por responsable')])
    ]);
    const workload = {};
    tasks.forEach((t) => {
      if (t.status === 'Completada' || t.status === 'Cancelada') return;
      const name = t.user_name || 'Sin asignar';
      workload[name] = (workload[name] || 0) + 1;
    });
    const workloadEntries = Object.entries(workload).sort((a, b) => b[1] - a[1]).slice(0, 7);
    if (workloadEntries.length === 0) {
      workloadCard.appendChild(UI.el('div', { class: 'empty' }, 'No hay tareas pendientes.'));
    } else {
      const maxCount = workloadEntries[0][1];
      const bars = UI.el('div', { class: 'bar-list' });
      workloadEntries.forEach(([name, count]) => {
        bars.appendChild(
          UI.el('div', { class: 'bar-row' }, [
            UI.el('div', { class: 'bar-row-label' }, [UI.el('span', {}, name), UI.el('span', {}, count + ' tareas')]),
            UI.el('div', { class: 'bar-track' }, UI.el('span', { style: `width:${Math.round((count / maxCount) * 100)}%` }))
          ])
        );
      });
      workloadCard.appendChild(bars);
    }
    execGrid.appendChild(workloadCard);
  }
  root.appendChild(execGrid);

  // ---------- Investment by brand / innovation ----------
  const brandGroups = (personal ? [] : EC_BRANDS.map((b) => ({ label: b, match: (p) => p.category === 'Marca' && p.brand === b })).concat([
    { label: 'Innovación', match: (p) => p.category === 'Innovación' },
    { label: 'Sin clasificar', match: (p) => !p.category }
  ]))
    .map((g) => ({ label: g.label, count: projects.filter(g.match).length, budget: projects.filter(g.match).reduce((s, p) => s + (p.budget || 0), 0) }))
    .filter((g) => g.count > 0);

  if (brandGroups.length > 0) {
    const maxBudget = Math.max(...brandGroups.map((g) => g.budget), 1);
    const brandCard = UI.el('div', { class: 'card exec-section' }, [
      UI.el('div', { class: 'exec-section-head' }, [UI.el('h2', {}, 'Inversión por Marca / Innovación'), UI.el('span', { class: 'hint' }, budgetTotal ? '$' + budgetTotal.toLocaleString() + ' presupuesto total' : '')])
    ]);
    const bars = UI.el('div', { class: 'bar-list' });
    brandGroups.forEach((g) => {
      bars.appendChild(
        UI.el('div', { class: 'bar-row' }, [
          UI.el('div', { class: 'bar-row-label' }, [UI.el('span', {}, g.label + ' (' + g.count + ')'), UI.el('span', {}, '$' + g.budget.toLocaleString())]),
          UI.el('div', { class: 'bar-track' }, UI.el('span', { style: `width:${Math.round((g.budget / maxBudget) * 100) || 2}%` }))
        ])
      );
    });
    brandCard.appendChild(bars);
    root.appendChild(brandCard);
  }

  // ---------- Org snapshot ----------
  const orgCard = UI.el('div', { class: 'card exec-section' }, [
    UI.el('div', { class: 'exec-section-head' }, [UI.el('h2', {}, personal ? 'Mi resumen' : 'Panorama organizacional')]),
    UI.el('div', { class: 'grid-3' }, [
      orgStat(personal ? 'Mis proyectos' : 'Proyectos totales', data.total, '#projects'),
      orgStat('Completados', data.completed, '#projects'),
      orgStat(personal ? 'Mis tareas pendientes' : 'Tareas pendientes', data.pendingTasks, '#tasks'),
      orgStat('Usuarios activos', data.totalUsers, '#users'),
      orgStat('Áreas', data.totalAreas, '#areas'),
      orgStat('Contenido del mes', data.contentThisMonth, '#creative')
    ])
  ]);
  root.appendChild(orgCard);
}

function orgStat(label, value, link) {
  return UI.el('div', { style: 'cursor:pointer', onClick: () => (window.location.hash = link) }, [
    UI.el('div', { style: 'font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.3px' }, label),
    UI.el('div', { style: 'font-size:1.3rem;font-weight:700;color:var(--text)' }, String(value || 0))
  ]);
}

function statCard(label, num, variant, link, sub) {
  return UI.el(
    'div',
    {
      class: 'stat-card ' + (variant || '') + (link ? ' clickable' : ''),
      onClick: link ? () => (window.location.hash = link) : null,
      role: link ? 'button' : null,
      tabindex: link ? '0' : null
    },
    [UI.el('h3', {}, label), UI.el('div', { class: 'num' }, String(num)), sub ? UI.el('div', { class: 'sub' }, sub) : null]
  );
}
