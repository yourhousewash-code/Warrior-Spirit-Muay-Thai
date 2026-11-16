// Cloudflare Worker entry (WS-011, A-074): runs the site's existing api/*.js files unchanged on Cloudflare Workers.
// Spike 16 Nov 2026 (wrangler dev, local runtime): sign-up, log-in (scrypt), timetable and enquiry all worked through this adapter.
// Still to add: the other API files, static assets, cron triggers, R2 instead of Vercel Blob, email, browser-side photo resizing.
import auth from '../api/auth.js';
import pt from '../api/pt.js';
import enquiry from '../api/enquiry.js';
const routes = { auth, pt, enquiry };
export default {
  async fetch(request, env) {
    for (const [k, v] of Object.entries(env)) if (typeof v === 'string') process.env[k] = v;
    const url = new URL(request.url), m = url.pathname.match(/^\/api\/([a-z]+)$/);
    if (!m || !routes[m[1]]) return new Response('not found', { status: 404 });
    const headers = Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v]));
    const text = request.method === 'GET' ? '' : await request.text();
    let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = text; }
    const req = { method: request.method, url: url.pathname + url.search, query: Object.fromEntries(url.searchParams), headers, body };
    const out = { status: 200, headers: new Headers(), body: '' };
    const res = {
      statusCode: 200,
      status(s) { this.statusCode = s; return this; },
      setHeader(k, v) { if (k.toLowerCase() === 'set-cookie') { out.headers.delete('set-cookie'); for (const c of [].concat(v)) out.headers.append('set-cookie', c); } else out.headers.set(k, String(v)); return this; },
      getHeader(k) { const v = out.headers.get(k); return k.toLowerCase() === 'set-cookie' ? (out.headers.getSetCookie ? out.headers.getSetCookie() : v) : v; },
      json(d) { out.headers.set('content-type', 'application/json'); out.body = JSON.stringify(d); },
      end(b) { if (b !== undefined) out.body = b; },
    };
    const t0 = Date.now();
    await routes[m[1]](req, res);
    out.headers.set('x-ms', String(Date.now() - t0));
    return new Response(out.body, { status: res.statusCode, headers: out.headers });
  },
};
