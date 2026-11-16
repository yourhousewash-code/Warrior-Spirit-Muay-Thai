/* Nightly database copy (Agent Rules 3f, order A-069; docs/RECOVERY.md).
   Reads every lasting key from the Upstash database through its plain REST interface (raw strings, so the copy is exact),
   squeezes it, encrypts it with BACKUP_KEY (AES-256-GCM) and saves one file a night to a "Warrior Spirit Backups" folder in
   the club's Google Drive: a different provider from Vercel and Upstash. Files older than 30 days are moved to the bin.
   Off until BACKUP_KEY is set (Steve's yes). The key must also be kept outside Vercel (Steve's password manager), or the
   copies can't be opened if Vercel is lost. Restore: tools/restore-backup.mjs (into an empty database). */
import crypto from 'node:crypto';
import zlib from 'node:zlib';

/* Short-lived keys that expire by themselves and aren't worth keeping. */
const SKIP = [/^rl:/, /^booklock:/, /^classlock:/];
export const KEEP_DAYS = 30;
const PREFIX = 'warrior-spirit-backup-';

function conn(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL, token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('No database settings.');
  return { url: url.replace(/\/$/, ''), token };
}
async function pipeline(c, cmds) {
  const out = [];
  for (let i = 0; i < cmds.length; i += 200) {
    const r = await fetch(`${c.url}/pipeline`, { method: 'POST', headers: { authorization: `Bearer ${c.token}`, 'content-type': 'application/json' }, body: JSON.stringify(cmds.slice(i, i + 200)) });
    if (!r.ok) throw new Error(`database answered ${r.status}`);
    for (const x of await r.json()) { if (x.error) throw new Error(x.error); out.push(x.result); }
  }
  return out;
}
const one = async (c, cmd) => (await pipeline(c, [cmd]))[0];

/* Every lasting key with its type, value and time left to live (ms, or -1). */
export async function exportAll(env) {
  const c = conn(env), keys = [];
  let cursor = '0';
  do { const [next, batch] = await one(c, ['SCAN', cursor, 'COUNT', '500']); cursor = String(next); keys.push(...batch); } while (cursor !== '0');
  const keep = [...new Set(keys)].filter(k => !SKIP.some(re => re.test(k))).sort();
  const types = await pipeline(c, keep.map(k => ['TYPE', k]));
  const ttls = await pipeline(c, keep.map(k => ['PTTL', k]));
  const read = { string: k => ['GET', k], hash: k => ['HGETALL', k], zset: k => ['ZRANGE', k, '0', '-1', 'WITHSCORES'], set: k => ['SMEMBERS', k], list: k => ['LRANGE', k, '0', '-1'] };
  const items = keep.map((k, i) => ({ k, t: types[i], ttl: Number(ttls[i]) })).filter(x => read[x.t]);
  const vals = await pipeline(c, items.map(x => read[x.t](x.k)));
  items.forEach((x, i) => { x.v = vals[i]; });
  return { site: 'warriorspiritmuaythai.co.uk', made: new Date().toISOString(), count: items.length, items };
}

/* Writes a copy back. Refuses a database that already has data, unless told to replace it. */
export async function importAll(dump, env, { replace = false } = {}) {
  const c = conn(env);
  if (!replace) { const [, first] = await one(c, ['SCAN', '0', 'COUNT', '10']); if (first.length) throw new Error('That database isn’t empty. Restore into an empty one, or confirm replacing it.'); }
  const cmds = [];
  for (const x of dump.items) {
    cmds.push(['DEL', x.k]);
    if (x.t === 'string') cmds.push(['SET', x.k, x.v]);
    if (x.t === 'hash' && x.v.length) cmds.push(['HSET', x.k, ...x.v]);
    if (x.t === 'zset' && x.v.length) { const a = []; for (let i = 0; i < x.v.length; i += 2) a.push(x.v[i + 1], x.v[i]); cmds.push(['ZADD', x.k, ...a]); }
    if (x.t === 'set' && x.v.length) cmds.push(['SADD', x.k, ...x.v]);
    if (x.t === 'list' && x.v.length) cmds.push(['RPUSH', x.k, ...x.v]);
    if (x.ttl > 0) cmds.push(['PEXPIRE', x.k, String(x.ttl)]);
  }
  await pipeline(c, cmds);
  return dump.items.length;
}

/* Squeeze and lock: AES-256-GCM with a 32-byte key given as base64. */
export function seal(dump, keyB64) {
  const key = Buffer.from(String(keyB64 || ''), 'base64');
  if (key.length !== 32) throw new Error('BACKUP_KEY must be 32 bytes, base64.');
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(zlib.gzipSync(Buffer.from(JSON.stringify(dump)))), c.final()]);
  return JSON.stringify({ v: 1, made: dump.made, count: dump.count, alg: 'aes-256-gcm+gzip', iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') });
}
export function open(text, keyB64) {
  const f = JSON.parse(text), key = Buffer.from(String(keyB64 || ''), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(f.iv, 'base64'));
  d.setAuthTag(Buffer.from(f.tag, 'base64'));
  return JSON.parse(zlib.gunzipSync(Buffer.concat([d.update(Buffer.from(f.data, 'base64')), d.final()])).toString());
}

/* The nightly job: export, seal, save to Drive, tidy old copies. Returns a short report; never throws into the caller. */
export async function nightlyBackup({ accessToken, backupFolder, env = process.env, now = new Date() } = {}) {
  if (!env.BACKUP_KEY) return { ok: false, skipped: 'BACKUP_KEY not set' };
  try {
    const dump = await exportAll(env), body = seal(dump, env.BACKUP_KEY);
    const token = await accessToken(), folder = await backupFolder(token);
    const name = `${PREFIX}${now.toISOString().slice(0, 10)}.json.enc`, boundary = 'ws' + crypto.randomBytes(8).toString('hex');
    const multipart = `--${boundary}\r\ncontent-type: application/json\r\n\r\n${JSON.stringify({ name, parents: [folder], mimeType: 'application/octet-stream' })}\r\n--${boundary}\r\ncontent-type: application/octet-stream\r\n\r\n${body}\r\n--${boundary}--`;
    const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,size', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` }, body: multipart });
    const uj = await up.json().catch(() => ({}));
    if (!up.ok || !uj.id) throw new Error(`Drive upload answered ${up.status}`);
    /* keep 30 days */
    const q = encodeURIComponent(`'${folder}' in parents and name contains '${PREFIX}' and trashed = false`);
    const ls = await (await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=200`, { headers: { authorization: `Bearer ${token}` } })).json().catch(() => ({}));
    const cutoff = new Date(now.getTime() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
    let binned = 0;
    for (const f of ls.files || []) {
      const day = (f.name.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
      if (day && day < cutoff) { const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ trashed: true }) }); if (r.ok) binned++; }
    }
    return { ok: true, name, keys: dump.count, bytes: body.length, binned };
  } catch (e) {
    console.error('nightly backup failed', e?.message);
    return { ok: false, error: String(e?.message || e) };
  }
}
