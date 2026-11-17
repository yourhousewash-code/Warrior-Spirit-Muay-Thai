// The FighterBase switch-over switch (api/_lib/switchover.js; orders WS-009 and WS-010), in both positions.
// Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, cpSync, symlinkSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { startFakeUpstash, call, cookieFrom } from './helpers/fake-upstash.mjs';

const TEST_LINKS = { base: 'https://fb.example', join: '/#join=CODE&src=site', book: '/#book=CODE&src=site', pt: '/#pt=CODE&src=site', app: '/?src=site', clubFeed: 'https://fb.example/club.ics', timetable: 'https://fb.example/club.json' };
const OFF = { on: false, base: '', join: '', book: '', pt: '', app: '', clubFeed: '', timetable: '', kidsOnSite: false };

test('switched off (now): no FighterBase links stored, none in vercel.json, nothing about it on public pages', async () => {
  const { SWITCHOVER } = await import('../api/_lib/switchover.js');
  assert.equal(SWITCHOVER.on, false, 'the switch is off until Steve says go');
  for (const k of ['base', 'join', 'book', 'pt', 'app', 'clubFeed', 'timetable']) assert.equal(SWITCHOVER[k], '', `${k} must stay empty while off (the club code stays off public pages)`);
  for (const f of ['fb-logo.svg', 'fb-mark.svg']) assert.ok(!existsSync(`img/${f}`), `img/${f}: FighterBase's logo isn't on the site while off`);
  const vj = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.ok(!(vj.redirects || []).some(r => ['/book', '/book.html', '/calendar/club.ics', '/account', '/account.html'].includes(r.source)), 'no switch-over redirects while off');
  assert.equal(SWITCHOVER.kidsOnSite, false, 'everything moves on the day (Steve, 17 Nov)');
});

test('switched on: the build points "Get the app" at FighterBase, credits it and writes the redirects', () => {
  const root = resolve('.');
  const tmp = mkdtempSync(join(tmpdir(), 'ws-switch-'));
  try {
    for (const d of ['site-src', 'tools', 'api', 'parked', 'img']) cpSync(join(root, d), join(tmp, d), { recursive: true });
    for (const f of ['vercel.json', 'package.json']) cpSync(join(root, f), join(tmp, f));
    for (const d of ['photos', 'video', 'node_modules']) if (existsSync(join(root, d))) symlinkSync(join(root, d), join(tmp, d));
    const sw = join(tmp, 'api/_lib/switchover.js');
    let code = readFileSync(sw, 'utf8').replace('on: false,', 'on: true,');
    for (const [k, v] of Object.entries(TEST_LINKS)) code = code.replace(new RegExp(`^(\\s*${k}: )'',`, 'm'), `$1'${v}',`);
    writeFileSync(sw, code);
    execFileSync(process.execPath, ['tools/build-pages.mjs'], { cwd: tmp, stdio: 'pipe' });
    for (const f of ['index.html', 'contact.html', 'pt.html']) {
      const h = readFileSync(join(tmp, f), 'utf8');
      assert.ok(!/<[^>]*data-install|'#get-app'|install\.js/.test(h), `${f}: the website's own install is still there`);
      assert.equal(h.split('href="https://fb.example/?src=site" rel="noopener"').length - 1, 3, `${f}: the three "Get the app" buttons open FighterBase`);
      assert.ok(h.includes('href:"https://fb.example/?src=site"'), `${f}: the ticker's app item opens FighterBase`);
      assert.ok(h.includes('<a class="fbbadge" href="https://fb.example" rel="noopener"><span>Powered by</span><img src="/img/fb-logo.svg" alt="FighterBase"'), `${f}: the "Powered by FighterBase" badge`);
      assert.ok(h.includes('<img src="img/logo.webp" alt="Warrior Spirit Muay Thai logo">'), `${f}: the Warrior Spirit logo is still the main one in the header`);
      assert.ok(!h.includes('My PT bookings') && h.includes('>My bookings</a>'), `${f}: "My bookings" label`);
    }
    assert.ok(readFileSync(join(tmp, 'classes.html'), 'utf8').includes('Live timetable from <a href="https://fb.example"'), 'the timetable says it comes from FighterBase');
    for (const f of ['fb-logo.svg', 'fb-mark.svg']) assert.ok(existsSync(join(tmp, 'img', f)), `img/${f} copied in when switched on`);
    const vj = JSON.parse(readFileSync(join(tmp, 'vercel.json'), 'utf8'));
    const r = Object.fromEntries(vj.redirects.map(x => [x.source, x]));
    assert.equal(r['/book'].destination, 'https://fb.example/#pt=CODE&src=site'); assert.equal(r['/book'].permanent, false);
    assert.equal(r['/calendar/club.ics'].destination, 'https://fb.example/club.ics');
    assert.equal(r['/account'].destination, 'https://fb.example/#join=CODE&src=site', 'members sign in and book in FighterBase');
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

test('switched on: everything is booked in FighterBase; kids stay here only if kidsOnSite is set for the day', async () => {
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
  assert.equal(before.status, 200, 'a class booked before the switch');

  globalThis.fetch = async (u, o) => { if (String(u).startsWith('https://fb.example')) throw new Error('FighterBase not reachable in this part of the test'); return realFetch(u, o); };
  Object.assign(SW, { on: true, ...TEST_LINKS });
  try {
    const cfg = (await call(auth, { method: 'GET', query: { action: 'config' } })).json.moved;
    assert.equal(cfg.pt, 'https://fb.example/#pt=CODE&src=site'); assert.equal(cfg.app, 'https://fb.example/?src=site'); assert.equal(cfg.kidsOnSite, false);
    r = await call(pt, { method: 'GET', query: { action: 'open' } });
    assert.equal(r.status, 410); assert.equal(r.json.moved, cfg.pt);
    r = await call(pt, { query: { action: 'book' }, body: {} });
    assert.equal(r.status, 410, 'new PT bookings go to FighterBase, signed in or not');
    r = await quiet(() => call(pt, { method: 'GET', query: { action: 'class-dates' }, cookie: me }));
    assert.deepEqual(r.json.classes, [], 'no class is offered here'); assert.equal(r.json.moved, cfg.book);
    for (const id of ['k-pads', 'k-kids']) {
      r = await quiet(() => call(pt, { query: { action: 'class-book' }, body: { classId: id, date: addDays(day, 7), remind: 'none' }, cookie: me }));
      assert.equal(r.status, 410, `${id} is booked in FighterBase`);
    }
    // the day's fallback: FighterBase's kids review not done, so kids stay here
    SW.kidsOnSite = true;
    r = await quiet(() => call(pt, { method: 'GET', query: { action: 'class-dates' }, cookie: me }));
    assert.deepEqual([...new Set(r.json.classes.map(k => k.classId))], ['k-kids']);
    r = await quiet(() => call(pt, { query: { action: 'class-book' }, body: { classId: 'k-kids', date: day, remind: 'none' }, cookie: me }));
    assert.equal(r.status, 200, 'kids classes booked here when kidsOnSite is set');
    SW.kidsOnSite = false;
    // the personal calendar keeps the site's bookings and adds one note about the move
    const tok = (await call(cal, { method: 'POST', query: { action: 'link' }, cookie: me })).json.me.split('/').pop().replace('.ics', '');
    let body = '';
    const res = { statusCode: 200, status(s) { this.statusCode = s; return this; }, setHeader() { return this; }, getHeader() {}, end(b) { body = b; }, json(d) { body = JSON.stringify(d); } };
    await quiet(() => cal({ method: 'GET', query: { feed: 'me', t: tok }, headers: { host: 'www.warriorspiritmuaythai.co.uk' } }, res));
    assert.match(body, /SUMMARY:New bookings are in the FighterBase app/);
  } finally { Object.assign(SW, OFF); globalThis.fetch = realFetch; }
  assert.equal((await call(auth, { method: 'GET', query: { action: 'config' } })).json.moved, undefined, 'switched back off');
});

test('switched on: the timetable and opening hours come from FighterBase\'s feed, cached, with the last good copy if it fails', async () => {
  const { mapClasses, mapHours, CACHE_KEY } = await import('../api/_lib/fbtimetable.js');
  const feed = { club: { name: 'Warrior Spirit' }, classes: [
    { day: 'Monday', dow: 0, time: '18:30', mins: 60, title: 'Drills & sparring', coach: 'Jay', kids: false, places: 20, weeks: null },
    { day: 'Tuesday', dow: 1, time: '17:30', mins: 50, title: 'Kids Muay Thai', coach: 'Jay', kids: true, places: null, weeks: null },
    { day: 'Sunday', dow: 6, time: '10:00', mins: 90, title: 'Open mat', coach: 'Sam', kids: false, places: null, weeks: 'B' },
  ], hours: { monday: { open: '09:00', close: '21:00' }, tuesday: '09:00-21:00', wednesday: { open: '09:00', close: '21:00' }, thursday: { open: '09:00', close: '21:00' }, friday: { open: '09:00', close: '21:00' }, saturday: { open: '08:00', close: '12:00' }, sunday: { closed: true } } };
  const mapped = mapClasses(feed);
  assert.deepEqual(mapped.map(k => [k.day, k.start, k.end, k.coach, k.coachName]), [[1, '18:30', '19:30', 'jay', 'Jay'], [2, '17:30', '18:20', 'jay', 'Jay'], [0, '10:00', '11:30', '', 'Sam']], 'days moved to Sunday = 0, end times worked out, coaches matched');
  assert.equal(mapped[2].name, 'Open mat (week B)'); assert.equal(mapped[0].max, 20); assert.equal(mapped[1].kids, true);
  assert.equal(mapHours(feed.hours).length, 7); assert.equal(mapHours({ monday: '?' }), null, 'an unknown shape keeps the site\'s own hours');

  let calls = 0, fail = false;
  globalThis.fetch = async (u, o) => { if (!String(u).startsWith('https://fb.example')) return realFetch(u, o); calls++; if (fail) throw new Error('down'); assert.equal(String(u), TEST_LINKS.timetable); return new Response(JSON.stringify(feed), { status: 200 }); };
  Object.assign(SW, { on: true, ...TEST_LINKS });
  try {
    db.kv.delete(CACHE_KEY);
    let r = await call(pt, { method: 'GET', query: { action: 'timetable' } });
    assert.deepEqual(r.json.classes.map(k => [k.name, k.coach]), [['Drills & sparring', 'Jay'], ['Kids Muay Thai', 'Jay'], ['Open mat (week B)', 'Sam']]);
    r = await call(pt, { method: 'GET', query: { action: 'hours' } });
    assert.equal(r.json.hours.find(h => h.day === 6).close, '12:00'); assert.equal(r.json.hours.find(h => h.day === 0).closed, true);
    assert.equal(calls, 1, 'the second read came from the 15-minute copy');
    fail = true; db.kv.set(CACHE_KEY, { v: JSON.stringify({ at: 0, data: { classes: mapped, hours: null } }) });
    r = await quiet(() => call(pt, { method: 'GET', query: { action: 'timetable' } }));
    assert.equal(r.json.classes.length, 3, 'FighterBase down: the last good copy is shown');
    db.kv.delete(CACHE_KEY);
    r = await quiet(() => call(pt, { method: 'GET', query: { action: 'timetable' } }));
    assert.ok(r.json.classes.some(k => k.name === 'Pads'), 'never fetched and FighterBase down: the site\'s own timetable');
  } finally { Object.assign(SW, OFF); globalThis.fetch = realFetch; }
});
