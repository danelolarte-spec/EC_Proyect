const UI = (() => {
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.entries(v).forEach(([dk, dv]) => (node.dataset[dk] = dv));
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.substring(2).toLowerCase(), v);
      else if (v === true) node.setAttribute(k, '');
      else if (v !== false && v != null) node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  function toast(msg, type = '') {
    const t = el('div', { class: 'toast ' + type }, msg);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  function modal({ title, body, footer, wide = false }) {
    const root = document.getElementById('modalRoot');
    const backdrop = el('div', { class: 'modal-backdrop' });
    const card = el('div', { class: 'modal ' + (wide ? 'wide' : '') });
    const close = () => backdrop.remove();
    card.appendChild(
      el('div', { class: 'modal-head' }, [
        el('h3', {}, title),
        el('button', { class: 'close', onClick: close }, '×')
      ])
    );
    const bodyNode = el('div', { class: 'modal-body' });
    if (typeof body === 'string') bodyNode.innerHTML = body;
    else if (body) bodyNode.appendChild(body);
    card.appendChild(bodyNode);
    if (footer) {
      const footNode = el('div', { class: 'modal-foot' });
      (Array.isArray(footer) ? footer : [footer]).forEach((f) => footNode.appendChild(f));
      card.appendChild(footNode);
    }
    backdrop.appendChild(card);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    root.appendChild(backdrop);
    return { close };
  }

  function confirmDialog(msg, onYes) {
    const m = modal({
      title: 'Confirmar',
      body: el('p', {}, msg),
      footer: [
        el('button', { class: 'btn btn-ghost', onClick: () => m.close() }, 'Cancelar'),
        el(
          'button',
          {
            class: 'btn btn-danger',
            onClick: () => {
              m.close();
              onYes();
            }
          },
          'Eliminar'
        )
      ]
    });
  }

  function formRow(label, input) {
    return el('div', { class: 'form-row' }, [el('label', {}, label), input]);
  }

  function input(attrs = {}, value = '') {
    const i = el('input', attrs);
    if (value != null) i.value = value;
    return i;
  }
  function textarea(attrs = {}, value = '') {
    const t = el('textarea', attrs);
    t.value = value || '';
    return t;
  }
  function select(options = [], value = '', attrs = {}) {
    const s = el('select', attrs);
    options.forEach((o) => {
      const opt = el('option', { value: o.value }, o.label);
      if (String(o.value) === String(value)) opt.selected = true;
      s.appendChild(opt);
    });
    return s;
  }
  function multiCheck(options, selected = [], name = 'multi') {
    const set = new Set(selected.map(String));
    const wrap = el('div', { class: 'multi-check' });
    options.forEach((o) => {
      const cb = el('input', { type: 'checkbox', value: o.value, name });
      if (set.has(String(o.value))) cb.checked = true;
      wrap.appendChild(el('label', {}, [cb, ' ' + o.label]));
    });
    wrap.getValues = () => Array.from(wrap.querySelectorAll('input:checked')).map((c) => c.value);
    return wrap;
  }

  function badge(text, variant = '') {
    return el('span', { class: 'badge ' + variant }, text);
  }

  function fmtDate(s) {
    if (!s) return '—';
    return s.slice(0, 10);
  }

  return { el, toast, modal, confirmDialog, formRow, input, textarea, select, multiCheck, badge, fmtDate };
})();
