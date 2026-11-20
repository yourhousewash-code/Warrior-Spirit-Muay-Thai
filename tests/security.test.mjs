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

test('class rosters: a coach sees their own classes and dates they cover, not others (S-003)', async () => {
  const { londonDate, addDays, dow } = await import('../api/_lib/avail.js');
  const pt = (await import('../api/pt.js')).default;
  const day = addDays(londonDate(Date.now()), 3), wd = dow(day);
  db.kv.set('classes', { v: JSON.stringify([
    { id: 'r-jay', day: wd, start: '18:00', end: '19:00', name: 'Pads', coach: 'jay', max: 10 },
    { id: 'r-kian', day: wd, start: '19:00', end: '20:00', name: 'Drills', coach: 'kian', max: 10 },
  ]) });
  db.kv.set('classcover', { v: JSON.stringify({ [`r-jay|${day}`]: 'aaron' }) });
  // sign Aaron in with a password of his own (an owner would set it)
  const { hashPassword } = await import('../api/_lib/core.js');
  db.kv.set('coach:aaron:hash', { v: hashPassword('aarons-own-password') });
  const login = await call(auth, { query: { action: 'coach-login' }, body: { username: 'aaron', password: 'aarons-own-password' }, ip: '198.51.100.31' });
  assert.equal(login.status, 200, JSON.stringify(login.json));
  const cookie = cookieFrom(login.headers['set-cookie']);
  const r = await call(pt, { method: 'GET', query: { action: 'class-roster' }, cookie });
  const ids = [...new Set(r.json.classes.map(k => k.classId))];
  assert.deepEqual(ids, ['r-jay'], 'Aaron sees the class he covers, not Kian\'s');
});

test('a coach without a password of their own has no session (ends any made with the old starting password; breach follow-up)', async () => {
  const { hashPassword } = await import('../api/_lib/core.js');
  db.kv.set('coach:kian:hash', { v: hashPassword('kians-own-password') });
  const login = await call(auth, { query: { action: 'coach-login' }, body: { username: 'kian', password: 'kians-own-password' }, ip: '198.51.100.32' });
  assert.equal(login.status, 200, JSON.stringify(login.json));
  const cookie = cookieFrom(login.headers['set-cookie']);
  assert.equal((await call(auth, { method: 'GET', query: { action: 'coach-me' }, cookie })).json.coach?.id, 'kian');
  db.kv.delete('coach:kian:hash');
  assert.ok(!(await call(auth, { method: 'GET', query: { action: 'coach-me' }, cookie })).json.coach, 'the session is refused');
});

// A-100: spam and bot layers on the enquiry form, sign-up and forgotten password (19 to 20 Nov 2026).
const month = () => `spamcount:${new Date().toISOString().slice(0, 7)}`;

test('enquiry layers: trap, too quick and sales pitches are kept out of the inbox; real ones go through', async () => {
  keysOff();
  const { blockedThisMonth } = await import('../api/_lib/spam.js');
  const before = db.keys('enquiry:').length, was = await blockedThisMonth();
  const body = (phone, extra) => ({ about: 'Free first class', name: 'Real Person', phone, reply: 'WhatsApp', consent: true, ...extra });
  let r = await quiet(() => call(enquiry, { body: body('07700 900201', { website: 'http://bot.example', elapsed: 9000 }), ip: '198.51.100.60' }));
  assert.equal(r.status, 200, 'a bot is told "sent"'); assert.equal(db.keys('enquiry:').length, before, 'and nothing is saved');
  r = await quiet(() => call(enquiry, { body: body('07700 900202', { elapsed: 400 }), ip: '198.51.100.61' }));
  assert.equal(r.status, 200);
  r = await quiet(() => call(enquiry, { body: body('07700 900203', { elapsed: 8000, message: 'Hi, we offer SEO services to get you on the first page of Google.' }), ip: '198.51.100.62' }));
  assert.equal(r.status, 200);
  r = await quiet(() => call(enquiry, { body: body('07700 900204', { elapsed: 8000, message: 'Can my son try the kids class on Monday? I saw your website.' }), ip: '198.51.100.63' }));
  assert.equal(r.status, 200);
  assert.equal(db.keys('enquiry:').length, before + 3, 'flagged ones are kept, never deleted');
  const now = await blockedThisMonth(), added = k => (now[k] || 0) - (was[k] || 0);
  assert.equal(added('trap'), 1); assert.equal(added('fast'), 1); assert.equal(added('pitch'), 1);
  const { redis } = await import('../api/_lib/core.js');
  const all = await Promise.all(db.keys('enquiry:').map(k => redis.hgetall(k)));
  const st = phone => all.find(e => e.phone.replace(/\D/g, '') === phone)?.status;
  assert.equal(st('07700900202'), 'spam'); assert.equal(st('07700900203'), 'spam'); assert.equal(st('07700900204'), 'new', 'the real one waits for a reply');
});

test('enquiry layers: one phone or email can send three a day, then is asked to call', async () => {
  keysOff();
  const body = { about: 'PT', name: 'Keen Person', phone: '07700 900299', reply: 'WhatsApp', consent: true, elapsed: 8000 };
  for (let i = 0; i < 3; i++) assert.equal((await quiet(() => call(enquiry, { body, ip: `198.51.100.${70 + i}` }))).status, 200);
  const r = await quiet(() => call(enquiry, { body, ip: '198.51.100.79' }));
  assert.equal(r.status, 429); assert.match(r.json.error, /call us/);
});

test('sales pitch check: flags pitches, leaves ordinary enquiries alone', async () => {
  const { pitchReason } = await import('../api/_lib/spam.js');
  for (const t of ['We can build you a new website design at a low price', 'Guest post opportunity on our blog', 'Dear business owner, increase your leads',
    'Visit https://a.example and www.b.example for marketing', 'Bitcoin investment returns'])
    assert.equal(pitchReason(t), 'sales pitch', t);
  for (const t of ['Can I bring my daughter to the kids class?', 'I saw your website, how much is PT with Jay?', 'Dear Sir, I would like to book a free class for my son.',
    'Is there parking? I work in marketing and finish at 6.', 'Do you do fight camps before a bout?', ''])
    assert.equal(pitchReason(t), '', t);
});

test('sign-up and forgotten password: the hidden trap field stops bots before anything is saved or emailed', async () => {
  keysOff();
  const users = db.keys('user:').length, resets = db.keys('reset:').length;
  let r = await quiet(() => call(auth, { query: { action: 'register' }, body: { name: 'Bot', mobile: '07700 900300', email: 'bot@example.com', password: 'longenough1', website: 'x' }, ip: '198.51.100.80' }));
  assert.equal(r.status, 400); assert.equal(db.keys('user:').length, users, 'no account made');
  r = await quiet(() => call(auth, { query: { action: 'forgot' }, body: { email: 'bot@example.com', website: 'x' }, ip: '198.51.100.81' }));
  assert.equal(r.status, 200, 'told "sent" like everyone else'); assert.equal(db.keys('reset:').length, resets, 'no reset link made');
});
