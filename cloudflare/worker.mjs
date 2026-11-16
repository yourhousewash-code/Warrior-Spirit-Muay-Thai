// Cloudflare Worker entry (WS-011, A-074): runs the site's existing api/*.js files unchanged on Cloudflare Workers.
// Not deployed. Plan: The Manor, warrior-spirit-cloudflare-move-plan.md.
// Step 3 (16 Nov 2026): every API file except gdrive.js, the page addresses Vercel rewrote (/team/:id, /calendar/...),
// the security headers on API answers, and the two daily jobs. Pages, photos and fonts come from Workers static assets,
// copied by tools/build-cloudflare.mjs (with _headers and _redirects made from vercel.json).
// Still to do before a move: R2 in place of Vercel Blob (uploads, site, profile), photo resizing in the browser
// (gdrive.js uses sharp, which can't run on Workers), and an email route (WS-011 COST, DATA and MAIL questions).
import { Writable } from 'node:stream';
import auth from '../api/auth.js';
import cal from '../api/cal.js';
import cron from '../api/cron.js';
import enquiry from '../api/enquiry.js';
import profile from '../api/profile.js';
import pt from '../api/pt.js';
import site from '../api/site.js';
import team from '../api/team.js';
import uploads from '../api/uploads.js';
import vercel from '../vercel.json' with { type: 'json' };

export const routes = { auth, cal, cron, enquiry, profile, pt, site, team, uploads };

/* Exact-address redirects from vercel.json (the switch-over writes /book and /calendar/club.ics there when it's on).
   Plain pages also get them from _redirects; this covers the addresses the Worker answers first. */
const REDIRECTS = (vercel.redirects || []).filter(r => !r.has && !/[(:*]/.test(r.source));

/* The same headers vercel.json gives every answer (static files get theirs from _headers). */
const SECURITY = {
  'Strict-Transport-Security': 'max-age=63072000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
const NO_STORE = /^(auth|pt|uploads|enquiry|gdrive)$/;

/* The addresses vercel.json rewrites to an API file. */
export function route(url) {
  let m;
  if ((m = url.pathname.match(/^\/api\/([a-z]+)\/?$/))) return { name: m[1], query: Object.fromEntries(url.searchParams) };
  if ((m = url.pathname.match(/^\/team\/([^/]+)\/?$/))) return { name: 'team', query: { ...Object.fromEntries(url.searchParams), id: decodeURIComponent(m[1]) } };
  if (url.pathname === '/calendar/club.ics') return { name: 'cal', query: { ...Object.fromEntries(url.searchParams), feed: 'club' } };
  if ((m = url.pathname.match(/^\/calendar\/me\/([^/]+)$/))) return { name: 'cal', query: { ...Object.fromEntries(url.searchParams), feed: 'me', t: decodeURIComponent(m[1]) } };
  return null;
}

/* A Node-style response the handlers can set headers on, .json() into, .end() or pipe a file into. */
function nodeRes() {
  const chunks = [], headers = new Headers();
  let piped = false, finished;
  const done = new Promise(ok => { finished = ok; });
  const res = new Writable({ write(c, enc, cb) { chunks.push(typeof c === 'string' ? Buffer.from(c, enc) : Buffer.from(c)); cb(); } });
  res.on('finish', finished); res.on('error', finished);
  res.on('pipe', () => { piped = true; });
  res.statusCode = 200;
  res.status = s => { res.statusCode = s; return res; };
  res.setHeader = (k, v) => {
    if (k.toLowerCase() === 'set-cookie') { headers.delete('set-cookie'); for (const c of [].concat(v)) headers.append('set-cookie', c); }
    else headers.set(k, String(v));
    return res;
  };
  res.getHeader = k => k.toLowerCase() === 'set-cookie' ? headers.getSetCookie() : headers.get(k) ?? undefined;
  res.removeHeader = k => { headers.delete(k); return res; };
  res.json = d => { if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(d)); return res; };
  res.send = d => (typeof d === 'object' && d !== null && !Buffer.isBuffer(d) ? res.json(d) : res.end(d));
  return { res, headers, chunks, done, isPiped: () => piped };
}

async function nodeReq(request, url, query) {
  const headers = Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v]));
  if (!headers['x-forwarded-for'] && headers['cf-connecting-ip']) headers['x-forwarded-for'] = headers['cf-connecting-ip'];
  const text = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();
  let body = {};
  if (text) { try { body = JSON.parse(text); } catch { body = (headers['content-type'] || '').includes('application/x-www-form-urlencoded') ? Object.fromEntries(new URLSearchParams(text)) : text; } }
  return { method: request.method, url: url.pathname + url.search, query, headers, body, cookies: {} };
}

export async function runApi(handler, request, url, query) {
  const req = await nodeReq(request, url, query), { res, headers, chunks, done, isPiped } = nodeRes();
  const t0 = Date.now();
  await handler(req, res);
  if (!res.writableEnded && !isPiped()) res.end();
  await done;
  headers.set('x-ms', String(Date.now() - t0));
  return new Response(request.method === 'HEAD' || [204, 304].includes(res.statusCode) ? null : Buffer.concat(chunks), { status: res.statusCode, headers });
}

function copyEnv(env) { for (const [k, v] of Object.entries(env || {})) if (typeof v === 'string') process.env[k] = v; }

export default {
  async fetch(request, env) {
    copyEnv(env);
    const url = new URL(request.url), moved = REDIRECTS.find(x => x.source === url.pathname);
    if (moved) return new Response(null, { status: moved.permanent ? 301 : 302, headers: { Location: new URL(moved.destination, url).href } });
    const r = route(url);
    if (!r) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    const handler = routes[r.name];
    if (!handler) return new Response(JSON.stringify({ error: 'Not available here yet.' }), { status: 404, headers: { 'content-type': 'application/json' } });
    const out = await runApi(handler, request, url, r.query);
    for (const [k, v] of Object.entries(SECURITY)) if (!out.headers.has(k)) out.headers.set(k, v);
    if (NO_STORE.test(r.name)) out.headers.set('Cache-Control', 'no-store');
    return out;
  },
  /* The two daily jobs (vercel.json crons: 06:00 and 17:00 UTC). */
  async scheduled(event, env, ctx) {
    copyEnv(env);
    const run = event.cron === '0 17 * * *' ? 'evening' : 'morning';
    const url = new URL(`https://www.warriorspiritmuaythai.co.uk/api/cron?run=${run}`);
    const request = new Request(url, { headers: { authorization: `Bearer ${env.CRON_SECRET || ''}`, 'user-agent': 'cloudflare-cron' } });
    ctx.waitUntil(runApi(cron, request, url, { run }).then(async r => console.log('cron', run, r.status, await r.text())));
  },
};
