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
/* Recommended starting hours for every coach until they change them: weekdays 6–10pm, Saturday 8am–12pm. */
export const DEFAULT_WEEKLY = [1, 2, 3, 4, 5].map(day => ({ day, start: '18:00', end: '22:00', mins: 60 }))
  .concat([{ day: 6, start: '08:00', end: '12:00', mins: 60 }]);
export async function getWeekly(c) { const w = await redis.get(`coach:${c}:weekly`); return Array.isArray(w) ? w : DEFAULT_WEEKLY.map(r => ({ ...r })); }

/* Class timetable (matches the website). Jay teaches by default; Aaron takes Thursday beginners and Friday sparring. */
export const DEFAULT_CLASSES = [
  { id: 'mon-kids', day: 1, start: '17:30', end: '18:20', name: 'Kids Muay Thai', coach: 'jay' },
  { id: 'mon-drills', day: 1, start: '18:30', end: '19:30', name: 'Drills & sparring', coach: 'jay' },
  { id: 'tue-kids', day: 2, start: '17:30', end: '18:20', name: 'Kids Muay Thai', coach: 'jay' },
  { id: 'tue-pads1', day: 2, start: '18:00', end: '19:00', name: 'Pads', coach: 'jay' },
  { id: 'tue-pads2', day: 2, start: '19:00', end: '20:00', name: 'Pads', coach: 'jay' },
  { id: 'wed-kids', day: 3, start: '17:30', end: '18:20', name: 'Kids Muay Thai', coach: 'jay' },
  { id: 'wed-drills', day: 3, start: '18:30', end: '19:30', name: 'Drills & sparring', coach: 'jay' },
  { id: 'thu-kids', day: 4, start: '17:30', end: '18:20', name: 'Kids Muay Thai', coach: 'jay' },
  { id: 'thu-pads', day: 4, start: '18:00', end: '19:00', name: 'Pads', coach: 'jay' },
  { id: 'thu-beg', day: 4, start: '19:00', end: '20:00', name: 'Beginners', coach: 'aaron' },
  { id: 'fri-spar', day: 5, start: '18:00', end: '19:00', name: 'Sparring', coach: 'aaron' },
];
export async function getClasses() { const c = await redis.get('classes'); return Array.isArray(c) ? c : DEFAULT_CLASSES.map(x => ({ ...x })); }
export async function getCover() { const c = await redis.get('classcover'); return c && typeof c === 'object' && !Array.isArray(c) ? c : {}; }
/* Every class happening between two times, with one-off cover applied ('none' = cancelled that date). */
export async function classInstances(from, to, classes, cover) {
  classes = classes || await getClasses(); cover = cover || await getCover();
  const out = [];
  for (let date = londonDate(from), end = londonDate(to); date <= end; date = addDays(date, 1)) {
    const wd = dow(date);
    for (const k of classes) {
      if (k.day !== wd) continue;
      const start = londonMs(date, k.start), stop = londonMs(date, k.end);
      if (start < from - DAY || start > to) continue;
      const ov = cover[`${k.id}|${date}`];
      out.push({ id: `c:${k.id}:${date}`, classId: k.id, date, name: k.name, start, mins: Math.round((stop - start) / 6e4),
        coach: ov && ov !== 'none' ? ov : k.coach, usual: k.coach, cover: !!ov && ov !== 'none', cancelled: ov === 'none' });
    }
  }
  return out;
}
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
export async function generated(c, from, to, real, classes) {
  const [weekly, off, skip] = await Promise.all([getWeekly(c), getOff(c), getSkip(c)]);
  const open = [], blocked = [];
  if (!weekly.length) return { open, blocked, off };
  /* A coach is never free while teaching. Other coaches' classes also block PT, unless the coach has said
     they're happy to be available during classes for that block of hours (overClass). */
  const ks = (classes || await classInstances(from - DAY, to + DAY)).filter(k => !k.cancelled);
  const busy = (real || await realSlots(c, from - DAY, to + DAY)).filter(s => s.coach === c && s.status !== 'cancelled')
    .concat(ks.filter(k => k.coach === c));
  const busyAll = busy.concat(ks.filter(k => k.coach !== c));
  for (let date = londonDate(from), end = londonDate(to); date <= end; date = addDays(date, 1)) {
    if (isOff(off, date)) continue;
    const wd = dow(date);
    for (const r of weekly) {
      if (r.day !== wd) continue;
      const step = Number(r.mins) || 60;
      const stop = londonMs(date, r.end);
      let t = londonMs(date, r.start);
      while (t + 30 * 6e4 <= stop) {
        const mins = Math.min(step, Math.round((stop - t) / 6e4));
        const hit = (r.overClass ? busy : busyAll).filter(x => overlaps(x, { start: t, mins }));
        if (hit.length) { const e = Math.max(...hit.map(x => x.start + x.mins * 6e4)); t = Math.ceil(e / 9e5) * 9e5; continue; }
        if (t >= from && t <= to) {
          const s = { id: `w:${c}:${t}:${mins}`, coach: c, start: t, mins, source: 'weekly', status: 'open' };
          if (skip.has(String(t))) blocked.push({ ...s, status: 'blocked' }); else open.push(s);
        }
        t += mins * 6e4;
      }
    }
  }
  return { open, blocked, off };
}
export function parseVirtual(id) {
  const m = /^w:([a-z]+):(\d+):(\d+)$/.exec(id || '');
  return m ? { coach: m[1], start: Number(m[2]), mins: Number(m[3]) } : null;
}

/* Free stretches of time for a coach: their open weekly blocks and one-off times, joined up where they touch. */
export async function freeIntervals(c, from, to, real, classes) {
  real = real || await realSlots(c, from - DAY, to + DAY);
  const off = await getOff(c);
  const g = await generated(c, from, to, real, classes);
  const parts = g.open.concat(real.filter(s => s.coach === c && s.status === 'open' && s.start >= from && s.start <= to && !isOff(off, londonDate(s.start))))
    .map(s => ({ start: s.start, end: s.start + s.mins * 6e4 })).sort((a, b) => a.start - b.start);
  const out = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && p.start <= last.end) last.end = Math.max(last.end, p.end); else out.push({ ...p });
  }
  return out;
}
/* Start times (every 30 minutes) where a session of this length fits. */
export function startsIn(intervals, mins, from) {
  const out = [];
  for (const iv of intervals) for (let t = iv.start; t + mins * 6e4 <= iv.end; t += 30 * 6e4) if (t >= from) out.push(t);
  return out;
}
