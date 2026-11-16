// The FighterBase switch-over switch (api/_lib/switchover.js; orders WS-009 and WS-010), in both positions.
// Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, cpSync, symlinkSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { startFakeUpstash, call, cookieFrom } from './helpers/fake-upstash.mjs';

const TEST_LINKS = { base: 'https://fb.example', join: '/#join=CODE&src=site', book: '/#book=CODE&src=site', pt: '/#pt=CODE&src=site', clubFeed: 'https://fb.example/club.ics' };

test('switched off (now): no FighterBase links stored, none in vercel.json, nothing about it on public pages', async () => {
  const { SWITCHOVER } = await import('../api/_lib/switchover.js');
  assert.equal(SWITCHOVER.on, false, 'the switch is off until Steve says go');
  for (const k of ['base', 'join', 'book', 'pt', 'clubFeed']) assert.equal(SWITCHOVER[k], '', `${k} must stay empty while off (the club code stays off public pages)`);
  const vj = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.ok(!(vj.redirects || []).some(r => ['/book', '/book.html', '/calendar/club.ics'].includes(r.source)), 'no switch-over redirects while off');
});

test('switched on: the build drops "Get the app", credits FighterBase and writes the redirects', () => {
  const root = resolve('.');
  const tmp = mkdtempSync(join(tmpdir(), 'ws-switch-'));
  try {
    for (const d of ['site-src', 'tools', 'api']) cpSync(join(root, d), join(tmp, d), { recursive: true });
    for (const f of ['vercel.json', 'package.json']) cpSync(join(root, f), join(tmp, f));
    for (const d of ['img', 'photos', 'video', 'node_modules']) if (existsSync(join(root, d))) symlinkSync(join(root, d), join(tmp, d));
    const sw = join(tmp, 'api/_lib/switchover.js');
    let code = readFileSync(sw, 'utf8').replace('on: false,', 'on: true,');
    for (const [k, v] of Object.entries(TEST_LINKS)) code = code.replace(new RegExp(`^(\\s*${k}: )'',`, 'm'), `$1'${v}',`);
    writeFileSync(sw, code);
    execFileSync(process.execPath, ['tools/build-pages.mjs'], { cwd: tmp, stdio: 'pipe' });
    for (const f of ['index.html', 'contact.html', 'pt.html']) {
      const h = readFileSync(join(tmp, f), 'utf8');
      assert.ok(!/<[^>]*data-install|'#get-app'|install\.js|Get the app/.test(h), `${f}: "Get the app" still there`);
      assert.ok(h.includes('Bookings powered by <a href="https://fb.example"'), `${f}: no FighterBase credit in the footer`);
      assert.ok(!h.includes('My PT bookings') && h.includes('>My bookings</a>'), `${f}: "My bookings" label`);
    }
    const vj = JSON.parse(readFileSync(join(tmp, 'vercel.json'), 'utf8'));
    const r = Object.fromEntries(vj.redirects.map(x => [x.source, x]));
    assert.equal(r['/book'].destination, 'https://fb.example/#pt=CODE&src=site'); assert.equal(r['/book'].permanent, false);
    assert.equal(r['/calendar/club.ics'].destination, 'https://fb.example/club.ics');
    assert.ok(vj.redirects.some(x => x.has), 'the old vercel.app redirect is kept');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

let db, auth, pt, cal, SW;
const realFetch = globalThis.fetch;
before(async () => {
  db = await startFakeUpstash();
  Object.assign(process.env, { UPSTASH_REDIS_REST_URL: db.url, UPSTASH_REDIS_REST_TOKEN: 'test', SESSION_SECRET: 'test-secret-'.padEnd(40, 'x') });
  delete process.env.SMTP_USER; delete process.env.SMTP_PASS; delete process.env.TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_SECRET_KEY;
  const log = console.log; console.log = () => {};
  auth = (await import('../api/auth.js')).default; pt = (await import('../api/pt.js')).default; cal = (await import('../api/cal.js')).default;
  SW = (await import('../api/_lib/switchover.js')).SWITCHOVER;
  console.log = log;
});
after(async () => { globalThis.fetch = realFetch; await db.close(); });
const quiet = async fn => { const l = console.log, e = console.error; console.log = console.error = () => {}; try { return await fn(); } finally { console.log = l; console.error = e; } };

test('switched on: adults are sent to FighterBase, kids classes and bookings already made stay on the site', async () => {
  const { londonDate, addDays, dow } = await import('../api/_lib/avail.js');
  const day = addDays(londonDate(Date.now()), 2), wd = dow(day);
  const classes = [
    { id: 'k-kids', day: wd, start: '17:30', end: '18:20', name: 'Kids Muay Thai', coach: 'jay', max: 12 },
    { id: 'k-pads', day: wd, start: '18:30', end: '19:30', name: 'Pads', coach: 'jay', max: 12 },
  ];
  db.kv.set('classes', { v: JSON.stringify(classes) });
  const reg = await quiet(() => call(auth, { query: { action: 'register' }, body: { name: 'Parent Test', email: 'parent@example.com', mobile: '07700 900444', password: 'a-long-password' }, ip: '198.51.100.20' }));
  assert.equal(reg.status, 200);
  const me = cookieFrom(reg.headers['set-cookie']);

  // off: both classes bookable, and the account page hears nothing about FighterBase
  let r = await call(pt, { method: 'GET', query: { action: 'class-dates' }, cookie: me });
  assert.deepEqual([...new Set(r.json.classes.map(k => k.classId))].sort(), ['k-kids', 'k-pads']);
  assert.equal((await call(auth, { method: 'GET', query: { action: 'config' } })).json.moved, undefined);
  const before = await quiet(() => call(pt, { query: { action: 'class-book' }, body: { classId: 'k-pads', date: day, remind: 'none' }, cookie: me }));
  assert.equal(before.status, 200, 'an adult class booked before the switch');

  Object.assign(SW, { on: true, ...TEST_LINKS });
  try {
    const cfg = (await call(auth, { method: 'GET', query: { action: 'config' } })).json.moved;
    assert.equal(cfg.pt, 'https://fb.example/#pt=CODE&src=site'); assert.equal(cfg.join, 'https://fb.example/#join=CODE&src=site');
    r = await call(pt, { method: 'GET', query: { action: 'open' } });
    assert.equal(r.status, 410); assert.equal(r.json.moved, cfg.pt);
    r = await call(pt, { query: { action: 'book' }, body: {} });
    assert.equal(r.status, 410, 'new PT bookings go to FighterBase, signed in or not');
    r = await call(pt, { method: 'GET', query: { action: 'class-dates' }, cookie: me });
    assert.deepEqual([...new Set(r.json.classes.map(k => k.classId))], ['k-kids'], 'only kids classes are offered here');
    r = await call(pt, { query: { action: 'class-book' }, body: { classId: 'k-pads', date: addDays(day, 7), remind: 'none' }, cookie: me });
    assert.equal(r.status, 410, 'adult classes are booked in FighterBase');
    r = await quiet(() => call(pt, { query: { action: 'class-book' }, body: { classId: 'k-kids', date: day, remind: 'none' }, cookie: me }));
    assert.equal(r.status, 200, 'kids classes are still booked here');
    r = await call(pt, { method: 'GET', query: { action: 'class-mine' }, cookie: me });
    assert.ok(r.json.bookings.some(b => b.className === 'Pads'), 'the adult class booked before the switch still shows');
    // the personal calendar keeps the site's bookings and adds one note about the move
    const tok = (await call(cal, { method: 'POST', query: { action: 'link' }, cookie: me })).json.me.split('/').pop().replace('.ics', '');
    let body = '';
    const res = { statusCode: 200, status(s) { this.statusCode = s; return this; }, setHeader() { return this; }, getHeader() {}, end(b) { body = b; }, json(d) { body = JSON.stringify(d); } };
    await cal({ method: 'GET', query: { feed: 'me', t: tok }, headers: { host: 'www.warriorspiritmuaythai.co.uk' } }, res);
    assert.match(body, /SUMMARY:Pads \(Warrior Spirit\)/); assert.match(body, /SUMMARY:New bookings are in the FighterBase app/);
  } finally { Object.assign(SW, { on: false, base: '', join: '', book: '', pt: '', clubFeed: '' }); }
  assert.equal((await call(auth, { method: 'GET', query: { action: 'config' } })).json.moved, undefined, 'switched back off');
});
