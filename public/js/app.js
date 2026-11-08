// Desert Trade: The Game — student app
import { makeApi, esc, fmt, comma, toast, confirmBox } from './api.js';

const api = makeApi('dt_token');
const $app = document.getElementById('app');
const $top = document.getElementById('topbar');

const S = {
  cfg: null, me: null, view: 'home', busy: false,
  summary: null, perishInfo: null,
  travel: null, // local travel animation state
  caravans: null, board: null,
};

// ---------------------------------------------------------------- boot
async function boot() {
  try {
    S.cfg = await api.get('config');
  } catch (e) {
    $app.innerHTML = `<div class="parchment"><h2>The market is closed</h2><p>${esc(e.message)}</p></div>`;
    return;
  }
  if (api.token) {
    try { S.me = (await api.get('me')).me; } catch { api.token = null; }
  }
  render();
}

async function refreshConfig() {
  try { S.cfg = await api.get('config'); } catch {}
}

// Run an API action, update state, show errors.
async function act(path, body, { quiet = false } = {}) {
  if (S.busy) return null;
  S.busy = true;
  try {
    const res = await api.post(path, body);
    if (res.me) S.me = res.me;
    if (res.message && !quiet) toast(res.message);
    return res;
  } catch (e) {
    if (e.status === 401 && path !== 'login' && path !== 'register') { api.token = null; S.me = null; render(); }
    toast(e.message, 'error');
    return null;
  } finally {
    S.busy = false;
  }
}

// ---------------------------------------------------------------- helpers
const city = (id) => S.cfg.cities[id] || { name: id };
const item = (id) => S.cfg.items[id] || { name: id, unit: 'lb', desc: '' };
const unit = (id, q) => { const u = item(id).unit; return u === 'lb' ? 'lb' : u === 'jug' ? (q === 1 ? 'jug' : 'jugs') : u === 'sheep' ? 'sheep' : (q === 1 ? u : u + 's'); };
const daysLeft = () => (S.me.levelInfo ? S.me.levelInfo.days - S.me.day : 0);
const inv = (id) => S.me.inventory[id] || 0;

function currentView() {
  const me = S.me;
  if (!me) return 'auth';
  if (me.status === 'playing' && me.travel) return 'travel';
  if (S.view === 'travel') S.view = 'home';
  if (S.view === 'school' && (me.status !== 'playing' || me.city !== 'cairo')) S.view = 'home';
  if (S.view === 'home' || (S.view === 'market' && (me.status !== 'playing'))) {
    return { locked: 'gate', complete: 'gate', title: 'title', perished: 'perished', finished: 'finished', playing: 'city' }[me.status] || 'gate';
  }
  return S.view;
}

function go(view) {
  if (S.travel?.timer) { clearInterval(S.travel.timer); }
  if (view !== 'travel') S.travel = null;
  S.view = view;
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

// ---------------------------------------------------------------- render
function render() {
  const v = currentView();
  renderTop(v);
  const views = { auth: viewAuth, gate: viewGate, title: viewTitle, city: viewCity, market: viewMarket, inventory: viewInventory,
    caravan: viewCaravan, leaderboard: viewLeaderboard, travel: viewTravel, perished: viewPerished, finished: viewFinished, school: viewSchool };
  (views[v] || viewGate)();
}

function renderTop(v) {
  const me = S.me;
  if (!me) { $top.classList.add('hidden'); return; }
  $top.classList.remove('hidden');
  const traveling = v === 'travel';
  const playing = me.status === 'playing';
  const L = me.levelInfo;
  const homeActive = ['city', 'gate', 'title', 'perished', 'finished', 'school'].includes(v);
  const btn = (id, label, disabled, active) => `<button data-nav="${id}" ${disabled ? 'disabled' : ''} ${active ? 'aria-current="page"' : ''}>${label}</button>`;
  $top.innerHTML = `<div class="topbar-inner">
    <span class="wordmark">Desert Trade</span>
    <div class="stats">
      <div class="stat"><small>Trader</small><strong>${esc(me.name)}</strong></div>
      ${L ? `<div class="stat"><small>Level ${L.number}</small><strong>${esc(L.name)}</strong></div>` : ''}
      ${playing ? `<div class="stat"><small>Day</small><strong class="num">${me.day} / ${L.days}</strong></div>` : ''}
      <div class="stat money"><small>Bank</small><strong class="num">${fmt(me.money)}</strong></div>
    </div>
    <nav class="nav" aria-label="Game">
      ${btn('home', playing ? 'City' : 'Level', traveling, homeActive)}
      ${btn('market', 'Market', traveling || !playing, v === 'market')}
      ${btn('inventory', 'Inventory', traveling, v === 'inventory')}
      ${btn('caravan', 'Caravan', traveling, v === 'caravan')}
      ${btn('leaderboard', 'Leaderboard', traveling, v === 'leaderboard')}
      ${btn('logout', 'Log out', traveling, false)}
    </nav></div>`;
  $top.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', async () => {
    const n = b.dataset.nav;
    if (n === 'logout') { await api.post('logout').catch(() => {}); api.token = null; S.me = null; S.view = 'home'; render(); return; }
    if (n === 'market') await refreshConfig();
    go(n);
  }));
}

// ---------------------------------------------------------------- auth
function viewAuth() {
  $app.innerHTML = `
    <div class="hero"><img src="/img/cover.webp" alt="Desert Trade: The Game" width="1600" height="900"></div>
    <div class="auth-grid">
      <form class="parchment" id="f-reg">
        <h2>Create your trader</h2>
        <p class="muted">Pick a trader name your classmates will see on the leaderboard.</p>
        <div class="field"><label for="rn">Trader name</label><input id="rn" maxlength="24" autocomplete="username" required></div>
        <div class="field"><label for="rp">Password</label><input id="rp" type="password" minlength="4" autocomplete="new-password" required></div>
        <div class="field"><label for="rp2">Type the password again</label><input id="rp2" type="password" minlength="4" autocomplete="new-password" required></div>
        <div class="field"><button class="btn big">Create trader</button></div>
      </form>
      <form class="parchment" id="f-log">
        <h2>Log in</h2>
        <p class="muted">Already a trader? Continue your journey.</p>
        <div class="field"><label for="ln">Trader name</label><input id="ln" maxlength="24" autocomplete="username" required></div>
        <div class="field"><label for="lp">Password</label><input id="lp" type="password" autocomplete="current-password" required></div>
        <div class="field"><button class="btn big wood">Log in</button></div>
        <p class="hint" style="margin-top:1.5rem">Forgot your password? Your teacher can reset it.</p>
      </form>
    </div>
    <p class="muted" style="text-align:center;margin-top:2rem"><a href="/dashboard.html">Leaderboard dashboard</a> &nbsp;|&nbsp; <a href="/teacher.html">Teacher login</a></p>`;
  document.getElementById('f-reg').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = rn.value.trim(), pw = rp.value;
    if (pw !== rp2.value) return toast('The two passwords don\u2019t match.', 'error');
    const res = await act('register', { name, password: pw }, { quiet: true });
    if (res) { api.token = res.token; S.view = 'home'; toast(`Welcome to the guild, ${name}!`); render(); }
  });
  document.getElementById('f-log').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await act('login', { name: ln.value.trim(), password: lp.value }, { quiet: true });
    if (res) { api.token = res.token; S.view = 'home'; render(); }
  });
}

// ---------------------------------------------------------------- level gate (locked / complete)
function viewGate() {
  const me = S.me;
  const complete = me.status === 'complete';
  const target = complete ? me.nextLevel : { number: me.level, name: me.levelInfo?.name };
  const sum = complete ? S.summary : null;
  $app.innerHTML = `<div class="parchment level-title">
    ${complete ? `
      <div class="lv">Level ${me.level} complete</div>
      <h1>Well traded, ${esc(me.name)}</h1>
      ${sum ? `<div class="facts">
        <div class="fact"><small>Days used</small><strong class="num">${sum.daysUsed}</strong></div>
        <div class="fact"><small>Unused days</small><strong class="num">${sum.unused}</strong></div>
        <div class="fact"><small>Early-finish bonus</small><strong class="num">${fmt(sum.bonus)}</strong></div>
        <div class="fact"><small>Bank</small><strong class="num">${fmt(sum.money)}</strong></div>
      </div>` : `<p>Your bank holds <strong>${fmt(me.money)}</strong>. Your goods travel with you to the next level.</p>`}
      <h2 style="margin-top:1.5rem">Next: Level ${target.number}, ${esc(target.name)}</h2>` : `
      <div class="lv">Level ${target.number}</div>
      <h1>${esc(target.name)}</h1>`}
    <p style="margin:0 auto 1rem">This level is locked. Enter the level code from your teacher.</p>
    <form id="f-code" class="row" style="justify-content:center;max-width:460px;margin:0 auto">
      <label for="code" class="hidden">Level code</label>
      <input id="code" autocomplete="off" placeholder="Level code" style="flex:1;min-width:180px" required>
      <button class="btn">Unlock level</button>
    </form>
  </div>`;
  document.getElementById('f-code').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await act('level/unlock', { code: document.getElementById('code').value });
    if (res) { S.summary = null; go('home'); }
  });
}

// ---------------------------------------------------------------- level title page
function viewTitle() {
  const L = S.me.levelInfo;
  const c = city(L.start_city);
  $app.innerHTML = `<div class="parchment level-title">
    <div class="lv">Level ${L.number}</div>
    <h1>${esc(L.name)}</h1>
    <div class="facts">
      <div class="fact"><small>Days to finish</small><strong class="num">${comma(L.days)}</strong></div>
      <div class="fact"><small>Starting city</small><strong>${esc(c.name)}</strong></div>
      ${L.start_bonus > 0 ? `<div class="fact"><small>Starting bonus</small><strong class="num">${fmt(L.start_bonus)}</strong></div>` : ''}
      ${L.early_bonus > 0 ? `<div class="fact"><small>Finish early and earn</small><strong class="num">${fmt(L.early_bonus)}</strong><small>for every unused day</small></div>` : ''}
    </div>
    <div class="lapis instructions"><h3>Your challenge</h3><p style="margin:0">${esc(L.instructions)}</p></div>
    <p class="muted" style="margin:1.2rem auto">Every 25 days of travel uses 1 lb of food and 1 jug of water. Plan your supplies before you leave a city.</p>
    <button class="btn big" id="begin">Begin Level ${L.number} in ${esc(c.name)}</button>
  </div>`;
  document.getElementById('begin').addEventListener('click', async () => {
    const res = await act('level/begin');
    if (res) { toast(`Level ${L.number} has begun. You have ${L.days} days.`); go('home'); }
  });
}

// ---------------------------------------------------------------- city
function viewCity() {
  const me = S.me, c = city(me.city), left = daysLeft();
  const options = S.cfg.cityOrder.filter((id) => id !== me.city).map((id) => {
    const r = me.routes[id];
    const tooFar = r.days > left;
    return `<option value="${id}" ${tooFar ? 'disabled' : ''}>${esc(city(id).name)}: ${comma(r.miles)} mi, ${r.days} days${tooFar ? ' (not enough days left)' : ''}</option>`;
  }).join('');
  $app.innerHTML = `<div class="grid-2">
    <div class="print"><img src="${c.image}" alt="Illustration of ${esc(c.name)}" width="900" height="900"></div>
    <div class="parchment stack">
      <div><h1>Welcome to ${esc(c.name)}</h1><p>${esc(c.blurb)}</p></div>
      <div class="row">
        <button class="btn big" id="to-market">Go to Market</button>
        <button class="btn wood" id="to-inv">Check Inventory</button>
        <button class="btn ghost" id="end">End Level</button>
      </div>
      ${me.city === 'cairo' ? `<div class="school-card"><div><h3>Trader School</h3><p>Take classes that help you survive the road and strike better deals.</p></div><button class="btn wood" id="to-school">Visit the Trader School</button></div>` : ''}
      <div class="lapis">
        <h3>Plan a journey</h3>
        <p style="margin-bottom:.6rem">Day <strong class="num">${me.day}</strong> of ${me.levelInfo.days}. <strong class="num">${left}</strong> days left in this level.</p>
        <label for="dest">Travel to</label>
        <div class="row">
          <select id="dest" style="flex:1;min-width:220px"><option value="">Choose a city…</option>${options}</select>
          <button class="btn wood" id="depart">Depart</button>
        </div>
        <p class="hint" style="color:#d8cfb6;margin:.6rem 0 0">Every 25 days on the road uses 1 lb of food and 1 jug of water. Run out and you perish.</p>
      </div>
    </div>
  </div>`;
  document.getElementById('to-market').onclick = async () => { await refreshConfig(); go('market'); };
  document.getElementById('to-inv').onclick = () => go('inventory');
  document.getElementById('end').onclick = endLevelPrompt;
  document.getElementById('depart').onclick = departPrompt;
  document.getElementById('to-school')?.addEventListener('click', () => go('school'));
}

async function departPrompt() {
  const to = document.getElementById('dest').value;
  if (!to) return toast('Choose a city to travel to.', 'error');
  const r = S.me.routes[to];
  const ok = await confirmBox(`Leave for ${esc(city(to).name)}?`,
    `<p>The trip takes <strong>${r.days} days</strong> (${comma(r.miles)} miles).</p>
     <p>You are carrying <strong>${inv('food')} lb of food</strong> and <strong>${inv('water')} ${unit('water', inv('water'))} of water</strong>. Is that enough?</p>`,
    'Depart', 'Stay in ' + esc(city(S.me.city).name));
  if (!ok) return;
  const res = await act('travel/start', { to });
  if (res) { S.travel = null; go('travel'); }
}

async function endLevelPrompt() {
  const L = S.me.levelInfo, left = daysLeft(), bonus = left * (L.early_bonus || 0);
  const ok = await confirmBox(`End Level ${L.number} now?`,
    `<p>You have <strong>${left}</strong> unused days.${L.early_bonus ? ` At ${fmt(L.early_bonus)} per day you will earn <strong>${fmt(bonus)}</strong>.` : ''}</p>
     <p>Make sure you finished the challenge: <em>${esc(L.instructions)}</em></p>`, 'End level', 'Keep trading');
  if (!ok) return;
  const res = await act('level/end');
  if (res) { S.summary = res.summary; go('home'); }
}

// ---------------------------------------------------------------- market
function viewMarket() {
  if (!S.me.marketOpen) return viewQuiz();
  const me = S.me, c = city(me.city), m = S.cfg.markets[me.city];
  const priceOf = (side, id, base) => Math.round(base * (me.haggles[`${side}:${id}`] || 1) * 100) / 100;
  const shop = (side, id, base) => {
    const it = item(id), price = priceOf(side, id, base), h = me.haggles[`${side}:${id}`];
    const good = h && ((side === 'buy' && h < 1) || (side === 'sell' && h > 1));
    const have = inv(id);
    return `<article class="shop ${side === 'buy' ? 'sells' : 'buys'}" data-side="${side}" data-item="${id}" data-price="${price}">
      <div class="shop-name">${esc(it.shop)} ${side === 'buy' ? 'sells' : 'buys'}</div>
      <h3>${esc(it.name)}</h3>
      <p class="desc">${esc(it.desc)}</p>
      <div class="row" style="justify-content:space-between">
        <span class="price num">${fmt(price)} <small>per ${it.unit}</small></span>
        ${h ? `<span class="haggled ${good ? 'good' : 'bad'}">${good ? 'Haggled: 5% better' : 'Haggled: 5% worse'}</span>` : ''}
      </div>
      ${side === 'sell' ? `<div class="muted" style="font-size:.95rem">You have <strong class="num">${have}</strong> ${unit(id, have)}</div>` : `<div class="muted" style="font-size:.95rem">You own <span class="num">${have}</span></div>`}
      <div class="qty">
        <button class="btn ghost small" data-q="-1" aria-label="Fewer">\u2212</button>
        <input type="number" min="1" step="1" value="1" inputmode="numeric" aria-label="Quantity of ${esc(it.name)}">
        <button class="btn ghost small" data-q="1" aria-label="More">+</button>
        <button class="btn ghost small" data-q="max">Max</button>
      </div>
      <div class="actions">
        <button class="btn ${side === 'sell' ? 'sell' : ''}" data-do="${side}" ${side === 'sell' && !have ? 'disabled' : ''}>${side === 'buy' ? 'Buy' : 'Sell'} <span class="total num">${fmt(price)}</span></button>
        <button class="btn wood" data-do="haggle" ${h ? 'disabled' : ''}>Haggle</button>
      </div>
    </article>`;
  };
  const provisions = [shop('buy', 'food', m.food), shop('buy', 'water', m.water)].join('');
  const exportsHtml = m.exports.map((x) => shop('buy', x.item, x.price)).join('');
  const importsHtml = m.imports.map((x) => shop('sell', x.item, x.price)).join('');
  $app.innerHTML = `<div class="parchment">
    <div class="market-head">
      <div><h1>The market of ${esc(c.name)}</h1><p class="muted" style="margin:0">Bank: <strong class="num">${fmt(me.money)}</strong>. Each shop will haggle with you once per visit.</p></div>
      <div class="row">
        <button class="btn ghost" id="back">Back to ${esc(c.name)}</button>
        <button class="btn wood" id="to-inv">Check Inventory</button>
        <button class="btn ghost" id="end">End Level</button>
      </div>
    </div>
    <section class="shop-section"><h2>Provisions <small>Food and water for the road</small></h2><div class="shops">${provisions}</div></section>
    <section class="shop-section"><h2>Exports <small>Goods ${esc(c.name)} sells. You buy here.</small></h2><div class="shops">${exportsHtml}</div></section>
    <section class="shop-section"><h2>Imports <small>Goods ${esc(c.name)} wants. You sell here.</small></h2><div class="shops">${importsHtml}</div></section>
  </div>`;

  document.getElementById('back').onclick = () => go('home');
  document.getElementById('to-inv').onclick = () => go('inventory');
  document.getElementById('end').onclick = endLevelPrompt;

  $app.querySelectorAll('.shop').forEach((el) => {
    const input = el.querySelector('input');
    const side = el.dataset.side, id = el.dataset.item, price = Number(el.dataset.price);
    const total = el.querySelector('.total');
    const sync = () => {
      let q = Math.max(1, Math.floor(Number(input.value) || 1));
      input.value = q;
      total.textContent = fmt(price * q);
    };
    input.addEventListener('input', () => { const q = Math.floor(Number(input.value)); if (q >= 1) total.textContent = fmt(price * q); });
    input.addEventListener('change', sync);
    el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      const d = b.dataset.q;
      if (d === 'max') {
        const max = side === 'buy' ? Math.floor((S.me.money + 1e-9) / price) : inv(id);
        input.value = Math.max(1, max);
      } else input.value = Math.max(1, (Math.floor(Number(input.value)) || 1) + Number(d));
      sync();
    }));
    el.querySelectorAll('[data-do]').forEach((b) => b.addEventListener('click', async () => {
      const what = b.dataset.do;
      if (what === 'haggle') {
        const res = await act('market/haggle', { item: id, side }, { quiet: true });
        if (res) { toast(res.message, res.good ? '' : 'error'); render(); }
        return;
      }
      sync();
      const res = await act(side === 'buy' ? 'market/buy' : 'market/sell', { item: id, qty: Number(input.value) });
      if (res) render();
    }));
  });
}

// ---------------------------------------------------------------- inventory
function viewInventory() {
  const me = S.me;
  const goods = Object.entries(me.inventory).filter(([k, q]) => q > 0 && k !== 'food' && k !== 'water');
  const rows = goods.length ? goods.map(([k, q]) => `<tr><td>${esc(item(k).name)}</td><td class="right num">${comma(q)}</td><td>${unit(k, q)}</td></tr>`).join('')
    : `<tr><td colspan="3" class="muted">No trade goods yet. Visit a market to buy some.</td></tr>`;
  const log = me.log.map((l) => `<li><span class="when">Level ${l.level}, day ${l.day}</span>${esc(l.text)}</li>`).join('');
  $app.innerHTML = `<div class="grid-2">
    <div class="parchment stack">
      <h1>Inventory</h1>
      <div class="lapis"><h3>Bank account</h3><div class="num" style="font-size:2.4rem;font-weight:700;color:var(--gold-bright)">${fmt(me.money)}</div></div>
      <div>
        <h2>Supplies</h2>
        <table><tbody>
          <tr><td>Food</td><td class="right num">${inv('food')}</td><td>lb</td></tr>
          <tr><td>Water</td><td class="right num">${inv('water')}</td><td>${unit('water', inv('water'))}</td></tr>
        </tbody></table>
        <p class="hint">Every 25 days of travel uses 1 lb of food and 1 jug of water.</p>
      </div>
      ${me.skills.length ? `<div><h2>Trader School classes</h2><ul class="skill-list">${me.skills.map((k) => `<li>${esc(S.cfg.skills[k]?.name || k)}</li>`).join('')}</ul></div>` : ''}
      <div><h2>Trade goods</h2><div class="table-wrap"><table><thead><tr><th>Good</th><th class="right">Amount</th><th>Unit</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      ${me.status === 'playing' ? `<div class="row"><button class="btn ghost" id="back">Back to ${esc(city(me.city).name)}</button>${me.travel ? '' : '<button class="btn wood" id="to-market">Go to Market</button>'}</div>` : ''}
    </div>
    <div class="parchment"><h2>Trader\u2019s log</h2><ul class="log">${log || '<li class="muted">Your journey has not begun.</li>'}</ul></div>
  </div>`;
  document.getElementById('back')?.addEventListener('click', () => go('home'));
  document.getElementById('to-market')?.addEventListener('click', async () => { await refreshConfig(); go('market'); });
}

// ---------------------------------------------------------------- caravan
async function viewCaravan() {
  const me = S.me;
  if (me.caravan) {
    const c = me.caravan;
    $app.innerHTML = `<div class="parchment" style="max-width:760px;margin:0 auto">
      <h1>Caravan ${esc(c.name)}</h1>
      <p>${c.members.length} of ${S.cfg.maxCaravan} traders. Your caravan is ranked by the average wealth of its members.</p>
      <div class="lapis" style="margin-bottom:1rem"><h3>Average wealth</h3><div class="num" style="font-size:2.2rem;font-weight:700;color:var(--gold-bright)">${fmt(c.average)}</div></div>
      <table><thead><tr><th>Trader</th><th class="right">Bank</th></tr></thead><tbody>
        ${c.members.map((m) => `<tr class="${m.name === me.name ? 'me' : ''}"><td>${esc(m.name)}</td><td class="right num">${fmt(m.money)}</td></tr>`).join('')}
      </tbody></table>
      <div class="row" style="margin-top:1.5rem"><button class="btn danger" id="leave">Leave caravan</button></div>
    </div>`;
    document.getElementById('leave').onclick = async () => {
      if (!(await confirmBox('Leave this caravan?', `<p>You can join another caravan later. If you are the last member, ${esc(c.name)} will be disbanded.</p>`, 'Leave', 'Stay', true))) return;
      if (await act('caravan/leave')) { toast('You left the caravan.'); render(); }
    };
    return;
  }
  $app.innerHTML = `<div class="auth-grid" style="margin-top:0">
    <form class="parchment" id="f-new">
      <h2>Start a caravan</h2>
      <p class="muted">Travel together with up to ${S.cfg.maxCaravan} traders. Share the password only with your group.</p>
      <div class="field"><label for="cn">Caravan name</label><input id="cn" maxlength="30" required></div>
      <div class="field"><label for="cp">Caravan password</label><input id="cp" minlength="3" required autocomplete="off"></div>
      <div class="field"><button class="btn big">Create caravan</button></div>
    </form>
    <form class="parchment" id="f-join">
      <h2>Join a caravan</h2>
      <p class="muted">Ask the founder for the password.</p>
      <div class="field"><label for="cj">Caravan</label><select id="cj" required><option value="">Loading caravans…</option></select></div>
      <div class="field"><label for="cjp">Password</label><input id="cjp" required autocomplete="off"></div>
      <div class="field"><button class="btn big wood">Join caravan</button></div>
    </form>
  </div>`;
  document.getElementById('f-new').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await act('caravan/create', { name: cn.value, password: cp.value })) { toast('Caravan founded!'); render(); }
  });
  document.getElementById('f-join').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await act('caravan/join', { id: Number(cj.value), password: cjp.value })) { toast('You joined the caravan!'); render(); }
  });
  try {
    const { caravans, max } = await api.get('caravans');
    const sel = document.getElementById('cj');
    if (!sel) return;
    sel.innerHTML = caravans.length
      ? '<option value="">Choose a caravan…</option>' + caravans.map((c) => `<option value="${c.id}" ${c.members >= max ? 'disabled' : ''}>${esc(c.name)} (${c.members}/${max}${c.members >= max ? ', full' : ''})</option>`).join('')
      : '<option value="">No caravans yet. Start one!</option>';
  } catch (e) { toast(e.message, 'error'); }
}

// ---------------------------------------------------------------- leaderboard
async function viewLeaderboard() {
  $app.innerHTML = `<div class="parchment"><h1>Leaderboard</h1><p>Loading…</p></div>`;
  let b;
  try { b = await api.get('leaderboard'); } catch (e) { toast(e.message, 'error'); return; }
  if (currentView() !== 'leaderboard') return;
  const me = S.me;
  const traders = b.traders.map((t, i) => `<tr class="${t.id === me.id ? 'me' : ''}"><td class="rank">${i + 1}</td><td>${esc(t.name)}</td><td>${t.caravan ? esc(t.caravan) : '<span class="muted">none</span>'}</td><td>${t.level}</td><td class="right num">${fmt(t.money)}</td></tr>`).join('');
  const caravans = b.caravans.map((c, i) => `<tr class="${me.caravan && me.caravan.id === c.id ? 'me' : ''}"><td class="rank">${i + 1}</td><td>${esc(c.name)}</td><td class="right">${c.members}</td><td class="right num">${fmt(c.average)}</td></tr>`).join('');
  $app.innerHTML = `<div class="grid-2" style="grid-template-columns:minmax(0,6fr) minmax(0,5fr)">
    <div class="parchment"><div class="row" style="justify-content:space-between"><h1>Top traders</h1><button class="btn ghost small" id="rf">Refresh</button></div>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Trader</th><th>Caravan</th><th>Level</th><th class="right">Bank</th></tr></thead><tbody>${traders || '<tr><td colspan="5">No traders yet.</td></tr>'}</tbody></table></div></div>
    <div class="parchment"><h1>Caravans</h1><p class="muted">Ranked by average wealth per member.</p>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Caravan</th><th class="right">Traders</th><th class="right">Average</th></tr></thead><tbody>${caravans || '<tr><td colspan="4">No caravans yet.</td></tr>'}</tbody></table></div></div>
  </div>`;
  document.getElementById('rf').onclick = () => render();
}

// ---------------------------------------------------------------- travel
const CAMEL = `<svg class="camel" viewBox="0 0 100 70" aria-hidden="true"><g fill="#4b2e1a">
  <path d="M18 40c1-15 12-22 21-14 4-10 17-12 22 1l9 2c2-10 6-17 13-17l8 2v4h-6c-4 4-6 12-8 20-2 7-8 9-14 9H30c-7 0-12-2-12-7z"/>
  <rect x="25" y="44" width="4.5" height="24" rx="2"/><rect x="34" y="44" width="4.5" height="24" rx="2"/>
  <rect x="58" y="44" width="4.5" height="24" rx="2"/><rect x="66" y="44" width="4.5" height="24" rx="2"/>
  <path d="M18 38c-5 2-7 8-6 14" stroke="#4b2e1a" stroke-width="2.5" fill="none"/></g>
  <path d="M36 26c6-4 14-4 20 2v8H36z" fill="#1e3a7b" stroke="#c9a048" stroke-width="1.5"/></svg>`;

const tripTotal = (t) => t.days + (t.delay || 0);

function viewTravel() {
  const t = S.me.travel;
  const half = Math.floor(t.days / 2);
  if (!S.travel) {
    // fresh trip, or a page reload in the middle of one
    S.travel = t.resolved ? { day: half, phase: 'toEnd' } : { day: 0, phase: 'toHalf' };
  }
  $app.innerHTML = `<div class="parchment travel">
    <h2>Days traveling</h2>
    <div class="counter num" id="ctr">${S.travel.day}</div>
    <div class="of">of <span id="tot">${tripTotal(t)}</span> days from ${esc(city(t.from).name)} to ${esc(city(t.to).name)}</div>
    <div class="route-strip">
      <svg class="dunes" viewBox="0 0 800 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 40 C120 10 220 60 360 34 S620 12 800 38 V70 H0Z" fill="#d9a560"/><path d="M0 56 C160 36 300 70 480 50 S700 44 800 56 V70 H0Z" fill="#c98b45"/></svg>
      <div id="camel-wrap">${CAMEL}</div>
      <span class="end left">${esc(city(t.from).name)}</span><span class="end right">${esc(city(t.to).name)}</span>
    </div>
    <div id="enc"></div>
  </div>`;
  placeCamel();
  if (S.travel.phase === 'toHalf') runCounter(half, showEncounter);
  else if (S.travel.phase === 'toEnd') runToEnd();
  else if (S.travel.phase === 'encounter') showEncounter();
}

function placeCamel() {
  const t = S.me.travel; if (!t) return;
  const pct = 4 + Math.min(1, S.travel.day / Math.max(1, tripTotal(t))) * 88;
  const camel = document.querySelector('.route-strip .camel');
  if (camel) camel.style.left = pct + '%';
  const ctr = document.getElementById('ctr'); if (ctr) ctr.textContent = S.travel.day;
}

function runCounter(stopAt, then) {
  clearInterval(S.travel.timer);
  if (S.travel.day >= stopAt) { then(); return; }
  const ms = Math.max(50, (S.cfg.secondsPerDay || 1) * 1000);
  S.travel.timer = setInterval(() => {
    if (!S.travel) return;
    S.travel.day++;
    placeCamel();
    if (S.travel.day >= stopAt) { clearInterval(S.travel.timer); then(); }
  }, ms);
}

// What a revealed choice tile shows after the player picks.
function tileReveal(id, v) {
  if (id === 'oasis') return { good: true, text: `+${v}` };
  if (id === 'mansamusa') return { good: true, text: `${v} lb` };
  return { good: !!v, text: v ? '\u2713' : '\u2717' };
}

function showEncounter() {
  S.travel.phase = 'encounter';
  const t = S.me.travel, enc = S.cfg.encounters[t.encounter];
  const box = document.getElementById('enc');
  if (!box) return;
  setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  const img = `<img src="${enc.image}" alt="Encounter: ${esc(enc.name)}" width="1280" height="720">`;

  if (enc.kind === 'none') { // Base Camp: nothing to pick
    box.innerHTML = `<div class="encounter">${img}
      <div class="outcome good">${esc(t.outcome?.text || 'You rest for a little while.')}</div>
      <button class="btn big" id="cont" style="margin-top:1rem">Continue on your trip</button></div>`;
    document.getElementById('cont').onclick = continueTrip;
    return;
  }

  let picker;
  if (enc.kind === 'choice') { // Ben and James
    const canGive = inv('food') >= 2 && inv('water') >= 2;
    picker = `<div class="choice-row">
      <button class="btn big sell" data-choice="give" ${canGive ? '' : 'disabled'}>Give them supplies</button>
      <button class="btn big wood" data-choice="leave">Leave them behind</button>
      <button class="btn big danger" data-choice="money">Get your money back</button>
    </div>${canGive ? '' : '<p class="hint">You need at least 2 lb of food and 2 jugs of water to share.</p>'}`;
  } else {
    picker = `<div class="picks">${[...Array(S.cfg.choices || 10)].map((_, i) => `<button class="pick" data-choice="${i}" aria-label="Choice ${i + 1}"><span class="pick-n">${i + 1}</span><span class="pick-q">?</span></button>`).join('')}</div>`;
  }
  box.innerHTML = `<div class="encounter">${img}
    <h3 style="margin-top:1rem">${esc(enc.prompt)}</h3>
    ${enc.kind === 'choice' ? '' : '<p class="muted" style="margin:0 auto .5rem">Every choice hides a different result. Pick one.</p>'}
    <div id="picker">${picker}</div></div>`;

  box.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', async () => {
    box.querySelectorAll('[data-choice]').forEach((d) => (d.disabled = true));
    const raw = b.dataset.choice;
    const res = await act('travel/choose', { choice: enc.kind === 'choice' ? raw : Number(raw) }, { quiet: true });
    if (!res) { box.querySelectorAll('[data-choice]').forEach((d) => (d.disabled = false)); return; }
    const o = res.outcome;
    if (o.layout) { // reveal every tile so students see the choices were random
      box.querySelectorAll('.pick').forEach((el, i) => {
        const r = tileReveal(t.encounter, o.layout[i]);
        el.classList.add(r.good ? 'good' : 'bad');
        if (i === o.pick) el.classList.add('chosen');
        el.querySelector('.pick-q').textContent = r.text;
      });
    }
    const goodish = o.success && !o.perish;
    box.querySelector('#picker').insertAdjacentHTML('afterend', `<div class="outcome ${goodish ? 'good' : 'bad'}">${esc(o.text)}</div>
      <button class="btn big ${o.perish ? 'danger' : ''}" id="cont" style="margin-top:1rem">${o.perish ? 'Continue' : 'Continue on your trip'}</button>`);
    if (enc.kind === 'choice') box.querySelector('#picker').remove();
    renderTop('travel');
    document.getElementById('cont').onclick = () => {
      if (o.perish) { S.perishInfo = o.text; go('home'); }
      else continueTrip();
    };
  }));
}

function continueTrip() {
  document.getElementById('enc').innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  S.travel.phase = 'toEnd';
  document.getElementById('tot').textContent = tripTotal(S.me.travel);
  runToEnd();
}

function runToEnd() {
  const t = S.me.travel;
  const supplyDays = Math.min(inv('food'), inv('water')) * (S.cfg.daysPerRation || 25);
  const stopAt = t.days > supplyDays ? Math.max(S.travel.day, supplyDays) : tripTotal(t);
  runCounter(stopAt, arrive);
}

// ---------------------------------------------------------------- market questions
async function viewQuiz(feedback = null, data = null) {
  const c = city(S.me.city);
  if (!data) {
    $app.innerHTML = `<div class="parchment quiz"><h1>The gate of ${esc(c.name)}\u2019s market</h1><p>Loading…</p></div>`;
    try { data = await api.post('market/quiz'); } catch (e) { toast(e.message, 'error'); return; }
    if (data.passed || data.me?.marketOpen) { if (data.me) S.me = data.me; S.me.marketOpen = true; return render(); }
  }
  if (currentView() !== 'market') return;
  const dots = [...Array(data.needed)].map((_, i) => `<span class="dot ${i < data.streak ? 'on' : ''}" aria-hidden="true"></span>`).join('');
  $app.innerHTML = `<div class="parchment quiz">
    <h1>The gate of ${esc(c.name)}\u2019s market</h1>
    <p>The market guard will let you in after you answer <strong>${data.needed} question${data.needed === 1 ? '' : 's'} in a row</strong> correctly. A wrong answer starts the count over.</p>
    <div class="streak"><span class="dots">${dots}</span><span>${data.streak} of ${data.needed} correct in a row</span></div>
    ${feedback ? `<div class="outcome ${feedback.good ? 'good' : 'bad'}" style="margin:0 0 1rem">${feedback.html}</div>` : ''}
    <div class="question">
      <h2>${esc(data.question.text)}</h2>
      <div class="answers">${data.question.options.map((o) => `<button class="answer" data-i="${o.i}">${esc(o.text)}</button>`).join('')}</div>
    </div>
    <div class="row" style="margin-top:1.5rem"><button class="btn ghost" id="back">Back to ${esc(c.name)}</button></div>
  </div>`;
  document.getElementById('back').onclick = () => go('home');
  $app.querySelectorAll('.answer').forEach((b) => b.addEventListener('click', async () => {
    $app.querySelectorAll('.answer').forEach((x) => (x.disabled = true));
    const res = await act('market/answer', { id: data.question.id, choice: Number(b.dataset.i) }, { quiet: true });
    if (!res) { $app.querySelectorAll('.answer').forEach((x) => (x.disabled = false)); return; }
    if (res.passed) { toast(`Correct! The ${c.name} market is open.`); S.me.marketOpen = true; return render(); }
    viewQuiz(res.correct
      ? { good: true, html: '<strong>Correct!</strong> Here is your next question.' }
      : { good: false, html: `<strong>Not quite.</strong> The answer was \u201c${esc(res.correctText)}.\u201d Your count starts over.` }, res);
  }));
}

// ---------------------------------------------------------------- trader school
function viewSchool() {
  const me = S.me, price = me.skillPrice;
  const cards = S.cfg.skillOrder.map((id) => {
    const sk = S.cfg.skills[id], owned = me.skills.includes(id);
    return `<article class="shop ${owned ? 'buys' : 'sells'}">
      <h3>${esc(sk.name)}</h3>
      <p class="desc">${esc(sk.desc)}</p>
      <div class="actions">${owned ? '<span class="haggled good">Class completed</span>'
        : `<button class="btn" data-skill="${id}" ${me.money < price ? 'disabled' : ''}>Take class for <span class="num">${fmt(price)}</span></button>`}</div>
    </article>`;
  }).join('');
  $app.innerHTML = `<div class="parchment">
    <div class="market-head">
      <div><h1>Cairo Trader School</h1>
      <p class="muted" style="margin:0">Each class costs <strong class="num">${fmt(price)}</strong> during Level ${me.level}. Classes get more expensive in later levels, and what you learn stays with you for the rest of the game.</p></div>
      <div class="row"><button class="btn ghost" id="back">Back to Cairo</button></div>
    </div>
    <p>Bank: <strong class="num">${fmt(me.money)}</strong></p>
    <div class="shops">${cards}</div>
  </div>`;
  document.getElementById('back').onclick = () => go('home');
  $app.querySelectorAll('[data-skill]').forEach((b) => b.addEventListener('click', async () => {
    const sk = S.cfg.skills[b.dataset.skill];
    if (!(await confirmBox(`Take ${esc(sk.name)}?`, `<p>This class costs <strong>${fmt(price)}</strong>. You have ${fmt(me.money)}.</p>`, 'Take class', 'Not now'))) return;
    if (await act('school/buy', { skill: b.dataset.skill })) render();
  }));
}

async function arrive() {
  S.travel.phase = 'arriving';
  const to = S.me.travel.to;
  let res = null;
  for (let i = 0; i < 3 && !res; i++) { res = await act('travel/arrive', {}, { quiet: true }); if (!res) await new Promise((r) => setTimeout(r, 1500)); }
  if (!res) { toast('Couldn\u2019t reach the server. Refresh the page to finish your trip.', 'error'); return; }
  S.travel = null;
  if (res.perished) {
    const p = res.perished;
    S.perishInfo = `You ran out of ${p.ranOut} ${p.day} days into the journey to ${city(to).name}. That trip needed ${p.need} lb of food and ${p.need} jugs of water.`;
  } else {
    toast(`You reached ${city(to).name}, using ${res.used} lb of food and ${res.used} ${res.used === 1 ? 'jug' : 'jugs'} of water.`);
    if (res.summary) { S.summary = res.summary; toast('Your days ran out, so the level has ended.'); }
  }
  go('home');
}

// ---------------------------------------------------------------- perished / finished
function viewPerished() {
  const me = S.me, L = me.levelInfo;
  $app.innerHTML = `<div class="parchment level-title">
    <img src="/img/perished.webp" alt="You perished" width="960" height="540" style="border:6px solid var(--wood);border-radius:6px;margin:0 auto 1.5rem">
    <h1>You perished and have become part of the sands of time</h1>
    ${S.perishInfo ? `<p style="margin:0 auto 1rem">${esc(S.perishInfo)}</p>` : ''}
    <p style="margin:0 auto 1.5rem">Restart Level ${L.number} in ${esc(city(L.start_city).name)} with the ${me.snapshotMoney !== null ? fmt(me.snapshotMoney) : 'money'} and goods you had when this level began.</p>
    <button class="btn big" id="restart">Restart Level ${L.number}</button>
  </div>`;
  document.getElementById('restart').onclick = async () => {
    if (await act('level/restart')) { S.perishInfo = null; toast('A new caravan sets out. Good luck!'); go('home'); }
  };
}

function viewFinished() {
  const me = S.me;
  $app.innerHTML = `<div class="parchment level-title">
    <div class="lv">All five levels complete</div>
    <h1>Master Trader ${esc(me.name)}</h1>
    ${S.summary ? `<p>You finished Level ${S.summary.level} with ${S.summary.unused} unused days for a ${fmt(S.summary.bonus)} bonus.</p>` : ''}
    <p style="margin:0 auto">Your final fortune is</p>
    <div class="num" style="font-family:var(--display);font-size:clamp(3rem,10vw,5.5rem);color:var(--wood)">${fmt(me.money)}</div>
    <button class="btn big" id="lb" style="margin-top:1rem">See the leaderboard</button>
  </div>`;
  document.getElementById('lb').onclick = () => go('leaderboard');
}

boot();
