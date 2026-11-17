/* The action log (Agent Rules 3f, order A-069; docs/RECOVERY.md): an add-only record of every lasting change the site's
   own code makes to the database: who did it (a coach, a member, a visitor or the daily job), through which part of the
   site, what was there before, what it became, when, and from which connection.
   How: core.js wraps the database client with logged(), so every write command (set, hset, hdel, del, zadd and the rest)
   is sent together with one log line, in a single trip to the database. Each API file is wrapped with withLog(), which
   remembers the request, so the log line knows who is acting.
   Kept: one list per month (`audit:YYYY-MM`), 400 days; the nightly copy takes it off-site with everything else.
   Never kept: passwords (even scrambled), two-step secrets and codes, sign-in and reset links, calendar feed links, the
   Google Drive key, and short-lived keys (rate limits, locks). Edits made directly in the Upstash console are not seen:
   the rule is no console edits to live data.
   Read it with: node tools/action-log.mjs (see the file for filters). Nothing in the code deletes from it. */
import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();
export const LOG_PREFIX = 'audit:';
export const KEEP_SECONDS = 400 * 86400;
const MAX_CHARS = 200000;

/* Keys that are short-lived or are themselves secrets: not logged at all. */
const SKIP = [/^audit:/, /^rl:/, /^booklock:/, /^classlock:/, /^slotlock:/, /^reset:/, /^verify:/, /^coach:reset:/, /^coach:[^:]+:2fa:/, /^gdrive:state:/, /^gdrive:sync$/, /^calfeed:/, /^fb:timetable$/];
/* Keys whose value is a secret: the change is logged, the value isn't. */
const HIDE_KEY = [/^coach:[^:]+:hash$/, /^coach:[^:]+:2fa$/, /^gdrive:refresh$/];
/* Fields inside a record whose value is a secret. */
const HIDE_FIELD = /^(hash|pw|password|secret|token|caltoken|code|refresh)$/i;
const WRITES = new Set(['set', 'hset', 'hdel', 'hincrby', 'del', 'zadd', 'zrem', 'sadd', 'srem', 'rpush', 'lpush', 'lrem', 'incr', 'getdel']);

export const skipKey = k => SKIP.some(re => re.test(k));
const hideKey = k => HIDE_KEY.some(re => re.test(k));

/* Who is acting: core.js registers how to read the coach and member sign-in from a request. */
let findActor = () => null;
export function setActorFinder(fn) { findActor = fn; }

/* Wraps an API file's handler so the log knows which request a change belongs to. */
export function withLog(api, handler) {
  return function logged(req, res) { return als.run({ api, req }, () => handler(req, res)); };
}

function hideValue(key, v) {
  if (v === null || v === undefined) return v;
  if (hideKey(key)) return '[hidden]';
  if (typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).map(([f, x]) => [f, HIDE_FIELD.test(f) && x ? '[hidden]' : x]));
  return v;
}
function fit(v) {
  try { const s = JSON.stringify(v); return s && s.length > MAX_CHARS ? `[too big to keep here: ${s.length} characters; see the nightly copy]` : v; } catch { return '[could not copy]'; }
}

/* What a key holds now, whatever its type. */
async function readAll(db, key) {
  const t = await db.type(key);
  if (t === 'none') return null;
  if (t === 'string') return db.get(key);
  if (t === 'hash') return db.hgetall(key);
  if (t === 'set') return db.smembers(key);
  if (t === 'zset') return db.zrange(key, 0, -1, { withScores: true });
  if (t === 'list') return db.lrange(key, 0, -1);
  return `[${t}]`;
}
/* The part of a record a command is about to change. */
async function readBefore(db, cmd, key, args) {
  if (cmd === 'set' || cmd === 'getdel') return db.get(key);
  if (cmd === 'hset') { const f = Object.keys(args[1] || {}); return f.length ? db.hmget(key, ...f) : null; }
  if (cmd === 'hdel') return args.length > 1 ? db.hmget(key, ...args.slice(1).map(String)) : null;
  if (cmd === 'hincrby') return db.hmget(key, String(args[1]));
  if (cmd === 'del') return readAll(db, key);
  return undefined; // index lists and sets (zadd, sadd...): the change itself says enough, and the record they point to is logged
}

export function actorOf(ctx) {
  if (!ctx) return { who: 'script', via: 'outside the website' };
  const { api, req } = ctx;
  let who = null;
  try { who = findActor(req); } catch {}
  if (!who) who = api === 'cron' ? 'system:daily job' : 'visitor';
  const via = `${api}:${String(req?.query?.action || req?.query?.run || req?.method || '').slice(0, 40)}`;
  const ip = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 64);
  return { who, via, ip };
}

const monthKey = (d = new Date()) => `${LOG_PREFIX}${d.toISOString().slice(0, 7)}`;

/* Sends one write command with its log line in a single pipeline. Returns what the command alone would return. */
async function write(db, cmd, args) {
  const keys = cmd === 'del' ? args.map(String) : [String(args[0])];
  const watched = keys.filter(k => !skipKey(k));
  if (!watched.length) return db[cmd](...args);
  const entries = [];
  for (const key of watched) {
    let before;
    try { before = await readBefore(db, cmd, key, args); } catch { before = '[could not read]'; }
    const after = cmd === 'del' ? null : cmd === 'set' ? args[1] : cmd === 'hset' ? args[1] : cmd === 'hdel' ? Object.fromEntries(args.slice(1).map(f => [String(f), null])) : args.slice(1);
    entries.push({ t: new Date().toISOString(), ...actorOf(als.getStore()), cmd, key, before: fit(hideValue(key, before)), after: fit(hideValue(key, after)) });
  }
  const p = db.pipeline(), month = monthKey();
  p[cmd](...args);
  for (const e of entries) p.rpush(month, e);
  p.expire(month, KEEP_SECONDS);
  const out = await p.exec({ keepErrors: true });
  if (out.slice(1).some(x => x.error)) console.error('action log: a line was not saved', out.slice(1).find(x => x.error).error);
  if (out[0].error) throw new Error(String(out[0].error));
  return out[0].result;
}

/* Wraps the database client: reads pass straight through; writes go with their log line. */
export function logged(db) {
  return new Proxy(db, {
    get(target, prop) {
      const v = target[prop];
      if (typeof v !== 'function') return v;
      if (typeof prop === 'string' && WRITES.has(prop)) return (...args) => write(target, prop, args);
      return v.bind(target);
    },
  });
}
