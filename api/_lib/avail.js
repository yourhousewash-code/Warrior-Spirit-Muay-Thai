/* Availability: weekly regular hours, holidays/days off, blocked times, and one-off slots.
   All dates and times are UK (Europe/London) local time. */
import { redis, TZ } from './core.js';

export const DAY = 864e5;
export const LENGTHS = [30, 45, 60, 75, 90];

function tzOffset(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
}
/* '2026-10-26', '18:00' -> epoch ms of that UK local time */
export function londonMs(date, time) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let ms = guess - tzOffset(guess);
  const o2 = tzOffset(ms);
  if (guess - o2 !== ms) ms = guess - o2;
  return ms;
}
export function londonDate(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function dow(date) { return new Date(date + 'T12:00:00Z').getUTCDay(); } // 0 = Sunday
export const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
export const validTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '');

/* ---------- stored settings ---------- */
export async function getWeekly(c) { const w = await redis.get(`coach:${c}:weekly`); return Array.isArray(w) ? w : []; }
export async function getOff(c) { const o = await redis.get(`coach:${c}:off`); return Array.isArray(o) ? o : []; }
export async function getSkip(c) { return new Set((await redis.smembers(`coach:${c}:skip`)).map(String)); }
export const isOff = (off, date) => off.find(o => o.from <= date && date <= o.to) || null;

export async function realSlots(c, from, to) {
  const ids = await redis.zrange(c === 'all' ? 'slots:all' : `slots:coach:${c}`, from, to, { byScore: true });
  const out = [];
  for (const i of ids) {
    const s = await redis.hgetall(`slot:${i}`);
    if (s) out.push({ ...s, start: Number(s.start), mins: Number(s.mins) });
  }
  return out;
}
const overlaps = (a, b) => a.start < b.start + b.mins * 6e4 && b.start < a.start + a.mins * 6e4;

/* Slots generated from a coach's weekly hours between two times.
   Returns { open: [...], blocked: [...] }, leaving out holidays and anything already covered by a real slot. */
export async function generated(c, from, to, real) {
  const [weekly, off, skip] = await Promise.all([getWeekly(c), getOff(c), getSkip(c)]);
  const open = [], blocked = [];
  if (!weekly.length) return { open, blocked, off };
  const taken = (real || await realSlots(c, from - DAY, to + DAY)).filter(s => s.coach === c && s.status !== 'cancelled');
  for (let date = londonDate(from), end = londonDate(to); date <= end; date = addDays(date, 1)) {
    if (isOff(off, date)) continue;
    const wd = dow(date);
    for (const r of weekly) {
      if (r.day !== wd) continue;
      const mins = Number(r.mins) || 60;
      const stop = londonMs(date, r.end);
      for (let t = londonMs(date, r.start); t + mins * 6e4 <= stop; t += mins * 6e4) {
        if (t < from || t > to) continue;
        const s = { id: `w:${c}:${t}:${mins}`, coach: c, start: t, mins, source: 'weekly', status: 'open' };
        if (taken.some(x => overlaps(x, s))) continue;
        if (skip.has(String(t))) blocked.push({ ...s, status: 'blocked' }); else open.push(s);
      }
    }
  }
  return { open, blocked, off };
}
export function parseVirtual(id) {
  const m = /^w:([a-z]+):(\d+):(\d+)$/.exec(id || '');
  return m ? { coach: m[1], start: Number(m[2]), mins: Number(m[3]) } : null;
}
