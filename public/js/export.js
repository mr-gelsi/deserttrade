// Desert Trade — teacher CSV downloads.
// Adds a "Download leaderboards" bar under the teacher page header. It only
// shows while a teacher is logged in (it follows the Log out button).
const TOKEN_KEY = 'dt_teacher_token';

function token() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }

function notify(msg, error) {
  const wrap = document.getElementById('toasts');
  if (!wrap) { if (error) alert(msg); return; }
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' error' : '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), error ? 6000 : 3500);
}

async function download(board, btn) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Preparing…';
  try {
    const res = await fetch('/api/export?board=' + board, { headers: { authorization: 'Bearer ' + (token() || '') } });
    if (!res.ok) {
      const msg = res.status === 401 ? 'Your teacher login expired. Log in again, then download.' : await res.text();
      throw new Error(msg || `Download failed (${res.status}).`);
    }
    const blob = await res.blob();
    const name = (res.headers.get('content-disposition') || '').match(/filename="([^"]+)"/)?.[1]
      || `desert-trade-${board}.csv`;
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    notify(`Downloaded ${name}`);
  } catch (e) {
    notify(e.message || 'Download failed.', true);
  } finally {
    btn.disabled = false; btn.textContent = label;
  }
}

const style = document.createElement('style');
style.textContent = `
  .export-bar { max-width: 1200px; margin: 1rem auto -0.5rem; padding: 0 1rem; display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; }
  .export-bar span { font-weight: 700; color: var(--wood, #4b2e1a); }
`;
document.head.appendChild(style);

const bar = document.createElement('div');
bar.className = 'export-bar hidden';
bar.innerHTML = `<span>Download leaderboards:</span>
  <button class="btn small wood" data-board="traders">Traders (CSV)</button>
  <button class="btn small wood" data-board="caravans">Caravans (CSV)</button>`;
document.querySelector('main').before(bar);
bar.querySelectorAll('[data-board]').forEach((b) => b.addEventListener('click', () => download(b.dataset.board, b)));

// Show the bar only while logged in: teacher.js hides the Log out button when logged out.
const logout = document.getElementById('logout');
const sync = () => bar.classList.toggle('hidden', !logout || logout.classList.contains('hidden'));
if (logout) new MutationObserver(sync).observe(logout, { attributes: true, attributeFilter: ['class'] });
sync();
