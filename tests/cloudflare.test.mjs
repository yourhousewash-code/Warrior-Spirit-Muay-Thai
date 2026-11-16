// The Cloudflare Worker adapter and build (WS-011 step 3; not deployed). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

test('Cloudflare: the Worker answers the same addresses Vercel rewrites', async () => {
  const { route, routes } = await import('../cloudflare/worker.mjs');
  const r = p => route(new URL('https://x.test' + p));
  assert.deepEqual(r('/api/pt?action=class-dates'), { name: 'pt', query: { action: 'class-dates' } });
  assert.deepEqual(r('/team/jay'), { name: 'team', query: { id: 'jay' } });
  assert.deepEqual(r('/calendar/club.ics'), { name: 'cal', query: { feed: 'club' } });
  assert.deepEqual(r('/calendar/me/abc123'), { name: 'cal', query: { feed: 'me', t: 'abc123' } });
  assert.equal(r('/classes'), null, 'pages are plain files');
  for (const f of ['auth', 'cal', 'cron', 'enquiry', 'profile', 'pt', 'site', 'team', 'uploads']) assert.equal(typeof routes[f], 'function', f);
  assert.equal(routes.gdrive, undefined, 'gdrive.js waits for browser-side photo resizing (sharp cannot run on Workers)');
});

test('Cloudflare: the adapter handles json, redirects, cookies and piped files', async () => {
  const { runApi } = await import('../cloudflare/worker.mjs');
  const go = (h, method = 'GET', body) => runApi(h, new Request('https://x.test/api/t', { method, body, headers: { 'content-type': 'application/json' } }), new URL('https://x.test/api/t'), {});
  let r = await go((req, res) => { res.setHeader('Set-Cookie', ['a=1; Path=/', 'b=2; Path=/']); res.status(201).json({ got: req.body.x }); }, 'POST', JSON.stringify({ x: 5 }));
  assert.equal(r.status, 201); assert.deepEqual(await r.json(), { got: 5 }); assert.equal(r.headers.getSetCookie().length, 2);
  r = await go((req, res) => { res.statusCode = 302; res.setHeader('Location', '/account?verified=1'); return res.end(); });
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/account?verified=1');
  r = await go((req, res) => { res.setHeader('Content-Type', 'image/jpeg'); Readable.from([Buffer.from('ab'), Buffer.from('cd')]).pipe(res); });
  assert.equal(await r.text(), 'abcd', 'a piped file arrives whole, even after the handler has returned');
});

test('Cloudflare: every vercel.json header and redirect rule is copied', async () => {
  const fs = await import('node:fs');
  const { headersFile, redirectsFile } = await import('../tools/build-cloudflare.mjs');
  const h = headersFile();
  for (const rule of JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url))).headers) {
    if (rule.source.startsWith('/api/')) continue;
    for (const x of rule.headers) assert.ok(h.includes(`${x.key}: ${x.value}`), `${rule.source} ${x.key}`);
  }
  assert.match(h, /^\/coach\n  X-Robots-Tag: noindex, nofollow/m);
  const on = { redirects: [{ source: '/book', destination: 'https://app.example/pt', permanent: false }, { source: '/((?!api/).*)', has: [{ type: 'host', value: 'x' }], destination: 'https://y/$1', permanent: true }] };
  assert.equal(redirectsFile(on), '/book https://app.example/pt 302\n', 'switch-over redirects copied; the vercel.app one left out');
});
