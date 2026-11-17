// The action log (A-069; api/_lib/actionlog.js): who changed what, before and after, with secrets left out. Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFakeUpstash, call, cookieFrom } from './helpers/fake-upstash.mjs';

let db, auth, pt, core;
before(async () => {
  db = await startFakeUpstash();
  Object.assign(process.env, { UPSTASH_REDIS_REST_URL: db.url, UPSTASH_REDIS_REST_TOKEN: 'test', SESSION_SECRET: 'test-secret-'.padEnd(40, 'x') });
  delete process.env.SMTP_USER; delete process.env.SMTP_PASS; delete process.env.TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_SECRET_KEY;
  const l = console.log; console.log = () => {};
  auth = (await import('../api/auth.js')).default; pt = (await import('../api/pt.js')).default; core = await import('../api/_lib/core.js');
  console.log = l;
});
after(() => db.close());

const log = () => db.keys('audit:').flatMap(k => db.kv.get(k).v.map(x => JSON.parse(x)));
const quiet = async fn => { const l = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = l; } };

test('action log: a sign-up, then the member\'s own change, each with who, before and after', async () => {
  const email = 'log@example.com';
  const reg = await quiet(() => call(auth, { query: { action: 'register' }, body: { name: 'Log Test', email, mobile: '07700 900111', password: 'a-long-password' }, ip: '198.51.100.50' }));
  assert.equal(reg.status, 200);
  const signup = log().find(e => e.key === `user:${email}` && e.cmd === 'hset');
  assert.equal(signup.who, 'visitor'); assert.equal(signup.via, 'auth:register'); assert.equal(signup.ip, '198.51.100.50');
  assert.equal(signup.after.name, 'Log Test'); assert.equal(signup.after.hash, '[hidden]', 'the scrambled password is never copied');

  const cookie = cookieFrom(reg.headers['set-cookie']);
  const r = await call(auth, { query: { action: 'profile' }, body: { mobile: '07700 900222' }, cookie, ip: '198.51.100.51' });
  assert.equal(r.status, 200);
  const change = log().find(e => e.key === `user:${email}` && e.via === 'auth:profile');
  assert.equal(change.who, `member:${email}`);
  assert.deepEqual(change.before, { mobile: '07700 900111' }); assert.deepEqual(change.after, { mobile: '07700 900222' });
});

test('action log: a coach\'s change names the coach; secrets and short-lived keys are never logged', async () => {
  db.kv.set('coach:aaron:hash', { v: core.hashPassword('aarons-own-password') });
  const login = await call(auth, { query: { action: 'coach-login' }, body: { username: 'aaron', password: 'aarons-own-password' }, ip: '198.51.100.52' });
  assert.equal(login.status, 200);
  const r = await call(pt, { query: { action: 'off-add' }, body: { from: '2030-01-02', to: '2030-01-03', note: 'Holiday' }, cookie: cookieFrom(login.headers['set-cookie']), ip: '198.51.100.52' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const e = log().find(x => x.key === 'coach:aaron:off');
  assert.equal(e.who, 'coach:aaron'); assert.equal(e.via, 'pt:off-add'); assert.equal(e.after[0].note, 'Holiday');

  await quiet(() => call(auth, { query: { action: 'forgot' }, body: { email: 'log@example.com' }, ip: '198.51.100.53' }));
  await core.redis.set('coach:aaron:hash', core.hashPassword('changed-password'));
  const all = JSON.stringify(log());
  assert.ok(!all.includes('a-long-password') && !all.includes('changed-password'), 'no password');
  assert.ok(!/scrypt|\$s\d|[0-9a-f]{64}/.test(all), 'no scrambled password');
  assert.ok(!log().some(x => /^(rl:|reset:|verify:|calfeed:|audit:)/.test(x.key)), 'no rate limits, reset links or feed links');
  const hashLine = log().find(x => x.key === 'coach:aaron:hash');
  assert.equal(hashLine.before, '[hidden]'); assert.equal(hashLine.after, '[hidden]'); assert.equal(hashLine.who, 'script');
});

test('action log: a deletion keeps the whole record; the log is kept 400 days and nothing deletes it', async () => {
  await core.redis.set('classtypes', [{ id: 'pads', name: 'Pads' }]);
  await core.redis.del('classtypes');
  const gone = log().filter(x => x.key === 'classtypes').pop();
  assert.equal(gone.cmd, 'del'); assert.deepEqual(gone.before, [{ id: 'pads', name: 'Pads' }]); assert.equal(gone.after, null);
  const [k] = db.keys('audit:');
  assert.match(k, /^audit:\d{4}-\d{2}$/);
  assert.ok(db.kv.get(k).exp - Date.now() > 399 * 864e5);
  const fs = await import('node:fs');
  for (const f of fs.readdirSync('api').filter(f => f.endsWith('.js')).map(f => 'api/' + f).concat(fs.readdirSync('api/_lib').map(f => 'api/_lib/' + f))) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/(del|lrem|ltrim|lpop|rpop)\([^)]*(audit:|LOG_PREFIX)/.test(src), `${f} must not remove log lines`);
  }
});
