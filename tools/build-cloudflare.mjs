// Gets the site ready for Cloudflare Workers (WS-011 step 3; not deployed).
// Copies the public files (what Vercel serves: everything except .vercelignore, the API code and the project files)
// into cloudflare/public, and turns vercel.json's headers and redirects into Cloudflare's _headers and _redirects files.
// Run with: node tools/build-cloudflare.mjs   (after npm run pages, so the pages and vercel.json are current)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'cloudflare', 'public');
const ignored = new Set(fs.readFileSync(path.join(root, '.vercelignore'), 'utf8').split('\n').map(s => s.trim().replace(/\/$/, '')).filter(Boolean));
const notPublic = new Set(['api', 'node_modules', 'package.json', 'package-lock.json', 'vercel.json', 'README.md', 'cloudflare']);
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

/* vercel.json "source" patterns -> Cloudflare _headers paths. Unknown shapes stop the build, so a new rule is never dropped quietly. */
export function headerPaths(source) {
  if (source === '/(.*)') return ['/*'];
  let m;
  if ((m = source.match(/^\/\(([a-z|-]+)\)\(\.\*\)$/))) return m[1].split('|').flatMap(p => [`/${p}`, `/${p}.html`, `/${p}/*`]);
  if ((m = source.match(/^\/([a-z0-9/_-]+)\/\(\.\*\)$/))) return [`/${m[1]}/*`];
  if (source.startsWith('/api/')) return []; // API answers come from the Worker, which sets these itself
  throw new Error(`build-cloudflare: don't know how to copy the vercel.json header rule for ${source}`);
}

export function headersFile(v = vercel) {
  const lines = [];
  for (const rule of v.headers || []) for (const p of headerPaths(rule.source)) {
    lines.push(p, ...rule.headers.map(h => `  ${h.key}: ${h.value}`), '');
  }
  return lines.join('\n');
}

/* Redirects that don't depend on the host name (the *.vercel.app one has no meaning on Cloudflare). */
export function redirectsFile(v = vercel) {
  return (v.redirects || []).filter(r => !r.has).map(r => `${r.source} ${r.destination} ${r.permanent ? 301 : 302}`).join('\n') + '\n';
}

function copy(from, to) {
  const st = fs.statSync(from);
  if (st.isDirectory()) { fs.mkdirSync(to, { recursive: true }); for (const f of fs.readdirSync(from)) copy(path.join(from, f), path.join(to, f)); }
  else fs.copyFileSync(from, to);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(root)) {
    if (f.startsWith('.') || ignored.has(f) || notPublic.has(f)) continue;
    copy(path.join(root, f), path.join(out, f)); n++;
  }
  fs.writeFileSync(path.join(out, '_headers'), headersFile());
  fs.writeFileSync(path.join(out, '_redirects'), redirectsFile());
  console.log(`cloudflare/public: ${n} top-level files and folders, plus _headers and _redirects`);
}
