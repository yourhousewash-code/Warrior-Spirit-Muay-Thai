// The nightly database copy (A-069; api/_lib/backup.js): exact export, encryption, restore into an empty database, Drive upload and 30-day tidy.
// Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startFakeUpstash, call } from './helpers/fake-upstash.mjs';

let A, B, backup, auth, enquiry;
const realFetch = globalThis.fetch;
const KEY = crypto.randomBytes(32).toString('base64');
const envOf = db => ({ UPSTASH_REDIS_REST_URL: db.url, UPSTASH_REDIS_REST_TOKEN: 'test', BACKUP_KEY: KEY });
const quiet = async fn => { const l = console.log, e = console.error; console.log = console.error = () => {}; try { return await fn(); } finally { console.log = l; console.error = e; } };

before(async () => {
  A = await startFakeUpstash(); B = await startFakeUpstash();
  Object.assign(process.env, { UPSTASH_REDIS_REST_URL: A.url, UPSTASH_REDIS_REST_TOKEN: 'test', SESSION_SECRET: 'test-secret-'.padEnd(40, 'x') });
  delete process.env.SMTP_USER; delete process.env.SMTP_PASS; delete process.env.TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_SECRET_KEY;
  backup = await import('../api/_lib/backup.js');
  auth = (await import('../api/auth.js')).default; enquiry = (await import('../api/enquiry.js')).default;
});
after(async () => { globalThis.fetch = realFetch; await A.close(); await B.close(); });

const snapshot = db => Object.fromEntries([...db.kv.keys()].filter(k => !k.startsWith('rl:')).sort().map(k => {
  const e = db.kv.get(k), v = e.v instanceof Map ? Object.fromEntries([...e.v].map(([a, b]) => [a, String(b)])) : e.v instanceof Set ? [...e.v].sort() : e.v;
  return [k, { t: e.t || 'string', v }];
}));

test('export, seal, open and restore give back exactly the same data (short-lived keys left out)', async () => {
  await quiet(() => call(auth, { query: { action: 'register' }, body: { name: 'Backup Test', email: 'b@example.com', mobile: '07700 900555', password: 'a-long-password' }, ip: '198.51.100.40' }));
  await quiet(() => call(enquiry, { body: { about: 'Free first class', name: 'Enq Test', phone: '07700 900123', reply: 'WhatsApp', consent: true }, ip: '198.51.100.41' }));
  A.kv.set('tags', { v: new Set(['a', 'b']), t: 'set' }); A.kv.set('queue', { v: ['one', 'two'], t: 'list' });
  A.kv.set('reset:sometoken', { v: 'b@example.com', exp: Date.now() + 3600e3 });
  assert.ok(A.keys('rl:').length > 0, 'the test made some rate-limit keys');

  const dump = await backup.exportAll(envOf(A));
  assert.ok(!dump.items.some(x => x.k.startsWith('rl:')), 'rate-limit counts are left out');
  assert.ok(dump.items.find(x => x.k === 'reset:sometoken').ttl > 0, 'time to live is kept');
  const sealed = backup.seal(dump, KEY);
  assert.ok(!sealed.includes('b@example.com') && !sealed.includes('Enq Test'), 'nothing readable without the key');
  assert.throws(() => backup.open(sealed, crypto.randomBytes(32).toString('base64')), 'a wrong key fails');
  const back = backup.open(sealed, KEY);
  assert.equal(back.count, dump.count);

  assert.equal(await backup.importAll(back, envOf(B)), dump.count);
  assert.deepEqual(snapshot(B), snapshot(A), 'the restored database matches the original');
  await assert.rejects(() => backup.importAll(back, envOf(B)), /isn’t empty/, 'refuses a database that already has data');
});

test('the nightly job saves to Drive, bins copies older than 30 days, and is off without BACKUP_KEY', async () => {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.startsWith('https://www.googleapis.com/upload/drive/')) { calls.push(['upload', String(opts.body).match(/"name":"([^"]+)"/)[1]]); return new Response(JSON.stringify({ id: 'f1', size: '100' }), { status: 200 }); }
    if (u.startsWith('https://www.googleapis.com/drive/v3/files?q=')) return new Response(JSON.stringify({ files: [{ id: 'old', name: 'warrior-spirit-backup-2026-10-01.json.enc' }, { id: 'new', name: 'warrior-spirit-backup-2026-11-10.json.enc' }] }), { status: 200 });
    if (u.startsWith('https://www.googleapis.com/drive/v3/files/')) { calls.push(['bin', u.split('/').pop()]); return new Response('{}', { status: 200 }); }
    return realFetch(url, opts);
  };
  try {
    const r = await backup.nightlyBackup({ accessToken: async () => 'tok', backupFolder: async () => 'folder', env: envOf(A), now: new Date('2026-11-17T06:00:00Z') });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(calls, [['upload', 'warrior-spirit-backup-2026-11-17.json.enc'], ['bin', 'old']]);
    const off = await backup.nightlyBackup({ accessToken: async () => 'tok', backupFolder: async () => 'folder', env: { ...envOf(A), BACKUP_KEY: '' } });
    assert.equal(off.ok, false); assert.match(off.skipped, /not set/);
    const broken = await quiet(() => backup.nightlyBackup({ accessToken: async () => { throw new Error('Google Drive needs reconnecting.'); }, backupFolder: async () => 'folder', env: envOf(A) }));
    assert.equal(broken.ok, false, 'a failure is reported, not thrown');
  } finally { globalThis.fetch = realFetch; }
});
