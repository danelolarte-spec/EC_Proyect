const API = (() => {
  async function req(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    if (r.status === 401) {
      window.location.href = '/';
      return null;
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Error en la solicitud');
    return data;
  }
  return {
    get: (u) => req('GET', u),
    post: (u, b) => req('POST', u, b),
    put: (u, b) => req('PUT', u, b),
    del: (u) => req('DELETE', u)
  };
})();
