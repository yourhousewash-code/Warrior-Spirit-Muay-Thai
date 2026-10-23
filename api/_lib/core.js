import { Redis } from '@upstash/redis';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

export const redis = Redis.fromEnv();

export const TZ = 'Europe/London';
export const SITE = process.env.SITE_URL || 'https://warrior-spirit-muay-thai.vercel.app';
export const GYM = 'Warrior Spirit Muay Thai & Kickboxing';
export const ADDRESS = 'Next Gen Fitness, Mount Grace Road, Potters Bar EN6 1RB';

/* Coaches. Starting password for all three is "Muaythai"; each coach can change it after logging in. */
export const COACHES = {
  jay:   { id: 'jay',   name: 'Jay Shepherd', first: 'Jay',   admin: true,  envEmail: 'COACH_EMAIL_JAY' },
  aaron: { id: 'aaron', name: 'Aaron Bekir',  first: 'Aaron', admin: false, envEmail: 'COACH_EMAIL_AARON' },
  kian:  { id: 'kian',  name: 'Kian Hughes',  first: 'Kian',  admin: false, envEmail: 'COACH_EMAIL_KIAN' },
};
export const START_PASSWORD = 'Muaythai';

/* What the session focuses on. */
export const TYPES = {
  'fundamentals': { name: 'Fundamentals' },
  'fitness-pads': { name: 'Fitness Pads' },
  'technique':    { name: 'Technique & Skills' },
  'fight-camp':   { name: 'Fight Camp' },
  'friend':       { name: 'Train with a friend', hidden: true }, // older bookings only
};
/* Who's training, and how long for. Each coach sets their own prices (in £) for every combination. */
export const FORMATS = {
  one:    { name: '1-to-1', people: 'Just you' },
  double: { name: 'Double', people: '2 people' },
  group:  { name: 'Group', people: '3 or more' },
};
export const DURATIONS = [60, 90, 120];
export const DEFAULT_PRICES = { one: { 60: 40, 90: 55, 120: 70 }, double: { 60: 45, 90: 65, 120: 80 }, group: { 60: 55, 90: 75, 120: 90 }, groupMax: 6 };
export async function getPrices(c) {
  const p = await redis.get(`coach:${c}:prices`);
  return p && typeof p === 'object' ? p : JSON.parse(JSON.stringify(DEFAULT_PRICES));
}
export const priceOf = (prices, format, mins) => { const v = prices?.[format]?.[mins]; return typeof v === 'number' && v > 0 ? v : null; };
export const minsLabel = m => m === 60 ? '1 hour' : m === 90 ? '1½ hours' : m === 120 ? '2 hours' : `${m} minutes`;

/* ---------- passwords ---------- */
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `scrypt$${salt}$${key}`;
}
export function checkPassword(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, key] = stored.split('$');
  if (!key) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const want = Buffer.from(key, 'hex');
  return want.length === test.length && crypto.timingSafeEqual(want, test);
}
export async function coachHash(id) {
  const h = await redis.get(`coach:${id}:hash`);
  return h || null;
}
export async function checkCoachPassword(id, pw) {
  const h = await coachHash(id);
  if (h) return checkPassword(pw, h);
  return pw === START_PASSWORD;
}

/* ---------- signed cookies ---------- */
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET is not set');
  return s;
}
function sign(data) {
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function unsign(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const want = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const d = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!d.exp || d.exp < Date.now()) return null;
    return d;
  } catch { return null; }
}
export function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
export function setSession(res, name, data, days) {
  const exp = Date.now() + days * 864e5;
  const v = sign({ ...data, exp });
  appendCookie(res, `${name}=${encodeURIComponent(v)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${days * 86400}`);
}
export function clearSession(res, name) {
  appendCookie(res, `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
function appendCookie(res, c) {
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, c) : c);
}
export function coachSession(req) {
  const d = unsign(cookies(req).ws_coach);
  return d && COACHES[d.id] ? COACHES[d.id] : null;
}
export function userSession(req) {
  const d = unsign(cookies(req).ws_user);
  return d && d.email ? d.email : null;
}

/* ---------- helpers ---------- */
export function send(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  res.json(data);
}
export function bad(res, msg, status = 400) { send(res, status, { error: msg }); }

/* Tells the site owner exactly what's missing in Vercel instead of a vague error. */
export function setupProblem() {
  const missing = [];
  if (!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)) missing.push('the Upstash Redis database (Vercel → Storage)');
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) missing.push('the SESSION_SECRET setting (Vercel → Settings → Environment Variables)');
  return missing.length ? `The booking system isn’t switched on yet. Missing: ${missing.join(' and ')}. Add it, then redeploy.` : null;
}
export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}
export function clean(s, max = 200) { return String(s ?? '').trim().slice(0, max); }
export function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
export function id(prefix) { return prefix + '_' + crypto.randomBytes(9).toString('base64url'); }
export async function rateLimit(key, max, windowSec) {
  const k = `rl:${key}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  return n <= max;
}
export function fmt(ms) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}
export async function coachEmail(cid) {
  const saved = await redis.get(`coach:${cid}:email`);
  return saved || process.env[COACHES[cid].envEmail] || '';
}

/* ---------- email ---------- */
let transport = null;
function mailer() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transport) transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}
export async function mail(to, subject, lines) {
  const t = mailer();
  const list = [].concat(to).filter(Boolean);
  if (!t || !list.length) { console.log('[mail skipped]', subject, list); return false; }
  const text = lines.join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${lines.map(l => l ? `<p style="margin:0 0 10px">${escapeHtml(l)}</p>` : '').join('')}<p style="margin:16px 0 0;color:#666;font-size:13px">${GYM}<br>${ADDRESS}</p></div>`;
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || `"Warrior Spirit Muay Thai" <${process.env.SMTP_USER}>`, to: list.join(', '), subject, text, html });
    return true;
  } catch (e) { console.error('[mail failed]', e.message); return false; }
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
