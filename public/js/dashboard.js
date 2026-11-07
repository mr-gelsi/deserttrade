// Desert Trade — projector dashboard. Refreshes every 10 seconds.
import { makeApi, esc, fmt } from './api.js';
const api = makeApi('dt_dash');
const $app = document.getElementById('app');

async function tick() {
  let b;
  try { b = await api.get('leaderboard'); } catch (e) { return; }
  const top = b.caravans.slice(0, 8);
  const traders = b.traders.slice(0, 12);
  const totals = b.levels.map((l) => ({ ...l, n: b.levelCounts.filter((c) => c.level === l.number && c.status !== 'complete' && c.status !== 'finished').reduce((a, c) => a + c.n, 0)
    + b.levelCounts.filter((c) => c.level === l.number - 1 && c.status === 'complete').reduce((a, c) => a + c.n, 0) }));
  const done = b.levelCounts.filter((c) => c.status === 'finished').reduce((a, c) => a + c.n, 0);
  const maxN = Math.max(1, ...totals.map((t) => t.n), done);
  $app.innerHTML = `
    <div class="dash-head">
      <h1 style="margin:0">Desert Trade leaderboard</h1>
      <p class="muted" style="margin:0">${b.traders.length} traders, ${b.caravans.length} caravans. Updated ${new Date(b.updated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</p>
    </div>
    <div class="dash-grid">
      <section class="parchment">
        <h2>Leading caravans</h2>
        <p class="muted">Ranked by average wealth per trader</p>
        <div class="podium">${top.map((c, i) => `<div class="place"><div class="pos">${i + 1}</div>
          <div><div class="name">${esc(c.name)}</div><div class="muted">${c.members} trader${c.members === 1 ? '' : 's'}, ${fmt(c.total)} together</div></div>
          <div class="avg num">${fmt(c.average)}<small>average</small></div></div>`).join('') || '<p>No caravans yet. Students can start one from the Caravan page.</p>'}</div>
      </section>
      <div class="stack">
        <section class="parchment">
          <h2>Richest traders</h2>
          <table><tbody>${traders.map((t, i) => `<tr><td class="rank">${i + 1}</td><td><strong>${esc(t.name)}</strong>${t.caravan ? `<br><span class="muted" style="font-size:.9rem">${esc(t.caravan)}</span>` : ''}</td><td class="right num" style="font-weight:700">${fmt(t.money)}</td></tr>`).join('') || '<tr><td>No traders yet.</td></tr>'}</tbody></table>
        </section>
        <section class="parchment">
          <h2>Where the class is</h2>
          <div class="bars">${totals.map((t) => `<div class="bar"><span>Level ${t.number}</span><div class="track"><div class="fill" style="width:${(t.n / maxN) * 100}%"></div></div><span class="num">${t.n}</span></div>`).join('')}
            <div class="bar"><span>Finished</span><div class="track"><div class="fill" style="width:${(done / maxN) * 100}%;background:var(--gold)"></div></div><span class="num">${done}</span></div></div>
        </section>
      </div>
    </div>`;
}
tick();
setInterval(tick, 10000);
