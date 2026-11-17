// Reads the action log (api/_lib/actionlog.js): who changed what, when, and what it was before.
// Read-only: it never changes the database. Putting a record back is a separate, reviewed step (docs/RECOVERY.md).
// Needs the database settings in the environment (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or the KV_ names).
//   node tools/action-log.mjs                       this month, newest last
//   node tools/action-log.mjs --month 2026-11 --who coach:kian --key booking: --since 2026-11-20
//   node tools/action-log.mjs --json                full lines, with before and after
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : ''; };
const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, '');
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
if (!url || !token) { console.error('Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN first.'); process.exit(1); }

const month = arg('month') || new Date().toISOString().slice(0, 7);
const r = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(['LRANGE', `audit:${month}`, '0', '-1']) });
if (!r.ok) { console.error(`The database answered ${r.status}.`); process.exit(1); }
const lines = ((await r.json()).result || []).map(x => { try { return JSON.parse(x); } catch { return { t: '?', raw: x }; } });
const who = arg('who'), key = arg('key'), since = arg('since');
const picked = lines.filter(e => (!who || String(e.who).startsWith(who)) && (!key || String(e.key).startsWith(key)) && (!since || String(e.t) >= since));
if (process.argv.includes('--json')) console.log(JSON.stringify(picked, null, 2));
else for (const e of picked) console.log(`${e.t}  ${e.who}  ${e.via}  ${e.cmd} ${e.key}${e.ip ? `  from ${e.ip}` : ''}`);
console.error(`${picked.length} of ${lines.length} lines in audit:${month}`);
