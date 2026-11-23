// Cloudflare Pages Function: GET /api/export?board=traders|caravans
// Teacher-only CSV download of the leaderboards. This file sits next to
// [[path]].js; Cloudflare sends /api/export here because a named route
// wins over the catch-all.
import { CITIES, ITEMS, SKILLS, DEFAULT_LEVELS } from '../../lib/data.js';

const STATUS = {
  locked: 'Needs level code', title: 'Unlocked, not started', playing: 'Playing',
  perished: 'Perished', failed: 'Missed challenge, must retry',
  complete: 'Level done, needs next code', finished: 'Finished all levels',
};

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const parse = (s) => { try { return JSON.parse(s || '{}') || {}; } catch { return {}; } };

// Quote every cell; a leading = + - @ is prefixed with ' so spreadsheet apps
// don't treat a student's trader name as a formula.
function cell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
const toCsv = (rows) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

function textResponse(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

async function isTeacher(request, db) {
  const h = request.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return false;
  const s = await db.prepare("SELECT created_at FROM sessions WHERE token = ? AND role = 'teacher'").bind(token).first();
  if (!s) return false;
  const age = Date.now() - new Date(String(s.created_at).replace(' ', 'T') + 'Z').getTime();
  return age <= 12 * 3600 * 1000; // same 12-hour limit as the rest of the teacher page
}

async function levelNames(db) {
  let levels = DEFAULT_LEVELS;
  try {
    const row = await db.prepare("SELECT value FROM settings WHERE key = 'levels'").first();
    if (row) levels = JSON.parse(row.value);
  } catch {}
  return levels.map((l) => l.name);
}

export async function onRequestGet({ request, env }) {
  const db = env.DB;
  if (!db) return textResponse('Database not connected.', 500);
  if (!(await isTeacher(request, db))) return textResponse('Teacher login required.', 401);

  const board = new URL(request.url).searchParams.get('board') === 'caravans' ? 'caravans' : 'traders';
  const date = new Date().toISOString().slice(0, 10);
  const { results: players } = await db.prepare(`SELECT p.*, c.name AS caravan_name FROM players p
    LEFT JOIN caravans c ON c.id = p.caravan_id ORDER BY p.money DESC, p.name COLLATE NOCASE`).all();

  let rows;
  if (board === 'traders') {
    const names = await levelNames(db);
    rows = [['Rank', 'Trader', 'Caravan', 'Level', 'Level name', 'Status', 'Bank ($)', 'City', 'Day',
      'Trader School classes', 'Goods carried']];
    players.forEach((p, i) => {
      const skills = Object.keys(parse(p.skills)).filter((k) => parse(p.skills)[k]).map((k) => SKILLS[k]?.name || k);
      const goods = Object.entries(parse(p.inventory)).filter(([, q]) => q > 0)
        .map(([k, q]) => `${q} ${ITEMS[k]?.unit || 'lb'} ${ITEMS[k]?.name || k}`);
      rows.push([i + 1, p.name, p.caravan_name || '', p.level, names[p.level - 1] || '', STATUS[p.status] || p.status,
        r2(p.money).toFixed(2), CITIES[p.city]?.name || '', p.status === 'playing' ? p.day : '',
        skills.join('; '), goods.join('; ')]);
    });
  } else {
    const { results: caravans } = await db.prepare('SELECT id, name FROM caravans').all();
    const list = caravans.map((c) => {
      const members = players.filter((p) => p.caravan_id === c.id);
      const total = members.reduce((a, m) => a + (Number(m.money) || 0), 0);
      return { name: c.name, members, total, average: members.length ? total / members.length : 0 };
    }).sort((a, b) => b.average - a.average || a.name.localeCompare(b.name));
    rows = [['Rank', 'Caravan', 'Traders', 'Average wealth ($)', 'Total wealth ($)', 'Members (richest first)']];
    list.forEach((c, i) => rows.push([i + 1, c.name, c.members.length, r2(c.average).toFixed(2), r2(c.total).toFixed(2),
      c.members.map((m) => `${m.name} ($${r2(m.money).toFixed(2)})`).join('; ')]));
  }

  return textResponse(toCsv(rows), 200, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="desert-trade-${board}-${date}.csv"`,
  });
}
