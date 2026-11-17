// Checks what the content security policy in vercel.json would block if it were ENFORCED (today it is report-only).
// Opens every page in a real browser with the policy switched to enforced and lists each thing it would refuse.
//   node tools/csp-check.mjs                                    this folder, served locally (API answers are stubbed)
//   node tools/csp-check.mjs https://www.warriorspiritmuaythai.co.uk   a live or preview site (its own sitemap), read-only
// Needs Playwright with Chromium (npm i -g playwright && npx playwright install chromium). Changes nothing anywhere.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rule = (vercel.headers || []).flatMap(r => r.headers).find(h => /^Content-Security-Policy(-Report-Only)?$/.test(h.key));
if (!rule) { console.error('No content security policy in vercel.json.'); process.exit(1); }
const policy = rule.value;
const extra = ['/coach', '/account', '/book'];

let base = process.argv[2], server;
if (!base) {
  const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2', json: 'application/json', webmanifest: 'application/manifest+json', mp4: 'video/mp4', xml: 'application/xml', txt: 'text/plain' };
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{}'); }
    if (p === '/') p = '/index.html';
    let f = path.join(root, p);
    if (!f.startsWith(root)) { res.writeHead(400); return res.end(); }
    if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': types[f.split('.').pop()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}`;
}
base = base.replace(/\/$/, '');
const sitemap = server ? fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8') : await (await fetch(base + '/sitemap.xml')).text();
const pages = [...new Set([...sitemap.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map(m => m[1]).concat(extra))];

const browser = await chromium.launch(), found = {};
for (const p of pages) {
  const page = await browser.newPage();
  await page.route('**/*', async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const resp = await route.fetch(), headers = { ...resp.headers(), 'content-security-policy': policy };
    delete headers['content-security-policy-report-only'];
    return route.fulfill({ response: resp, headers });
  });
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.effectiveDirective} blocked ${e.blockedURI || '(inline)'} ${e.sourceFile ? `at ${e.sourceFile}:${e.lineNumber}` : ''}`.trim())); });
  const msgs = [];
  page.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text())) msgs.push(m.text().slice(0, 240)); });
  try { await page.goto(base + p, { waitUntil: 'networkidle', timeout: 30000 }); } catch (e) { msgs.push(`did not finish loading: ${e.message.split('\n')[0].slice(0, 100)}`); }
  await page.waitForTimeout(300);
  const v = await page.evaluate(() => window.__csp).catch(() => []);
  if (v.length || msgs.length) found[p] = [...new Set([...v, ...msgs])];
  await page.close();
}
await browser.close();
server?.close();
console.log(`${pages.length} pages opened at ${base} with the policy enforced.`);
if (!Object.keys(found).length) console.log('Nothing would be blocked.');
else for (const [p, list] of Object.entries(found)) console.log(`\n${p}\n  ${list.join('\n  ')}`);
process.exitCode = Object.keys(found).length ? 1 : 0;
