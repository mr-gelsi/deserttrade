// Small fetch helper shared by the student, teacher and dashboard pages.
export function makeApi(tokenKey) {
  return {
    get token() { try { return localStorage.getItem(tokenKey); } catch { return null; } },
    set token(v) { try { v ? localStorage.setItem(tokenKey, v) : localStorage.removeItem(tokenKey); } catch {} },
    async call(method, path, body) {
      const headers = { 'content-type': 'application/json' };
      if (this.token) headers.authorization = 'Bearer ' + this.token;
      let res;
      try {
        res = await fetch('/api/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      } catch {
        throw Object.assign(new Error('Can\u2019t reach the server. Check your internet connection and try again.'), { status: 0 });
      }
      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status}).`), { status: res.status });
      return data;
    },
    get(path) { return this.call('GET', path); },
    post(path, body = {}) { return this.call('POST', path, body); },
  };
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const comma = (n) => Number(n || 0).toLocaleString('en-US');

export function toast(msg, type = '') {
  const wrap = document.getElementById('toasts');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  while (wrap.children.length > 3) wrap.firstElementChild.remove();
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
}

// Promise-based confirm dialog styled like the game.
export function confirmBox(title, html, okLabel = 'OK', cancelLabel = 'Cancel', danger = false) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal parchment" role="dialog" aria-modal="true" aria-labelledby="mt">
      <h2 id="mt">${title}</h2><div>${html}</div>
      <div class="row"><button class="btn ghost" data-r="0">${cancelLabel}</button><button class="btn ${danger ? 'danger' : ''}" data-r="1">${okLabel}</button></div>
    </div></div>`;
    const done = (v) => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onKey);
    root.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => done(b.dataset.r === '1')));
    root.querySelector('[data-r="1"]').focus();
  });
}
