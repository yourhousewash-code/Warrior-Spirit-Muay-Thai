// Sign-in, password reset and the bot check, run against a stand-in database (Council C-007 release checks, 14 Nov 2026).
// Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFakeUpstash, call, cookieFrom } from './helpers/fake-upstash.mjs';

let db, auth, enquiry, turnstile;
let cf = { mode: 'ok' }; // what the pretend Cloudflare answers: ok | bad | used | down | http500
const realFetch = globalThis.fetch;
const seen = [];

before(async () => {
  db = await startFakeUpstash();
  Object.assign(process.env, { UPSTASH_REDIS_REST_URL: db.url, UPSTASH_REDIS_REST_TOKEN: 'test', SESSION_SECRET: 'test-secret-'.padEnd(40, 'x') });
  delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith('https://challenges.cloudflare.com/turnstile/v0/siteverify')) {
      const form = new URLSearchParams(String(opts.body));
      seen.push(form.get('response'));
      if (cf.mode === 'down') throw new Error('network down');
      if (cf.mode === 'http500') return new Response('oops', { status: 500 });
      const okToken = form.get('response') === 'good-token' && form.get('secret') === 'test-secret';
      const j = cf.mode === 'used' ? { success: false, 'error-codes': ['timeout-or-duplicate'] }
        : okToken ? { success: true, hostname: 'www.warriorspiritmuaythai.co.uk' } : { success: false, 'error-codes': ['invalid-input-response'] };
      return new Response(JSON.stringify(j), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts);
  };
  const log = console.log; console.log = () => {}; // quiet "[mail skipped]"
  auth = (await import('../api/auth.js')).default;
  enquiry = (await import('../api/enquiry.js')).default;
  turnstile = await import('../api/_lib/turnstile.js');
  console.log = log;
});
after(async () => { globalThis.fetch = realFetch; await db.close(); });

const keysOn = () => Object.assign(process.env, { TURNSTILE_SITE_KEY: 'site-key', TURNSTILE_SECRET_KEY: 'test-secret' });
const keysOff = () => { delete process.env.TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_SECRET_KEY; };
const quiet = async fn => { const l = console.log, e = console.error; console.log = console.error = () => {}; try { return await fn(); } finally { console.log = l; console.error = e; } };

test('bot check: off until both keys are set, then missing, invalid, expired or reused tokens fail', async () => {
  keysOff(); cf.mode = 'ok';
  assert.equal((await turnstile.humanCheck('', '1.2.3.4')).ok, true, 'no keys: forms keep working');
  assert.equal(turnstile.turnstileSiteKey(), '');
  keysOn();
  assert.equal(turnstile.turnstileSiteKey(), 'site-key');
  assert.equal((await turnstile.humanCheck('', '1.2.3.4')).ok, false, 'missing token');
  assert.equal((await turnstile.humanCheck(undefined, '1.2.3.4')).ok, false, 'no token at all');
  assert.equal((await turnstile.humanCheck('x'.repeat(3000), '1.2.3.4')).ok, false, 'oversized token');
  assert.equal((await turnstile.humanCheck('made-up', '1.2.3.4')).ok, false, 'invalid token');
  cf.mode = 'used';
  assert.equal((await turnstile.humanCheck('good-token', '1.2.3.4')).ok, false, 'expired or already used token');
  cf.mode = 'ok';
  assert.equal((await turnstile.humanCheck('good-token', '1.2.3.4')).ok, true, 'good token');
  for (const m of ['down', 'http500']) {
    cf.mode = m;
    assert.equal((await quiet(() => turnstile.humanCheck('good-token', '1.2.3.4'))).ok, false, `${m}: sign-up and reset refuse`);
    assert.equal((await quiet(() => turnstile.humanCheck('good-token', '1.2.3.4', { failOpen: true }))).ok, true, `${m}: the enquiry form lets people through`);
  }
  cf.mode = 'ok'; keysOff();
});

const enquiryBody = tok => ({ about: 'Free first class', name: 'Test Person', phone: '07700 900123', reply: 'WhatsApp', consent: true, cfToken: tok });

test('enquiry form: refused without a good token when the check is on; works with one', async () => {
  keysOn(); cf.mode = 'ok';
  let r = await call(enquiry, { body: enquiryBody(''), ip: '198.51.100.1' });
  assert.equal(r.status, 403); assert.match(r.json.error, /couldn’t confirm/);
  cf.mode = 'used';
  r = await call(enquiry, { body: enquiryBody('good-token'), ip: '198.51.100.1' });
  assert.equal(r.status, 403, 'a reused token is refused');
  cf.mode = 'ok';
  r = await quiet(() => call(enquiry, { body: enquiryBody('good-token'), ip: '198.51.100.1' }));
  assert.equal(r.status, 200); assert.equal(db.keys('enquiry:').length, 1);
  keysOff();
  r = await quiet(() => call(enquiry, { body: enquiryBody(''), ip: '198.51.100.2' }));
  assert.equal(r.status, 200, 'with the check off, the form works as before');
});

test('sign-up and forgotten password: refused without a good token when the check is on', async () => {
  keysOn(); cf.mode = 'ok';
  const reg = { name: 'Bot Check', email: 'bot@example.com', mobile: '07700 900111', password: 'a-long-password' };
  let r = await call(auth, { query: { action: 'register' }, body: { ...reg, cfToken: '' }, ip: '198.51.100.3' });
  assert.equal(r.status, 403); assert.equal(await db.kv.has('user:bot@example.com'), false);
  r = await call(auth, { query: { action: 'forgot' }, body: { email: 'bot@example.com', cfToken: 'made-up' }, ip: '198.51.100.3' });
  assert.equal(r.status, 403);
  r = await call(auth, { query: { action: 'register' }, body: { ...reg, cfToken: 'good-token' }, ip: '198.51.100.3' });
  assert.equal(r.status, 200);
  keysOff();
});

test('the member sign-in cookie is HttpOnly, Secure and SameSite=Lax', async () => {
  const r = await call(auth, { query: { action: 'register' }, body: { name: 'Cookie Check', email: 'cookie@example.com', mobile: '07700 900222', password: 'a-long-password' }, ip: '198.51.100.4' });
  assert.equal(r.status, 200);
  const c = [].concat(r.headers['set-cookie']).find(x => x.startsWith('ws_user='));
  assert.match(c, /; HttpOnly/); assert.match(c, /; Secure/); assert.match(c, /; SameSite=Lax/);
});

test('log in: the same answer whether the email has an account or not', async () => {
  const known = await call(auth, { query: { action: 'login' }, body: { email: 'cookie@example.com', password: 'wrong-password' }, ip: '198.51.100.5' });
  const unknown = await call(auth, { query: { action: 'login' }, body: { email: 'nobody@example.com', password: 'wrong-password' }, ip: '198.51.100.5' });
  assert.equal(known.status, 401); assert.equal(unknown.status, 401);
  assert.equal(known.json.error, unknown.json.error);
  const f1 = await call(auth, { query: { action: 'forgot' }, body: { email: 'cookie@example.com' }, ip: '198.51.100.5' });
  const f2 = await call(auth, { query: { action: 'forgot' }, body: { email: 'nobody@example.com' }, ip: '198.51.100.5' });
  assert.deepEqual(f1.json, f2.json); assert.equal(f1.status, f2.status);
});

test('a password reset signs the account out everywhere else', async () => {
  const email = 'reset@example.com';
  const reg = await call(auth, { query: { action: 'register' }, body: { name: 'Reset Check', email, mobile: '07700 900333', password: 'first-password' }, ip: '198.51.100.6' });
  const phone = cookieFrom(reg.headers['set-cookie']);
  const laptop = cookieFrom((await call(auth, { query: { action: 'login' }, body: { email, password: 'first-password' }, ip: '198.51.100.7' })).headers['set-cookie']);
  for (const c of [phone, laptop]) assert.equal((await call(auth, { method: 'GET', query: { action: 'me' }, cookie: c })).json.user.email, email);

  await call(auth, { query: { action: 'forgot' }, body: { email }, ip: '198.51.100.8' });
  const token = db.keys('reset:').find(k => db.kv.get(k).v === email)?.slice('reset:'.length);
  assert.ok(token, 'a reset link was made');
  const reset = await call(auth, { query: { action: 'reset' }, body: { token, password: 'second-password' }, ip: '198.51.100.8' });
  assert.equal(reset.status, 200);
  const fresh = cookieFrom(reset.headers['set-cookie']);

  for (const c of [phone, laptop]) assert.equal((await call(auth, { method: 'GET', query: { action: 'me' }, cookie: c })).json.user, null, 'old login ended');
  assert.equal((await call(auth, { method: 'GET', query: { action: 'me' }, cookie: fresh })).json.user.email, email, 'the device that reset stays in');
  assert.equal((await call(auth, { query: { action: 'login' }, body: { email, password: 'first-password' }, ip: '198.51.100.9' })).status, 401);
  assert.equal((await call(auth, { query: { action: 'login' }, body: { email, password: 'second-password' }, ip: '198.51.100.9' })).status, 200);
  assert.equal((await call(auth, { query: { action: 'reset' }, body: { token, password: 'third-password' }, ip: '198.51.100.8' })).status, 410, 'a reset link works once');
});

test('no shared starting password: a coach without their own password can\'t sign in', async () => {
  for (const username of ['aaron', 'kian', 'jay']) {
    const r = await call(auth, { query: { action: 'coach-login' }, body: { username, password: 'Muaythai' }, ip: '198.51.100.30' });
    assert.equal(r.status, 401, `${username} signed in with the old shared password`);
  }
});

test('enquiry free text never keeps a card number or a password (S-008)', async () => {
  const { screen } = await import('../api/enquiry.js');
  assert.equal(screen('card 4242 4242 4242 4242 thanks'), 'card [card number removed] thanks');
  assert.match(screen('my password is hunter2'), /password \[removed\]/);
  assert.equal(screen('call 07700 900123'), 'call 07700 900123', 'phone numbers stay');
  assert.equal(screen('ref 1234 5678 9012 3456'), 'ref 1234 5678 9012 3456', 'a number that fails the card check stays');
});
