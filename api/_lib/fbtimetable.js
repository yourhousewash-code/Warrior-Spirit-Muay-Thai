/* The timetable and opening hours from FighterBase, once the site has switched over (api/_lib/switchover.js).
   FighterBase is master (Steve, 17 Nov 2026: "I want fighter base being in control of everything"): Jay edits classes in
   FighterBase and the site shows them. Feed: FighterBase's public timetable JSON for the club (`SWITCHOVER.timetable`,
   the club's calendar feed address with .json; the club owner switches publishing on, with kids classes and coaches'
   names, on the Classes page). Shape (FighterBase supabase/functions/cal clubJson, 17 Nov 2026):
     { club, timezone, generated, rotation, classes: [{ day, dow (0 = Monday), time, mins, title, level, sport, coach, kids, places, weeks }], hours }
   Cached for 15 minutes; if FighterBase can't be reached the last good copy is used; if there has never been one, the
   site's own timetable is shown. Off before the switch: nothing here runs. */
import { redis, COACHES } from './core.js';
import { SWITCHOVER, switchedOn } from './switchover.js';

export const CACHE_KEY = 'fb:timetable';
const FRESH_MS = 15 * 60e3;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const addMins = (t, m) => { const x = Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) + m; return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
const coachId = name => { const n = String(name || '').trim().toLowerCase(); return n ? Object.keys(COACHES).find(k => COACHES[k].first?.toLowerCase() === n || COACHES[k].name?.toLowerCase() === n) || '' : ''; };

/* FighterBase's classes in the site's own shape: { id, day (0 = Sunday), start, end, name, coach, coachName, max, kids, fb }. */
export function mapClasses(j) {
  if (!j || !Array.isArray(j.classes)) return null;
  return j.classes.filter(k => k && HHMM.test(String(k.time)) && Number(k.dow) >= 0 && Number(k.dow) <= 6 && k.title).map(k => {
    const mins = Math.min(600, Math.max(5, Number(k.mins) || 60)), weeks = k.weeks ? String(k.weeks).slice(0, 4) : '';
    return {
      id: `fb-${k.dow}-${k.time.replace(':', '')}-${slug(k.title)}${weeks ? '-' + slug(weeks) : ''}`,
      day: (Number(k.dow) + 1) % 7, start: k.time, end: addMins(k.time, mins),
      name: String(k.title).slice(0, 60) + (weeks ? ` (week ${weeks})` : ''),
      coach: coachId(k.coach), coachName: k.coach ? String(k.coach).slice(0, 40) : '',
      max: Number(k.places) > 0 ? Number(k.places) : 0, kids: !!k.kids, fb: true,
    };
  });
}

/* Opening hours in the site's shape ([{ day, open, close, closed?, note? }] x 7), or null if the feed's shape isn't one we
   know (the site's own hours are then shown). Accepts a list of days or an object keyed by day name. */
export function mapHours(h) {
  if (!h || typeof h !== 'object') return null;
  const byDay = {};
  const take = (day, v) => {
    if (day < 0 || day > 6 || byDay[day]) return;
    if (v === null || v === false || v?.closed === true || v === 'closed') { byDay[day] = { day, closed: true }; return; }
    let open = v?.open ?? v?.from, close = v?.close ?? v?.to;
    if (typeof v === 'string') [open, close] = v.split(/\s*[-–]\s*/);
    if (HHMM.test(String(open)) && HHMM.test(String(close))) byDay[day] = { day, open, close, ...(v?.note ? { note: String(v.note).slice(0, 60) } : {}) };
  };
  if (Array.isArray(h)) h.forEach((v, i) => take(v && Number.isInteger(v.dow) ? (v.dow + 1) % 7 : v && Number.isInteger(v.day) ? v.day : (i + 1) % 7, v));
  else for (const [k, v] of Object.entries(h)) { const d = DAYS.indexOf(k.toLowerCase()); if (d >= 0) take(d, v); }
  return Object.keys(byDay).length === 7 ? [1, 2, 3, 4, 5, 6, 0].map(d => byDay[d]) : null;
}

export async function fbFeed() {
  if (!switchedOn() || !SWITCHOVER.timetable) return null;
  let cached = null;
  try { cached = await redis.get(CACHE_KEY); } catch {}
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.data;
  try {
    const r = await fetch(SWITCHOVER.timetable, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`FighterBase timetable answered ${r.status}`);
    const j = await r.json(), classes = mapClasses(j);
    if (!classes) throw new Error('FighterBase timetable: no classes list');
    const data = { classes, hours: mapHours(j.hours) };
    await redis.set(CACHE_KEY, { at: Date.now(), data });
    return data;
  } catch (e) {
    console.error('fighterbase timetable', e?.message);
    return cached ? cached.data : null;
  }
}
export async function fbClasses() { const d = await fbFeed(); return d ? d.classes : null; }
export async function fbHours() { const d = await fbFeed(); return d ? d.hours : null; }
