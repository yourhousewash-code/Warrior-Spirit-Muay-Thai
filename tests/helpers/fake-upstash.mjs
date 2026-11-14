// A tiny stand-in for the Upstash Redis REST API, so the sign-in and form code can be tested without the real database.
// It speaks just enough of the protocol (single commands, /pipeline, base64 replies) for the commands this site uses.
import http from 'node:http';

export async function startFakeUpstash() {
  const kv = new Map(); // key -> { v, exp }  (v: string | Map for hashes | Map for sorted sets)
  const live = k => { const e = kv.get(k); if (e && e.exp && e.exp < Date.now()) { kv.delete(k); return undefined; } return e; };
  const hash = k => { let e = live(k); if (!e) { e = { v: new Map(), t: 'hash' }; kv.set(k, e); } return e.v; };
  const run = ([cmd, ...a]) => {
    const c = String(cmd).toLowerCase();
    switch (c) {
      case 'get': return live(a[0])?.v ?? null;
      case 'set': {
        const e = { v: String(a[1]) };
        for (let i = 2; i < a.length; i++) if (String(a[i]).toLowerCase() === 'ex') e.exp = Date.now() + Number(a[i + 1]) * 1000;
        kv.set(a[0], e); return 'OK';
      }
      case 'del': { let n = 0; for (const k of a) if (kv.delete(k)) n++; return n; }
      case 'exists': return a.filter(k => live(k)).length;
      case 'incr': { const e = live(a[0]) || { v: '0' }; e.v = String(Number(e.v) + 1); kv.set(a[0], e); return Number(e.v); }
      case 'expire': { const e = live(a[0]); if (!e) return 0; e.exp = Date.now() + Number(a[1]) * 1000; return 1; }
      case 'hset': { const h = hash(a[0]); let n = 0; for (let i = 1; i < a.length; i += 2) { if (!h.has(a[i])) n++; h.set(a[i], String(a[i + 1])); } return n; }
      case 'hget': return live(a[0])?.v.get?.(a[1]) ?? null;
      case 'hdel': { const e = live(a[0]); let n = 0; if (e) for (const f of a.slice(1)) if (e.v.delete(f)) n++; return n; }
      case 'hgetall': { const e = live(a[0]); return e ? [...e.v].flat() : []; }
      case 'hincrby': { const h = hash(a[0]); const v = Number(h.get(a[1]) || 0) + Number(a[2]); h.set(a[1], String(v)); return v; }
      case 'zadd': { const e = live(a[0]) || { v: new Map(), t: 'zset' }; kv.set(a[0], e); for (let i = 1; i < a.length; i += 2) e.v.set(String(a[i + 1]), Number(a[i])); return 1; }
      case 'zrange': { const e = live(a[0]); if (!e) return []; return [...e.v].filter(([, s]) => s >= Number(a[1]) && s <= Number(a[2])).sort((x, y) => x[1] - y[1]).map(([m]) => m); }
      default: throw new Error(`fake upstash: ${c} not supported`);
    }
  };
  const b64 = x => typeof x === 'string' ? (x === 'OK' ? x : Buffer.from(x).toString('base64')) : Array.isArray(x) ? x.map(b64) : x;
  const server = http.createServer((req, res) => {
    let raw = ''; req.on('data', d => raw += d);
    req.on('end', () => {
      const enc = req.headers['upstash-encoding'] === 'base64';
      const out = r => enc ? b64(r) : r;
      try {
        const body = JSON.parse(raw);
        const reply = req.url.startsWith('/pipeline') || req.url.startsWith('/multi-exec')
          ? body.map(cmd => { try { return { result: out(run(cmd)) }; } catch (e) { return { error: e.message }; } })
          : { result: out(run(body)) };
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(reply));
      } catch (e) { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); }
    });
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, kv, keys: prefix => [...kv.keys()].filter(k => k.startsWith(prefix) && live(k)), close: () => new Promise(ok => server.close(ok)) };
}

// A pretend request and response, the way Vercel hands them to an API file.
export function call(handler, { method = 'POST', query = {}, body = {}, cookie = '', ip = '203.0.113.7' } = {}) {
  const headers = {}; let status = 200, json;
  const res = {
    statusCode: 200,
    status(s) { status = s; this.statusCode = s; return this; },
    setHeader(k, v) { headers[k.toLowerCase()] = v; return this; },
    getHeader(k) { return headers[k.toLowerCase()]; },
    json(d) { json = d; }, end() {},
  };
  const req = { method, query, body, headers: { cookie, 'x-forwarded-for': ip } };
  return Promise.resolve(handler(req, res)).then(() => ({ status: res.statusCode !== 200 ? res.statusCode : status, json, headers }));
}

// Turns Set-Cookie headers into a Cookie header for the next request.
export function cookieFrom(setCookie, prev = '') {
  const jar = Object.fromEntries(prev.split(';').map(s => s.trim()).filter(Boolean).map(s => [s.slice(0, s.indexOf('=')), s.slice(s.indexOf('=') + 1)]));
  for (const c of [].concat(setCookie || [])) { const kv = c.split(';')[0]; const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (v) jar[k] = v; else delete jar[k]; }
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}
