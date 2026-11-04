import crypto from 'node:crypto';
import { redis, COACHES, SESS, ADMIN_IDS, setSession, setSigned, readSigned, clearSession, coachEmail, mail, mailReady, rateLimit } from './core.js';

/* Two-step sign-in for the coach area (Steve, 4 Nov 2026): required for owners (Jay and Steve), optional for other coaches.
   After the right password we email a 6-digit code, unless this device is trusted. Codes are stored hashed and work once.

   Database keys (never document values):
     coach:<id>:2fa              { on, at }  a coach (not an owner) has switched it on
     coach:<id>:2fa:login|enable { h, n, at }  the code, hashed, for 10 minutes. "n" ties it to the browser that asked for it
     coach:<id>:2fa:login:bad    wrong tries for that code (5 and it stops working)
     coach:<id>:2fa:wait         30 seconds between "Send a new code"
     rl:2fa:send:<id>            codes sent this hour (5 at most)
     coach:<id>:2fa:nopass       times an owner with no email was let in without a code
     coach:<id>:devices          trusted devices: device id → { id, name, added, last, exp }
     coach:sess                  session generation and removed devices, per coach (read in loadCoaches, checked in coachSession)
   Cookies: ws_2fa (the half-finished sign-in, 10 minutes), ws_trust_<id> (a trusted device, 30 days). */

export const CODE_SECS = 600, MAX_TRIES = 5, CODES_PER_HOUR = 5, RESEND_WAIT = 30, TRUST_DAYS = 30, MAX_DEVICES = 10;
/* An owner with no email for codes is let in this many times, with a warning, then has to ask the other owner to add one. */
export const NO_EMAIL_PASSES = 1;

export const isOwner = cid => ADMIN_IDS.includes(cid);
const parse = v => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };

/* 'required' (owners), 'on' or 'off' */
export async function twoStepState(cid) {
  if (isOwner(cid)) return 'required';
  const s = await redis.get(`coach:${cid}:2fa`);
  return s && s.on ? 'on' : 'off';
}

/* Who to ask for help: the other owner, or both owners for a coach. */
export function askWho(cid) {
  const names = ADMIN_IDS.filter(o => o !== cid && COACHES[o]?.active).map(o => COACHES[o].first);
  return names.length ? names.join(' or ') : 'the club';
}
export function maskEmail(e) {
  const [u, d] = String(e || '').split('@');
  if (!d) return '';
  return `${u.slice(0, Math.min(2, Math.max(1, u.length - 1)))}•••@${d}`;
}
export function deviceName(ua = '') {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows'
    : /CrOS/.test(ua) ? 'Chromebook' : /Macintosh|Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  const br = /Edg[A]?\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\//.test(ua) ? 'Opera'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
  return br && os ? `${br} on ${os}` : (br || os || 'Unknown device');
}

/* ---------- sessions ---------- */
/* m says how the session started: 'p' password only (two-step off), '2' password and code, 't' password on a trusted
   device, 'r' reset link from their email, 'n' an owner with no email let in without a code. */
export function startSession(res, cid, m, dv) {
  setSession(res, 'ws_coach', { id: cid, g: SESS[cid]?.g || 0, m, ...(dv ? { dv } : {}) }, 30);
}
async function readSess(cid) { return parse(await redis.hget('coach:sess', cid)) || {}; }
async function saveSess(cid, s) { SESS[cid] = s; await redis.hset('coach:sess', { [cid]: JSON.stringify(s) }); }
function pruneOut(out) { const keep = {}, cut = Date.now() - 31 * 864e5; for (const [k, t] of Object.entries(out || {})) if (t > cut) keep[k] = t; return keep; }
/* Signs the coach out on every device and forgets every trusted device ("Sign out everywhere", and any password change). */
export async function endAllSessions(cid) {
  const s = await readSess(cid);
  await saveSess(cid, { g: (s.g || 0) + 1, out: pruneOut(s.out) });
  await redis.del(`coach:${cid}:devices`, `coach:${cid}:2fa:login`);
}

/* ---------- trusted devices ---------- */
const devKey = cid => `coach:${cid}:devices`;
export const trustCookie = cid => `ws_trust_${cid}`;
export async function listDevices(cid) {
  const all = (await redis.hgetall(devKey(cid))) || {};
  const now = Date.now(), list = [], gone = [];
  for (const [k, v] of Object.entries(all)) { const d = parse(v); if (d && d.exp > now) list.push(d); else gone.push(k); }
  if (gone.length) await redis.hdel(devKey(cid), ...gone);
  return list.sort((a, b) => (b.last || 0) - (a.last || 0));
}
/* The trusted device record for this browser, if its cookie is good and the record hasn't been removed or run out. */
export async function trustedDevice(req, cid) {
  const t = readSigned(req, trustCookie(cid));
  if (!t || t.id !== cid || !t.dv) return null;
  const d = parse(await redis.hget(devKey(cid), t.dv));
  return d && d.exp > Date.now() ? d : null;
}
export async function touchDevice(cid, d) { d.last = Date.now(); await redis.hset(devKey(cid), { [d.id]: JSON.stringify(d) }); }
export async function trustThisDevice(req, res, cid) {
  const list = await listDevices(cid);
  if (list.length >= MAX_DEVICES) await removeDevices(cid, list.slice(MAX_DEVICES - 1).map(d => d.id)); // least recently used
  const now = Date.now(), dv = crypto.randomBytes(12).toString('base64url');
  const d = { id: dv, name: deviceName(req.headers['user-agent']), added: now, last: now, exp: now + TRUST_DAYS * 864e5 };
  await redis.hset(devKey(cid), { [dv]: JSON.stringify(d) });
  setSigned(res, trustCookie(cid), { id: cid, dv }, TRUST_DAYS * 86400);
  return dv;
}
/* Forgets the devices and signs each of them out. */
export async function removeDevices(cid, ids) {
  if (!ids.length) return;
  await redis.hdel(devKey(cid), ...ids);
  const s = await readSess(cid), out = pruneOut(s.out);
  for (const i of ids) out[i] = Date.now();
  await saveSess(cid, { g: s.g || 0, out });
}
export function forgetTrustCookie(res, cid) { clearSession(res, trustCookie(cid)); }

/* ---------- codes ---------- */
const codeKey = (cid, p) => `coach:${cid}:2fa:${p}`;
const badKey = (cid, p) => `coach:${cid}:2fa:${p}:bad`;
function codeHash(cid, p, n, code) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(`${cid}|${p}|${n}|${code}`).digest('hex');
}
/* p is 'login' or 'enable' (the test code a coach enters to switch two-step on). Returns { to, n } or { error, status }. */
export async function sendCode(cid, p, { resend = false } = {}) {
  const to = await coachEmail(cid);
  if (!to) return { error: 'There’s no email address on your account, so we can’t send a code. Add one under Booking emails.', status: 400, noEmail: true };
  if (!mailReady()) return { error: `The website can’t send emails at the moment, so we can’t send your code. Tell ${askWho(cid)}: the email settings in Vercel need checking.`, status: 503 };
  const wait = await redis.set(`coach:${cid}:2fa:wait`, '1', resend ? { nx: true, ex: RESEND_WAIT } : { ex: RESEND_WAIT });
  if (!wait) return { error: 'We’ve just sent one. Give it a few seconds, then ask again.', status: 429 };
  if (!(await rateLimit(`2fa:send:${cid}`, CODES_PER_HOUR, 3600))) return { error: `That’s ${CODES_PER_HOUR} codes in the last hour, which is the most we send. Use the newest code you have, or try again later.`, status: 429 };
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0'), n = crypto.randomBytes(12).toString('base64url');
  await redis.set(codeKey(cid, p), { h: codeHash(cid, p, n, code), n, at: Date.now() }, { ex: CODE_SECS });
  await redis.del(badKey(cid, p));
  const sent = await mail(to, p === 'enable' ? 'Your Warrior Spirit code to switch on two-step sign-in' : 'Your Warrior Spirit sign-in code', [
    p === 'enable'
      ? `Your Warrior Spirit code to switch on two-step sign-in is ${code}. It runs out in 10 minutes. If this wasn’t you, change your password.`
      : `Your Warrior Spirit sign-in code is ${code}. It runs out in 10 minutes. If this wasn’t you, change your password.`,
  ]);
  if (!sent) { await redis.del(codeKey(cid, p)); return { error: 'We couldn’t send the code just now. Please try again in a minute.', status: 502 }; }
  return { to: maskEmail(to), n };
}
/* Checks a code. n (from the ws_2fa cookie) must match for sign-in codes. Single use; 5 wrong tries and it stops working. */
export async function checkCode(cid, p, n, input) {
  const rec = await redis.get(codeKey(cid, p));
  if (!rec || !rec.h || (n !== null && rec.n !== n)) return { error: 'That code has run out. Send a new code.', status: 410, expired: true };
  const code = String(input ?? '').replace(/\D/g, '');
  const good = code.length === 6 && crypto.timingSafeEqual(Buffer.from(rec.h, 'hex'), Buffer.from(codeHash(cid, p, rec.n, code), 'hex'));
  if (good) {
    if (!(await redis.del(codeKey(cid, p)))) return { error: 'That code has already been used. Send a new code.', status: 410, expired: true };
    await redis.del(badKey(cid, p));
    return { ok: true };
  }
  const bad = await redis.incr(badKey(cid, p));
  if (bad === 1) await redis.expire(badKey(cid, p), CODE_SECS);
  if (bad >= MAX_TRIES) {
    await redis.del(codeKey(cid, p), badKey(cid, p));
    return { error: `That’s ${MAX_TRIES} wrong codes, so this code has stopped working. Send a new code.`, status: 429, expired: true };
  }
  const left = MAX_TRIES - bad;
  return { error: `That code isn’t right. You have ${left} ${left === 1 ? 'try' : 'tries'} left.`, status: 401 };
}
export const challenge = req => readSigned(req, 'ws_2fa');
export const setChallenge = (res, cid, n) => setSigned(res, 'ws_2fa', { id: cid, n, g: SESS[cid]?.g || 0 }, CODE_SECS);
export const clearChallenge = res => clearSession(res, 'ws_2fa');

/* ---------- an owner with no email ---------- */
/* Lets the owner in without a code NO_EMAIL_PASSES times, logs it and emails the other owner. False once used up. */
export async function noEmailPass(cid) {
  const n = await redis.incr(`coach:${cid}:2fa:nopass`);
  if (n > NO_EMAIL_PASSES) { console.warn(`[two-step] ${cid} has no email for sign-in codes and has used the pass. Sign-in refused.`); return false; }
  console.warn(`[two-step] ${cid} has no email for sign-in codes. Let in without a code (${n} of ${NO_EMAIL_PASSES}).`);
  const who = COACHES[cid]?.first || cid;
  for (const o of ADMIN_IDS) {
    if (o === cid || !COACHES[o]?.active) continue;
    const e = await coachEmail(o);
    if (e) await mail(e, `${who} signed in without a sign-in code`, [
      `Hi ${COACHES[o].first},`,
      `${who} has just signed in to the coach area without a sign-in code, because there’s no email address on ${who}’s account for the codes. This is allowed once.`,
      `Please make sure ${who} adds an email: ${who} can do it in Settings, or you can in Manage coaches → Change email.`,
      'If this wasn’t expected, change the password for that account straight away.',
    ]);
  }
  return true;
}
