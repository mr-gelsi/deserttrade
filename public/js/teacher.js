// Desert Trade — teacher controls
import { makeApi, esc, fmt, toast, confirmBox } from './api.js';

const api = makeApi('dt_teacher_token');
const $app = document.getElementById('app');
const T = { data: null, tab: 'levels' };

document.getElementById('logout').onclick = () => { api.token = null; T.data = null; render(); };

async function load() {
  try { T.data = await api.get('teacher/state'); }
  catch (e) { if (e.status === 401) { api.token = null; T.data = null; } else toast(e.message, 'error'); }
  render();
}

async function post(path, body, okMsg) {
  try {
    const r = await api.post(path, body);
    if (okMsg) toast(okMsg);
    return r;
  } catch (e) {
    toast(e.message, 'error');
    if (e.status === 401) { api.token = null; T.data = null; render(); }
    return null;
  }
}

function render() {
  document.getElementById('logout').classList.toggle('hidden', !T.data);
  if (!T.data) return viewLogin();
  const tabs = [['levels', 'Levels'], ['players', 'Traders'], ['bonus', 'Give bonuses'], ['caravans', 'Caravans'], ['markets', 'Market prices'], ['settings', 'Game settings']];
  $app.innerHTML = `<div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button role="tab" data-tab="${id}" aria-selected="${T.tab === id}">${l}</button>`).join('')}</div>
    <div class="parchment" id="panel"></div>`;
  $app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { T.tab = b.dataset.tab; render(); });
  ({ levels: tabLevels, players: tabPlayers, bonus: tabBonus, caravans: tabCaravans, markets: tabMarkets, settings: tabSettings })[T.tab]();
}

function viewLogin() {
  $app.innerHTML = `<form class="parchment" id="f" style="max-width:480px;margin:2rem auto">
    <h1>Teacher login</h1>
    <p class="muted">Use the TEACHER_PASSWORD you set in Cloudflare.</p>
    <div class="field"><label for="pw">Teacher password</label><input id="pw" type="password" autocomplete="current-password" required></div>
    <div class="field"><button class="btn big">Log in</button></div>
  </form>`;
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const r = await post('teacher/login', { password: document.getElementById('pw').value });
    if (r) { api.token = r.token; load(); }
  };
}

const STATUS = { locked: 'needs level code', title: 'unlocked, not started', playing: 'playing', perished: 'perished', complete: 'done, needs next code', finished: 'finished all levels' };
const cityOptions = (sel) => T.data.cityOrder.map((c) => `<option value="${c}" ${c === sel ? 'selected' : ''}>${esc(T.data.cities[c].name)}</option>`).join('');
const itemName = (id) => T.data.items[id]?.name || id;

// ---------------------------------------------------------------- levels
function tabLevels() {
  const panel = document.getElementById('panel');
  panel.innerHTML = `<h1>Levels</h1>
    <p>Students must enter each level\u2019s code before they can start it. Share a code when you are ready for the class to move on.</p>
    <form id="f">${T.data.levels.map((l, i) => `<div class="level-card" data-i="${i}">
      <h2>Level ${i + 1}</h2>
      <div class="form-grid">
        <div><label>Level name</label><input name="name" value="${esc(l.name)}" maxlength="60"></div>
        <div><label>Level code</label><input name="password" value="${esc(l.password)}" maxlength="60" required></div>
        <div><label>Days allowed</label><input name="days" type="number" min="1" max="10000" value="${l.days}" required></div>
        <div><label>Starting city</label><select name="start_city">${cityOptions(l.start_city)}</select></div>
        <div><label>Bonus money at start ($)</label><input name="start_bonus" type="number" min="0" step="0.01" value="${l.start_bonus}"></div>
        <div><label>Bonus per unused day ($)</label><input name="early_bonus" type="number" min="0" step="0.01" value="${l.early_bonus}"></div>
      </div>
      <div class="field"><label>Instructions shown on the level title page</label><textarea name="instructions" maxlength="2000">${esc(l.instructions)}</textarea></div>
    </div>`).join('')}
    <div class="row" style="margin-top:1rem"><button class="btn big">Save levels</button></div></form>`;
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const levels = [...panel.querySelectorAll('.level-card')].map((card) => {
      const g = (n) => card.querySelector(`[name="${n}"]`).value;
      return { name: g('name'), password: g('password'), days: Number(g('days')), start_city: g('start_city'), start_bonus: Number(g('start_bonus')), early_bonus: Number(g('early_bonus')), instructions: g('instructions') };
    });
    const r = await post('teacher/levels', { levels }, 'Levels saved.');
    if (r) T.data.levels = r.levels;
  };
}

// ---------------------------------------------------------------- players
function tabPlayers() {
  const panel = document.getElementById('panel');
  const ps = T.data.players;
  const goods = (inv) => Object.entries(inv).map(([k, q]) => `${q} ${esc(itemName(k))}`).join(', ') || '<span class="muted">empty</span>';
  panel.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Traders (${ps.length})</h1><button class="btn ghost small" id="rf">Refresh</button></div>
    <p class="muted">Moving a trader to a level unlocks it for them and starts them fresh in that level\u2019s city. Their money and goods are kept.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Trader</th><th>Level</th><th>Status</th><th>City / day</th><th class="right">Bank</th><th>Goods</th><th>Caravan</th><th>Actions</th></tr></thead>
      <tbody>${ps.map((p) => `<tr data-id="${p.id}">
        <td><strong>${esc(p.name)}</strong></td><td>${p.level}</td><td><span class="pill ${p.status}">${STATUS[p.status] || p.status}</span></td>
        <td>${esc(T.data.cities[p.city]?.name || '')}${p.status === 'playing' ? `, day ${p.day}` : ''}</td>
        <td class="right num">${fmt(p.money)}</td><td style="font-size:.92rem;max-width:240px">${goods(p.inventory)}</td>
        <td>${p.caravan ? esc(p.caravan) : '<span class="muted">none</span>'}</td>
        <td><div class="row" style="flex-wrap:nowrap">
          <select data-lv aria-label="Level for ${esc(p.name)}" style="width:auto">${T.data.levels.map((l, i) => `<option value="${i + 1}" ${p.level === i + 1 ? 'selected' : ''}>L${i + 1}</option>`).join('')}</select>
          <button class="btn small" data-a="set_level">Move</button>
          <button class="btn small wood" data-a="reset_password">Password</button>
          ${p.caravan ? '<button class="btn small ghost" data-a="kick">Kick</button>' : ''}
          <button class="btn small danger" data-a="delete">Delete</button>
        </div></td></tr>`).join('') || '<tr><td colspan="8">No traders yet.</td></tr>'}</tbody></table></div>`;
  document.getElementById('rf').onclick = load;
  panel.querySelectorAll('[data-a]').forEach((b) => b.onclick = async () => {
    const tr = b.closest('tr'), id = Number(tr.dataset.id), p = ps.find((x) => x.id === id), a = b.dataset.a;
    const body = { id, action: a };
    if (a === 'set_level') {
      body.level = Number(tr.querySelector('[data-lv]').value);
      if (!(await confirmBox(`Move ${esc(p.name)}?`, `<p>${esc(p.name)} will start Level ${body.level} fresh, already unlocked.</p>`, 'Move'))) return;
    } else if (a === 'reset_password') {
      const pw = prompt(`New password for ${p.name} (at least 4 characters):`);
      if (!pw) return;
      body.password = pw;
    } else if (a === 'delete') {
      if (!(await confirmBox(`Delete ${esc(p.name)}?`, '<p>This removes the trader, their money and their log. It can\u2019t be undone.</p>', 'Delete', 'Cancel', true))) return;
    }
    if (await post('teacher/player', body, 'Done.')) load();
  });
}

// ---------------------------------------------------------------- bonus
function tabBonus() {
  const panel = document.getElementById('panel');
  const items = Object.entries(T.data.items).map(([id, it]) => `<option value="${id}">${esc(it.name)} (${it.unit})</option>`).join('');
  panel.innerHTML = `<h1>Give bonuses</h1>
    <p>Reward great answers, teamwork or participation. Bonuses are kept even if a trader later perishes and restarts the level. Use a negative amount to take money away.</p>
    <form id="f" style="max-width:720px">
      <div class="form-grid">
        <div><label for="tg">Give to</label><select id="tg"><option value="player">One trader</option><option value="caravan">Everyone in a caravan</option><option value="all">All traders</option></select></div>
        <div id="who-wrap"><label for="who">Who</label><select id="who"></select></div>
      </div>
      <div class="form-grid" style="margin-top:.75rem">
        <div><label for="m">Money ($)</label><input id="m" type="number" step="0.01" value="0"></div>
        <div><label for="it">Item (optional)</label><select id="it"><option value="">No item</option>${items}</select></div>
        <div><label for="q">Item amount</label><input id="q" type="number" min="1" step="1" value="1"></div>
      </div>
      <div class="field"><label for="why">Reason (shows in their log)</label><input id="why" maxlength="120" placeholder="Great map work"></div>
      <div class="field"><button class="btn big">Give bonus</button></div>
    </form>`;
  const tg = document.getElementById('tg'), who = document.getElementById('who');
  const fill = () => {
    document.getElementById('who-wrap').classList.toggle('hidden', tg.value === 'all');
    who.innerHTML = tg.value === 'caravan'
      ? T.data.caravans.map((c) => `<option value="${c.id}">${esc(c.name)} (${c.members})</option>`).join('') || '<option value="">No caravans</option>'
      : T.data.players.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">No traders</option>';
  };
  tg.onchange = fill; fill();
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const it = document.getElementById('it').value;
    const r = await post('teacher/bonus', { target: tg.value, id: Number(who.value), money: Number(document.getElementById('m').value), item: it || null, qty: Number(document.getElementById('q').value), reason: document.getElementById('why').value });
    if (r) { toast(`Bonus given to ${r.count} trader${r.count === 1 ? '' : 's'}.`); load(); }
  };
}

// ---------------------------------------------------------------- caravans
function tabCaravans() {
  const panel = document.getElementById('panel');
  const members = (cid) => T.data.players.filter((p) => p.caravan_id === cid).map((p) => esc(p.name)).join(', ');
  panel.innerHTML = `<h1>Caravans</h1>
    <div class="table-wrap"><table><thead><tr><th>Caravan</th><th>Members</th><th class="right">Average wealth</th><th></th></tr></thead>
    <tbody>${T.data.caravans.map((c) => `<tr><td><strong>${esc(c.name)}</strong></td><td>${members(c.id) || '<span class="muted">empty</span>'}</td><td class="right num">${fmt(c.average)}</td>
      <td><button class="btn small danger" data-del="${c.id}">Disband</button></td></tr>`).join('') || '<tr><td colspan="4">No caravans yet.</td></tr>'}</tbody></table></div>`;
  panel.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!(await confirmBox('Disband this caravan?', '<p>Its members keep their money and become solo traders.</p>', 'Disband', 'Cancel', true))) return;
    if (await post('teacher/caravan/delete', { id: Number(b.dataset.del) }, 'Caravan disbanded.')) load();
  });
}

// ---------------------------------------------------------------- markets
function tabMarkets() {
  const panel = document.getElementById('panel');
  const M = T.data.markets;
  const rows = (c, side) => M[c][side].map((x) => `<tr><td>${esc(itemName(x.item))}</td><td><input type="number" min="0" step="0.01" data-c="${c}" data-side="${side}" data-item="${x.item}" value="${x.price}"></td></tr>`).join('');
  panel.innerHTML = `<h1>Market prices</h1>
    <p>Change what each city charges or pays. Jerusalem and Mecca started with placeholder prices because the planning sheet left them blank.</p>
    <div class="city-prices-grid">${T.data.cityOrder.map((c) => `<div class="city-prices price-table">
      <h2>${esc(T.data.cities[c].name)}</h2>
      <div class="form-grid"><div><label>Food ($ per lb)</label><input type="number" min="0" step="0.01" data-c="${c}" data-side="food" value="${M[c].food}"></div>
      <div><label>Water ($ per jug)</label><input type="number" min="0" step="0.01" data-c="${c}" data-side="water" value="${M[c].water}"></div></div>
      <h3 style="margin-top:.8rem">Exports (city sells)</h3><table><tbody>${rows(c, 'exports')}</tbody></table>
      <h3 style="margin-top:.8rem">Imports (city buys)</h3><table><tbody>${rows(c, 'imports')}</tbody></table>
    </div>`).join('')}</div>
    <div class="row" style="margin-top:1rem"><button class="btn big" id="save">Save prices</button></div>`;
  document.getElementById('save').onclick = async () => {
    const out = JSON.parse(JSON.stringify(M));
    panel.querySelectorAll('input[data-c]').forEach((inp) => {
      const c = inp.dataset.c, side = inp.dataset.side, v = Number(inp.value);
      if (side === 'food' || side === 'water') out[c][side] = v;
      else out[c][side].find((x) => x.item === inp.dataset.item).price = v;
    });
    const r = await post('teacher/markets', { markets: out }, 'Prices saved. Students see them the next time they open a market.');
    if (r) T.data.markets = r.markets;
  };
}

// ---------------------------------------------------------------- settings
function tabSettings() {
  const panel = document.getElementById('panel');
  const s = T.data.settings;
  panel.innerHTML = `<h1>Game settings</h1>
    <form id="f" style="max-width:640px">
      <div class="field"><label for="sm">Starting money for new traders ($)</label><input id="sm" type="number" min="0" step="0.01" value="${s.starting_money}">
        <p class="hint">Given once when a trader is created. Level 1 adds its own starting bonus on top (set on the Levels tab).</p></div>
      <div class="field"><label for="spd">Seconds per travel day</label><input id="spd" type="number" min="0.05" max="5" step="0.05" value="${s.seconds_per_day}">
        <p class="hint">1 means the travel counter goes up one day per second. A 117-day trip then takes about 2 minutes. Lower it to speed things up.</p></div>
      <div class="field"><label for="ls">Bandits and sandstorms take a share of</label>
        <select id="ls"><option value="supplies" ${s.loss_scope === 'supplies' ? 'selected' : ''}>Supplies only (food and water)</option><option value="all" ${s.loss_scope === 'all' ? 'selected' : ''}>All cargo (supplies and trade goods)</option></select></div>
      <div class="field"><button class="btn big">Save settings</button></div>
    </form>
    <hr style="margin:2rem 0;border:none;border-top:2px dashed var(--dune-deep)">
    <h2>Start a new game</h2>
    <p>Deletes every trader, caravan and log so a new class can play. Levels, codes, prices and settings stay.</p>
    <button class="btn danger" id="reset">Delete all traders</button>`;
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const r = await post('teacher/settings', { starting_money: Number(sm.value), seconds_per_day: Number(spd.value), loss_scope: ls.value }, 'Settings saved.');
    if (r) T.data.settings = r.settings;
  };
  document.getElementById('reset').onclick = async () => {
    const typed = prompt('This deletes ALL traders and caravans. Type RESET to confirm.');
    if (typed !== 'RESET') return;
    if (await post('teacher/reset', { confirm: 'RESET' }, 'All traders deleted.')) load();
  };
}

if (api.token) load(); else render();
