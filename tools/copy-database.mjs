// Copies the whole database from one Upstash database to another and checks both ends match (WS-011 step 1).
// Use: moving off the Vercel-made database into an SRS-owned one, or making a test copy for a restore drill.
// Run on a computer, never on the live site. The settings come from the environment, never the command line:
//   FROM_URL=... FROM_TOKEN=... TO_URL=... TO_TOKEN=... node tools/copy-database.mjs [--check]
// --check compares the two without copying. The copy refuses a target that isn't empty (it never overwrites).
// Short-lived keys (rate limits, locks) are left out, the same as the nightly copy; time-to-live is kept.
import crypto from 'node:crypto';
import { exportAll, importAll } from '../api/_lib/backup.js';

const env = (url, token) => ({ UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token });
export function fingerprint(dump) {
  const norm = v => Array.isArray(v) ? v.map(String) : v === null || v === undefined ? null : String(v);
  const rows = dump.items.map(x => {
    let v = norm(x.v);
    if (x.t === 'set') v = [...v].sort();
    if (x.t === 'hash') { const pairs = []; for (let i = 0; i < v.length; i += 2) pairs.push([v[i], v[i + 1]]); v = pairs.sort((a, b) => a[0] < b[0] ? -1 : 1).flat(); }
    return `${x.k}\u0000${x.t}\u0000${JSON.stringify(v)}`;
  }).sort();
  return { count: rows.length, hash: crypto.createHash('sha256').update(rows.join('\n')).digest('hex').slice(0, 16) };
}

export async function copyDatabase(from, to, { check = false } = {}) {
  const src = await exportAll(from);
  if (!check) await importAll(src, to);
  const a = fingerprint(src), b = fingerprint(await exportAll(to));
  return { from: a, to: b, same: a.count === b.count && a.hash === b.hash };
}

if (process.argv[1] && process.argv[1].endsWith('copy-database.mjs')) {
  const { FROM_URL, FROM_TOKEN, TO_URL, TO_TOKEN } = process.env;
  if (!FROM_URL || !FROM_TOKEN || !TO_URL || !TO_TOKEN) { console.error('Set FROM_URL, FROM_TOKEN, TO_URL and TO_TOKEN first.'); process.exit(1); }
  if (FROM_URL.replace(/\/$/, '') === TO_URL.replace(/\/$/, '')) { console.error('The two databases are the same.'); process.exit(1); }
  const r = await copyDatabase(env(FROM_URL, FROM_TOKEN), env(TO_URL, TO_TOKEN), { check: process.argv.includes('--check') });
  console.log(`from: ${r.from.count} keys (${r.from.hash})  to: ${r.to.count} keys (${r.to.hash})  ${r.same ? 'MATCH' : 'DIFFERENT'}`);
  process.exitCode = r.same ? 0 : 1;
}
