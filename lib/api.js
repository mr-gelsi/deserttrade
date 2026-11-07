// =====================================================================
// Desert Trade API. Every money/inventory change happens here on the
// server so students can't edit their wealth from the browser.
// =====================================================================
import {
  CITIES, CITY_ORDER, ITEMS, DEFAULT_MARKETS, ENCOUNTERS, DEFAULT_LEVELS,
  DEFAULT_SETTINGS, DAYS_PER_RATION, MAX_CARAVAN, route, distanceTable,
} from './data.js';
import { hashPassword, verifyPassword, safeEqual, newToken, randInt } from './auth.js';

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (msg, status = 400) => { throw new HttpError(status, msg); };
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const r2 = (n) => Math.round(n * 100) / 100;
const cleanStr = (s, max) => String(s ?? '').trim().slice(0, max);
const intIn = (v, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
const numIn = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };

// ---------- settings ----------
async function getSetting(db, key, fallback) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  if (!row) return structuredClone(fallback);
  try { return JSON.parse(row.value); } catch { return structuredClone(fallback); }
}
const setSetting = (db, key, value) => db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
).bind(key, JSON.stringify(value)).run();

const getLevels = (db) => getSetting(db, 'levels', DEFAULT_LEVELS);
const getSettings = async (db) => ({ ...DEFAULT_SETTINGS, ...(await getSetting(db, 'game', {})) });

// Markets: structure always comes from DEFAULT_MARKETS; teacher edits only change prices.
async function getMarkets(db) {
  const saved = await getSetting(db, 'markets', {});
  const out = {};
  for (const c of CITY_ORDER) {
    const d = DEFAULT_MARKETS[c], s = saved[c] || {};
    const price = (list, savedList) => list.map(([item, p]) => {
      const hit = (savedList || []).find((x) => x.item === item);
      return { item, price: hit && Number.isFinite(+hit.price) ? +hit.price : p };
    });
    out[c] = {
      food: Number.isFinite(+s.food) ? +s.food : d.food,
      water: Number.isFinite(+s.water) ? +s.water : d.water,
      imports: price(d.imports, s.imports),
      exports: price(d.exports, s.exports),
    };
  }
  return out;
}

// ---------- players ----------
const JSON_FIELDS = ['inventory', 'snapshot', 'travel', 'haggles'];
function parsePlayer(row) {
  if (!row) return null;
  for (const f of JSON_FIELDS) { try { row[f] = row[f] ? JSON.parse(row[f]) : null; } catch { row[f] = null; } }
  row.inventory ||= {}; row.haggles ||= {};
  return row;
}
const loadPlayer = async (db, id) => parsePlayer(await db.prepare('SELECT * FROM players WHERE id = ?').bind(id).first());

function savePlayer(db, p) {
  for (const k of Object.keys(p.inventory)) if (!(p.inventory[k] > 0)) delete p.inventory[k];
  return db.prepare(`UPDATE players SET money=?, inventory=?, level=?, status=?, city=?, day=?,
      snapshot=?, travel=?, haggles=?, caravan_id=? WHERE id=?`)
    .bind(r2(p.money), JSON.stringify(p.inventory), p.level, p.status, p.city, p.day,
      p.snapshot ? JSON.stringify(p.snapshot) : null, p.travel ? JSON.stringify(p.travel) : null,
      JSON.stringify(p.haggles || {}), p.caravan_id ?? null, p.id).run();
}
const addLog = (db, p, text) => db.prepare('INSERT INTO logs (player_id, level, day, text) VALUES (?, ?, ?, ?)')
  .bind(p.id, p.level, p.day || 0, text).run();

const money = (n) => '$' + r2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unitStr = (item, q) => {
  const u = ITEMS[item]?.unit || 'lb';
  return u === 'lb' || u === 'sheep' || q === 1 ? u : u + 's';
};
const qtyStr = (item, q) => `${q} ${unitStr(item, q)} ${ITEMS[item]?.name || item}`;

async function publicState(db, p) {
  const levels = await getLevels(db);
  const L = levels[p.level - 1];
  let caravan = null;
  if (p.caravan_id) {
    const c = await db.prepare('SELECT id, name FROM caravans WHERE id = ?').bind(p.caravan_id).first();
    if (c) {
      const { results } = await db.prepare('SELECT name, money FROM players WHERE caravan_id = ? ORDER BY money DESC').bind(c.id).all();
      caravan = { ...c, members: results, average: results.length ? r2(results.reduce((a, m) => a + m.money, 0) / results.length) : 0 };
    }
  }
  const { results: log } = await db.prepare('SELECT level, day, text, created_at FROM logs WHERE player_id = ? ORDER BY id DESC LIMIT 60').bind(p.id).all();
  let travel = null;
  if (p.travel) {
    const t = p.travel;
    travel = { from: t.from, to: t.to, days: t.days, extraDays: t.extraDays, encounter: t.encounter, resolved: t.resolved, outcome: t.outcome };
  }
  return {
    id: p.id, name: p.name, money: r2(p.money), inventory: p.inventory, level: p.level, status: p.status,
    city: p.city, day: p.day, haggles: p.haggles, travel, caravan, log,
    levelInfo: L ? { number: p.level, name: L.name, days: L.days, instructions: L.instructions, start_city: L.start_city, start_bonus: L.start_bonus, early_bonus: L.early_bonus } : null,
    nextLevel: levels[p.level] ? { number: p.level + 1, name: levels[p.level].name } : null,
    snapshotMoney: p.snapshot ? p.snapshot.money : null,
  };
}

// ---------- sessions ----------
async function session(req, db) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  return db.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
}
async function requirePlayer(req, db) {
  const s = await session(req, db);
  if (!s || s.role !== 'player') fail('Please log in again.', 401);
  const p = await loadPlayer(db, s.player_id);
  if (!p) fail('This trader no longer exists. Create a new one.', 401);
  return p;
}
async function requireTeacher(req, db) {
  const s = await session(req, db);
  if (!s || s.role !== 'teacher') fail('Teacher login required.', 401);
  const age = Date.now() - new Date(s.created_at.replace(' ', 'T') + 'Z').getTime();
  if (age > 12 * 3600 * 1000) { await db.prepare('DELETE FROM sessions WHERE token = ?').bind(s.token).run(); fail('Session expired. Log in again.', 401); }
}
async function startSession(db, role, playerId) {
  const token = newToken();
  await db.prepare('INSERT INTO sessions (token, player_id, role) VALUES (?, ?, ?)').bind(token, playerId ?? null, role).run();
  return token;
}

// ---------- game helpers ----------
function needPlaying(p) {
  if (p.status !== 'playing') fail('Start the level first.');
}
function needInCity(p) {
  needPlaying(p);
  if (p.travel) fail('You are still on the road.');
}
const rations = (days) => Math.ceil(days / DAYS_PER_RATION);

function priceFor(markets, p, side, item) {
  const m = markets[p.city];
  let base = null;
  if (side === 'buy') {
    if (item === 'food') base = m.food;
    else if (item === 'water') base = m.water;
    else base = m.exports.find((x) => x.item === item)?.price ?? null;
  } else {
    base = m.imports.find((x) => x.item === item)?.price ?? null;
  }
  if (base === null) fail(`${CITIES[p.city].name} has no shop that will ${side === 'buy' ? 'sell' : 'buy'} that.`);
  return r2(base * (p.haggles[`${side}:${item}`] || 1));
}

function pickEncounter() {
  let roll = randInt(100), acc = 0;
  for (const [id, e] of Object.entries(ENCOUNTERS)) { acc += e.chance; if (roll < acc) return id; }
  return 'basecamp';
}
function winningFaces(n) {
  const faces = [1, 2, 3, 4, 5, 6];
  for (let i = faces.length - 1; i > 0; i--) { const j = randInt(i + 1); [faces[i], faces[j]] = [faces[j], faces[i]]; }
  return faces.slice(0, n).sort();
}
function loseShare(p, share, scope) {
  const lost = {};
  for (const [item, q] of Object.entries(p.inventory)) {
    if (scope !== 'all' && item !== 'food' && item !== 'water') continue;
    const n = Math.min(q, Math.ceil(q * share));
    if (n > 0) { p.inventory[item] = q - n; lost[item] = n; }
  }
  return lost;
}
const lostText = (lost) => Object.entries(lost).map(([i, q]) => qtyStr(i, q)).join(', ') || 'nothing (you had no supplies to lose)';

async function endLevel(db, p, levels, early) {
  const L = levels[p.level - 1];
  const unused = early ? Math.max(0, L.days - p.day) : 0;
  const bonus = r2(unused * (L.early_bonus || 0));
  p.money = r2(p.money + bonus);
  p.travel = null; p.haggles = {};
  p.status = p.level >= levels.length ? 'finished' : 'complete';
  const summary = { level: p.level, name: L.name, daysUsed: p.day, unused, bonus, money: p.money };
  await savePlayer(db, p);
  await addLog(db, p, `Ended Level ${p.level} on day ${p.day}. ${unused} unused days earned a ${money(bonus)} bonus. Bank: ${money(p.money)}.`);
  return summary;
}

// =====================================================================
// Routes
// =====================================================================
const routes = {
  // ---- public ----
  'GET config': async ({ db }) => {
    const [levels, markets, settings] = await Promise.all([getLevels(db), getMarkets(db), getSettings(db)]);
    return {
      cities: CITIES, cityOrder: CITY_ORDER, items: ITEMS, markets, distances: distanceTable(),
      encounters: Object.fromEntries(Object.entries(ENCOUNTERS).map(([k, e]) => [k, { name: e.name, image: e.image, roll: e.roll }])),
      levels: levels.map((l, i) => ({ number: i + 1, name: l.name, days: l.days, start_city: l.start_city })),
      secondsPerDay: settings.seconds_per_day, daysPerRation: DAYS_PER_RATION, maxCaravan: MAX_CARAVAN,
    };
  },

  'GET leaderboard': async ({ db }) => {
    const levels = await getLevels(db);
    const { results: traders } = await db.prepare(`SELECT p.id, p.name, p.money, p.level, p.status, c.name AS caravan
      FROM players p LEFT JOIN caravans c ON c.id = p.caravan_id ORDER BY p.money DESC, p.name LIMIT 200`).all();
    const { results: caravans } = await db.prepare(`SELECT c.id, c.name, COUNT(p.id) AS members,
      AVG(p.money) AS average, SUM(p.money) AS total FROM caravans c JOIN players p ON p.caravan_id = c.id
      GROUP BY c.id ORDER BY average DESC, c.name`).all();
    const { results: lv } = await db.prepare('SELECT level, status, COUNT(*) AS n FROM players GROUP BY level, status').all();
    return {
      traders: traders.map((t) => ({ ...t, money: r2(t.money) })),
      caravans: caravans.map((c) => ({ ...c, average: r2(c.average), total: r2(c.total) })),
      levels: levels.map((l, i) => ({ number: i + 1, name: l.name })),
      levelCounts: lv,
      updated: new Date().toISOString(),
    };
  },

  'GET caravans': async ({ db }) => {
    const { results } = await db.prepare(`SELECT c.id, c.name, COUNT(p.id) AS members FROM caravans c
      LEFT JOIN players p ON p.caravan_id = c.id GROUP BY c.id ORDER BY c.name`).all();
    return { caravans: results, max: MAX_CARAVAN };
  },

  // ---- player accounts ----
  'POST register': async ({ db, body }) => {
    const name = cleanStr(body.name, 24), pw = String(body.password || '');
    if (name.length < 2) fail('Trader names need at least 2 characters.');
    if (!/^[\p{L}\p{N} _'.-]+$/u.test(name)) fail('Use letters, numbers, spaces, - _ . or \u2019 in your trader name.');
    if (pw.length < 4) fail('Passwords need at least 4 characters.');
    const exists = await db.prepare('SELECT id FROM players WHERE name = ? COLLATE NOCASE').bind(name).first();
    if (exists) fail('That trader name is taken. Pick another.');
    const settings = await getSettings(db);
    const levels = await getLevels(db);
    const res = await db.prepare(`INSERT INTO players (name, pass_hash, money, inventory, level, status, city, day, haggles)
      VALUES (?, ?, ?, '{}', 1, 'locked', ?, 0, '{}')`).bind(name, await hashPassword(pw), r2(settings.starting_money), levels[0].start_city).run();
    const id = res.meta.last_row_id;
    const p = await loadPlayer(db, id);
    await addLog(db, p, `${name} joined the trading guild with ${money(settings.starting_money)}.`);
    return { token: await startSession(db, 'player', id), me: await publicState(db, p) };
  },

  'POST login': async ({ db, body }) => {
    const name = cleanStr(body.name, 24);
    const row = await db.prepare('SELECT id, pass_hash FROM players WHERE name = ? COLLATE NOCASE').bind(name).first();
    if (!row || !(await verifyPassword(String(body.password || ''), row.pass_hash))) fail('That trader name and password don\u2019t match.', 401);
    return { token: await startSession(db, 'player', row.id), me: await publicState(db, await loadPlayer(db, row.id)) };
  },

  'POST logout': async ({ db, req }) => {
    const s = await session(req, db);
    if (s) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(s.token).run();
    return { ok: true };
  },

  'GET me': async ({ db, req }) => ({ me: await publicState(db, await requirePlayer(req, db)) }),

  // ---- levels ----
  'POST level/unlock': async ({ db, req, body }) => {
    const p = await requirePlayer(req, db);
    const levels = await getLevels(db);
    let target;
    if (p.status === 'locked') target = p.level;
    else if (p.status === 'complete') target = p.level + 1;
    else fail('There is nothing to unlock right now.');
    const L = levels[target - 1];
    if (!L) fail('There are no more levels.');
    if (cleanStr(body.code, 60).toLowerCase() !== String(L.password).trim().toLowerCase()) fail('That code doesn\u2019t open this level. Check with your teacher.');
    p.level = target; p.status = 'title'; p.travel = null;
    await savePlayer(db, p);
    await addLog(db, p, `Unlocked Level ${target}: ${L.name}.`);
    return { me: await publicState(db, p) };
  },

  'POST level/begin': async ({ db, req }) => {
    const p = await requirePlayer(req, db);
    if (p.status !== 'title') fail('Unlock the level first.');
    const L = (await getLevels(db))[p.level - 1];
    p.money = r2(p.money + (Number(L.start_bonus) || 0));
    p.city = L.start_city; p.day = 0; p.travel = null; p.haggles = {};
    p.snapshot = { money: p.money, inventory: { ...p.inventory } };
    p.status = 'playing';
    await savePlayer(db, p);
    await addLog(db, p, `Began Level ${p.level} in ${CITIES[p.city].name}${L.start_bonus ? ` with a ${money(L.start_bonus)} starting bonus` : ''}.`);
    return { me: await publicState(db, p) };
  },

  'POST level/end': async ({ db, req }) => {
    const p = await requirePlayer(req, db);
    needInCity(p);
    const summary = await endLevel(db, p, await getLevels(db), true);
    return { me: await publicState(db, p), summary };
  },

  'POST level/restart': async ({ db, req }) => {
    const p = await requirePlayer(req, db);
    if (p.status !== 'perished') fail('You can only restart after perishing.');
    const L = (await getLevels(db))[p.level - 1];
    const snap = p.snapshot || { money: p.money, inventory: {} };
    p.money = snap.money; p.inventory = { ...snap.inventory };
    p.city = L.start_city; p.day = 0; p.travel = null; p.haggles = {}; p.status = 'playing';
    await savePlayer(db, p);
    await addLog(db, p, `Restarted Level ${p.level} in ${CITIES[p.city].name} with ${money(p.money)}.`);
    return { me: await publicState(db, p) };
  },

  // ---- market ----
  'POST market/haggle': async ({ db, req, body }) => {
    const p = await requirePlayer(req, db);
    needInCity(p);
    const side = body.side === 'sell' ? 'sell' : 'buy', item = String(body.item || '');
    if (!ITEMS[item]) fail('Unknown item.');
    const markets = await getMarkets(db);
    priceFor(markets, p, side, item); // validates the shop exists
    const key = `${side}:${item}`;
    if (p.haggles[key]) fail('You already haggled with this shop. Come back on your next visit.');
    const good = randInt(2) === 0;
    p.haggles[key] = side === 'buy' ? (good ? 0.95 : 1.05) : (good ? 1.05 : 0.95);
    await savePlayer(db, p);
    const shop = ITEMS[item].shop;
    const message = side === 'buy'
      ? (good ? `The ${shop} gives you 5% off.` : `The ${shop} is offended and raises the price 5%.`)
      : (good ? `The ${shop} agrees to pay 5% more.` : `The ${shop} drives a hard bargain and pays 5% less.`);
    return { me: await publicState(db, p), good, message, price: priceFor(markets, p, side, item) };
  },

  'POST market/buy': async ({ db, req, body }) => {
    const p = await requirePlayer(req, db);
    needInCity(p);
    const item = String(body.item || ''), qty = intIn(body.qty, 1, 100000);
    if (!ITEMS[item]) fail('Unknown item.');
    if (!qty) fail('Choose how many to buy.');
    const price = priceFor(await getMarkets(db), p, 'buy', item);
    const cost = r2(price * qty);
    if (cost > p.money + 1e-9) fail(`That costs ${money(cost)} but you only have ${money(p.money)}. Traders can\u2019t go into debt.`);
    p.money = r2(p.money - cost);
    p.inventory[item] = (p.inventory[item] || 0) + qty;
    await savePlayer(db, p);
    await addLog(db, p, `Bought ${qtyStr(item, qty)} in ${CITIES[p.city].name} for ${money(cost)}.`);
    return { me: await publicState(db, p), message: `Bought ${qtyStr(item, qty)} for ${money(cost)}.` };
  },

  'POST market/sell': async ({ db, req, body }) => {
    const p = await requirePlayer(req, db);
    needInCity(p);
    const item = String(body.item || ''), qty = intIn(body.qty, 1, 100000);
    if (!ITEMS[item]) fail('Unknown item.');
    if (!qty) fail('Choose how many to sell.');
    if ((p.inventory[item] || 0) < qty) fail(`You only have ${p.inventory[item] || 0} ${ITEMS[item].unit} of ${ITEMS[item].name}.`);
    const price = priceFor(await getMarkets(db), p, 'sell', item);
    const earned = r2(price * qty);
    p.money = r2(p.money + earned);
    p.inventory[item] -= qty;
    await savePlayer(db, p);
    await addLog(db, p, `Sold ${qtyStr(item, qty)} in ${CITIES[p.city].name} for ${money(earned)}.`);
    return { me: await publicState(db, p), message: `Sold ${qtyStr(item, qty)} for ${money(earned)}.` };
  },

  // ---- travel ----
  'POST travel/start': async ({ db, req, body }) => {
    const p = await requirePlayer(req, db);
    needInCity(p);
    const to = String(body.to || '');
    const r = route(p.city, to);
    if (!CITIES[to] || !r) fail('Pick a city to travel to.');
    const L = (await getLevels(db))[p.level - 1];
    const left = L.days - p.day;
    if (r.days > left) fail(`That trip takes ${r.days} days but only ${left} days are left in this level.`);
    const enc = pickEncounter();
    p.travel = { from: p.city, to, days: r.days, extraDays: 0, encounter: enc, faces: winningFaces(ENCOUNTERS[enc].wins), resolved: !ENCOUNTERS[enc].roll, outcome: null };
    if (enc === 'basecamp') p.travel.outcome = { success: true, text: 'You stop at a busy base camp to rest your camels, then continue on your trip.' };
    p.haggles = {};
    await savePlayer(db, p);
    await addLog(db, p, `Left ${CITIES[p.city].name} for ${CITIES[to].name} (${r.days} days) carrying ${p.inventory.food || 0} food and ${p.inventory.water || 0} water.`);
    return { me: await publicState(db, p) };
  },

  'POST travel/roll': async ({ db, req, body }) => {
    const p = await requirePlayer(req, db);
    needPlaying(p);
    const t = p.travel;
    if (!t) fail('You are not traveling.');
    if (t.resolved) fail('This encounter is already over.');
    const roll = intIn(body.roll, 1, 6);
    if (!roll) fail('Enter the number you rolled, 1 to 6.');
    const settings = await getSettings(db);
    const win = t.faces.includes(roll);
    const o = { roll, success: win, perish: false };
    switch (t.encounter) {
      case 'bandits':
        if (win) o.text = 'Your guards fight off the bandits. Nothing is stolen.';
        else { o.lost = loseShare(p, 0.25, settings.loss_scope); o.text = `The bandits escape into the night with ${lostText(o.lost)}.`; }
        break;
      case 'sandstorm':
        if (win) o.text = 'You find shelter behind the rocks and hold on to everything.';
        else { o.lost = loseShare(p, 0.20, settings.loss_scope); t.extraDays = 2; o.text = `The storm buries ${lostText(o.lost)} and adds 2 days to your trip.`; }
        break;
      case 'heat':
        if (win) o.text = 'You ration carefully and have enough water to stay hydrated.';
        else { o.lost = p.inventory.water ? { water: p.inventory.water } : {}; p.inventory.water = 0; o.perish = true; o.text = 'The sun boils away all of your water. You collapse in the heat.'; }
        break;
      case 'cold':
        if (win) o.text = 'You build a fire and stay warm through the freezing night.';
        else { o.perish = true; o.text = 'Your fire goes out and you freeze overnight.'; }
        break;
      case 'oasis':
        p.inventory.food = (p.inventory.food || 0) + roll;
        p.inventory.water = (p.inventory.water || 0) + roll;
        o.gained = { food: roll, water: roll };
        o.text = `You rest in the shade and gather ${roll} lb of food and ${roll} jugs of water.`;
        break;
    }
    t.resolved = true; t.outcome = o;
    if (o.perish) {
      p.status = 'perished';
      p.day = Math.min(p.day + Math.floor(t.days / 2), 99999);
      await addLog(db, p, `${ENCOUNTERS[t.encounter].name}: rolled ${roll}. ${o.text} You perished.`);
      p.travel = null;
    } else {
      await addLog(db, p, `${ENCOUNTERS[t.encounter].name}: rolled ${roll}. ${o.text}`);
    }
    await savePlayer(db, p);
    return { me: await publicState(db, p), outcome: o };
  },

  'POST travel/arrive': async ({ db, req }) => {
    const p = await requirePlayer(req, db);
    needPlaying(p);
    const t = p.travel;
    if (!t) fail('You are not traveling.');
    if (!t.resolved) fail('Finish the encounter first.');
    const levels = await getLevels(db);
    const L = levels[p.level - 1];
    const total = t.days + (t.extraDays || 0);
    const need = rations(total);
    const food = p.inventory.food || 0, water = p.inventory.water || 0;
    if (food < need || water < need) {
      const lastDay = Math.min(food, water) * DAYS_PER_RATION;
      const ranOut = food < need && water < need ? 'food and water' : food < need ? 'food' : 'water';
      p.inventory.food = Math.max(0, food - need); p.inventory.water = Math.max(0, water - need);
      p.day = Math.min(L.days, p.day + lastDay);
      p.status = 'perished'; p.travel = null;
      await savePlayer(db, p);
      await addLog(db, p, `Ran out of ${ranOut} ${lastDay} days into the trip to ${CITIES[t.to].name} and perished. The trip needed ${need} food and ${need} water.`);
      return { me: await publicState(db, p), perished: { ranOut, day: lastDay, need } };
    }
    p.inventory.food = food - need; p.inventory.water = water - need;
    p.day = Math.min(L.days, p.day + total);
    p.city = t.to; p.travel = null; p.haggles = {};
    await savePlayer(db, p);
    await addLog(db, p, `Arrived in ${CITIES[p.city].name} on day ${p.day}, using ${need} food and ${need} water.`);
    let summary = null;
    if (p.day >= L.days) summary = await endLevel(db, p, levels, false);
    return { me: await publicState(db, p), used: need, summary };
  },

  // ---- caravans ----
  'POST caravan/create': async ({ db, req, body }) => {
    const p = await requirePlayer(req, db);
    if (p.caravan_id) fail('Leave your current caravan first.');
    const name = cleanStr(body.name, 30), pw = String(body.password || '');
    if (name.length < 2) fail('Caravan names need at least 2 characters.');
    if (pw.length < 3) fail('Caravan passwords need at least 3 characters.');
    if (await db.prepare('SELECT id FROM caravans WHERE name = ? COLLATE NOCASE').bind(name).first()) fail('A caravan with that name already exists.');
    const res = await db.prepare('INSERT INTO caravans (name, pass_hash, created_by) VALUES (?, ?, ?)').bind(name, await hashPassword(pw), p.id).run();
    p.caravan_id = res.meta.last_row_id;
    await savePlayer(db, p);
    await addLog(db, p, `Founded the caravan \u201c${name}.\u201d`);
    return { me: await publicState(db, p) };
  },

  'POST caravan/join': async ({ db, req, body }) => {
    const p = await requirePlayer(req, db);
    if (p.caravan_id) fail('Leave your current caravan first.');
    const c = await db.prepare('SELECT * FROM caravans WHERE id = ?').bind(intIn(body.id, 1, 1e9) || 0).first();
    if (!c) fail('Pick a caravan to join.');
    if (!(await verifyPassword(String(body.password || ''), c.pass_hash))) fail('Wrong caravan password.');
    const { n } = await db.prepare('SELECT COUNT(*) AS n FROM players WHERE caravan_id = ?').bind(c.id).first();
    if (n >= MAX_CARAVAN) fail(`${c.name} is full (${MAX_CARAVAN} traders max).`);
    p.caravan_id = c.id;
    await savePlayer(db, p);
    await addLog(db, p, `Joined the caravan \u201c${c.name}.\u201d`);
    return { me: await publicState(db, p) };
  },

  'POST caravan/leave': async ({ db, req }) => {
    const p = await requirePlayer(req, db);
    if (!p.caravan_id) fail('You are not in a caravan.');
    const cid = p.caravan_id;
    p.caravan_id = null;
    await savePlayer(db, p);
    const { n } = await db.prepare('SELECT COUNT(*) AS n FROM players WHERE caravan_id = ?').bind(cid).first();
    if (n === 0) await db.prepare('DELETE FROM caravans WHERE id = ?').bind(cid).run();
    await addLog(db, p, 'Left the caravan.');
    return { me: await publicState(db, p) };
  },

  // ---- teacher ----
  'POST teacher/login': async ({ db, body, env }) => {
    if (!env.TEACHER_PASSWORD) fail('No teacher password is set. Add a TEACHER_PASSWORD secret in Cloudflare (see README).', 500);
    if (!safeEqual(String(body.password || ''), env.TEACHER_PASSWORD)) fail('Wrong teacher password.', 401);
    await db.prepare("DELETE FROM sessions WHERE role = 'teacher' AND created_at < datetime('now', '-1 day')").run();
    return { token: await startSession(db, 'teacher', null) };
  },

  'GET teacher/state': async ({ db, req }) => {
    await requireTeacher(req, db);
    const [levels, markets, settings] = await Promise.all([getLevels(db), getMarkets(db), getSettings(db)]);
    const { results: players } = await db.prepare(`SELECT p.id, p.name, p.money, p.level, p.status, p.city, p.day, p.inventory,
      p.caravan_id, c.name AS caravan FROM players p LEFT JOIN caravans c ON c.id = p.caravan_id ORDER BY p.name`).all();
    const { results: caravans } = await db.prepare(`SELECT c.id, c.name, COUNT(p.id) AS members, AVG(p.money) AS average
      FROM caravans c LEFT JOIN players p ON p.caravan_id = c.id GROUP BY c.id ORDER BY c.name`).all();
    return {
      levels, markets, settings, cities: CITIES, cityOrder: CITY_ORDER, items: ITEMS,
      players: players.map((x) => ({ ...x, inventory: JSON.parse(x.inventory || '{}') })),
      caravans: caravans.map((c) => ({ ...c, average: r2(c.average || 0) })),
    };
  },

  'POST teacher/levels': async ({ db, req, body }) => {
    await requireTeacher(req, db);
    const list = Array.isArray(body.levels) ? body.levels : [];
    if (list.length !== DEFAULT_LEVELS.length) fail('Send all five levels.');
    const clean = list.map((l, i) => {
      const days = intIn(l.days, 1, 10000);
      if (!days) fail(`Level ${i + 1}: days must be a whole number from 1 to 10000.`);
      if (!CITIES[l.start_city]) fail(`Level ${i + 1}: pick a starting city.`);
      const pw = cleanStr(l.password, 60);
      if (!pw) fail(`Level ${i + 1}: needs a level code.`);
      return {
        name: cleanStr(l.name, 60) || DEFAULT_LEVELS[i].name, days, start_city: l.start_city, password: pw,
        start_bonus: numIn(l.start_bonus, 0, 1e7) ?? 0, early_bonus: numIn(l.early_bonus, 0, 1e5) ?? 0,
        instructions: cleanStr(l.instructions, 2000),
      };
    });
    await setSetting(db, 'levels', clean);
    return { levels: clean };
  },

  'POST teacher/settings': async ({ db, req, body }) => {
    await requireTeacher(req, db);
    const s = {
      starting_money: numIn(body.starting_money, 0, 1e7) ?? DEFAULT_SETTINGS.starting_money,
      seconds_per_day: numIn(body.seconds_per_day, 0.05, 5) ?? DEFAULT_SETTINGS.seconds_per_day,
      loss_scope: body.loss_scope === 'all' ? 'all' : 'supplies',
    };
    await setSetting(db, 'game', s);
    return { settings: s };
  },

  'POST teacher/markets': async ({ db, req, body }) => {
    await requireTeacher(req, db);
    const m = body.markets || {};
    const out = {};
    for (const c of CITY_ORDER) {
      const s = m[c] || {};
      const fix = (v, d) => numIn(v, 0, 1e6) ?? d;
      out[c] = {
        food: fix(s.food, DEFAULT_MARKETS[c].food), water: fix(s.water, DEFAULT_MARKETS[c].water),
        imports: DEFAULT_MARKETS[c].imports.map(([item, p]) => ({ item, price: fix((s.imports || []).find((x) => x.item === item)?.price, p) })),
        exports: DEFAULT_MARKETS[c].exports.map(([item, p]) => ({ item, price: fix((s.exports || []).find((x) => x.item === item)?.price, p) })),
      };
    }
    await setSetting(db, 'markets', out);
    return { markets: out };
  },

  'POST teacher/bonus': async ({ db, req, body }) => {
    await requireTeacher(req, db);
    const amount = numIn(body.money || 0, -1e7, 1e7) ?? 0;
    const item = body.item && ITEMS[body.item] ? body.item : null;
    const qty = item ? intIn(body.qty, 1, 100000) : null;
    if (item && !qty) fail('Enter how many of the item to give.');
    if (!amount && !item) fail('Enter money and/or an item to give.');
    let ids = [];
    if (body.target === 'all') ids = (await db.prepare('SELECT id FROM players').all()).results.map((r) => r.id);
    else if (body.target === 'caravan') ids = (await db.prepare('SELECT id FROM players WHERE caravan_id = ?').bind(intIn(body.id, 1, 1e9) || 0).all()).results.map((r) => r.id);
    else if (body.target === 'player') ids = [intIn(body.id, 1, 1e9) || 0];
    const reason = cleanStr(body.reason, 120);
    let count = 0;
    for (const id of ids) {
      const p = await loadPlayer(db, id);
      if (!p) continue;
      p.money = Math.max(0, r2(p.money + amount));
      if (item) p.inventory[item] = (p.inventory[item] || 0) + qty;
      if (p.snapshot) { // keep the bonus even if they perish and restart
        p.snapshot.money = Math.max(0, r2(p.snapshot.money + amount));
        if (item) p.snapshot.inventory[item] = (p.snapshot.inventory[item] || 0) + qty;
      }
      await savePlayer(db, p);
      const parts = [amount ? money(amount) : null, item ? qtyStr(item, qty) : null].filter(Boolean).join(' and ');
      await addLog(db, p, `Teacher bonus: ${parts}${reason ? ` (${reason})` : ''}.`);
      count++;
    }
    if (!count) fail('No traders matched that choice.');
    return { count };
  },

  'POST teacher/player': async ({ db, req, body }) => {
    await requireTeacher(req, db);
    const p = await loadPlayer(db, intIn(body.id, 1, 1e9) || 0);
    if (!p) fail('Trader not found.');
    const levels = await getLevels(db);
    switch (body.action) {
      case 'set_level': {
        const lv = intIn(body.level, 1, levels.length);
        if (!lv) fail('Pick a level.');
        p.level = lv; p.status = 'title'; p.travel = null; p.haggles = {}; p.day = 0; p.city = levels[lv - 1].start_city;
        await savePlayer(db, p);
        await addLog(db, p, `Teacher moved you to Level ${lv}.`);
        break;
      }
      case 'reset_password': {
        const pw = String(body.password || '');
        if (pw.length < 4) fail('New password needs at least 4 characters.');
        await db.prepare('UPDATE players SET pass_hash = ? WHERE id = ?').bind(await hashPassword(pw), p.id).run();
        await db.prepare("DELETE FROM sessions WHERE player_id = ? AND role = 'player'").bind(p.id).run();
        break;
      }
      case 'kick':
        p.caravan_id = null; await savePlayer(db, p); break;
      case 'delete':
        await db.batch([
          db.prepare('DELETE FROM logs WHERE player_id = ?').bind(p.id),
          db.prepare('DELETE FROM sessions WHERE player_id = ?').bind(p.id),
          db.prepare('DELETE FROM players WHERE id = ?').bind(p.id),
        ]);
        await db.prepare('DELETE FROM caravans WHERE id NOT IN (SELECT caravan_id FROM players WHERE caravan_id IS NOT NULL)').run();
        break;
      default: fail('Unknown action.');
    }
    return { ok: true };
  },

  'POST teacher/caravan/delete': async ({ db, req, body }) => {
    await requireTeacher(req, db);
    const id = intIn(body.id, 1, 1e9) || 0;
    await db.batch([
      db.prepare('UPDATE players SET caravan_id = NULL WHERE caravan_id = ?').bind(id),
      db.prepare('DELETE FROM caravans WHERE id = ?').bind(id),
    ]);
    return { ok: true };
  },

  'POST teacher/reset': async ({ db, req, body }) => {
    await requireTeacher(req, db);
    if (body.confirm !== 'RESET') fail('Type RESET to confirm.');
    await db.batch([
      db.prepare('DELETE FROM logs'), db.prepare('DELETE FROM players'),
      db.prepare('DELETE FROM caravans'), db.prepare("DELETE FROM sessions WHERE role = 'player'"),
    ]);
    return { ok: true };
  },
};

export async function handle(request, env, pathParts) {
  try {
    if (!env.DB) fail('Database not connected. Add a D1 binding named DB (see README).', 500);
    const path = (pathParts || []).join('/');
    const fn = routes[`${request.method} ${path}`];
    if (!fn) fail('Not found', 404);
    let body = {};
    if (request.method === 'POST') { try { body = await request.json(); } catch { body = {}; } }
    return json(await fn({ db: env.DB, req: request, body: body || {}, env }));
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Something went wrong on the server: ' + (e.message || e) }, 500);
  }
}
