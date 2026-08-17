const Theme = {
  get() {
    return (
      document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    );
  },
  set(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    try {
      localStorage.setItem('ec-theme', mode);
    } catch (e) {
      /* storage unavailable, ignore */
    }
    document.querySelectorAll('.theme-toggle').forEach((el) => {
      el.dataset.mode = mode;
      el.querySelector('.light-btn').classList.toggle('active', mode === 'light');
      el.querySelector('.dark-btn').classList.toggle('active', mode === 'dark');
    });
  },
  toggle() {
    this.set(this.get() === 'dark' ? 'light' : 'dark');
  },
  widget() {
    const wrap = document.createElement('div');
    wrap.className = 'theme-toggle';
    wrap.dataset.mode = Theme.get();
    wrap.innerHTML =
      '<div class="thumb"></div>' +
      '<button class="light-btn" title="Modo claro" aria-label="Modo claro">☀</button>' +
      '<button class="dark-btn" title="Modo oscuro" aria-label="Modo oscuro">🌙</button>';
    wrap.querySelector('.light-btn').classList.toggle('active', wrap.dataset.mode === 'light');
    wrap.querySelector('.dark-btn').classList.toggle('active', wrap.dataset.mode === 'dark');
    wrap.querySelector('.light-btn').addEventListener('click', () => Theme.set('light'));
    wrap.querySelector('.dark-btn').addEventListener('click', () => Theme.set('dark'));
    return wrap;
  }
};
