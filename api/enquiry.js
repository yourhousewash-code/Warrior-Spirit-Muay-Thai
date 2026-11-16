/* Website enquiries (free class, PT, kids, questions): saved for Jay and emailed to the gym. */
import { checkPhone } from './_lib/phone.js';
import { humanCheck, NOT_HUMAN } from './_lib/turnstile.js';
import {
  redis, COACHES, loadCoaches, send, bad, setupProblem, body, clean, validEmail, rateLimit, coachSession, coachEmail, mail, id, fmt, SITE,
} from './_lib/core.js';

export default async function handler(req, res) {
  const problem = setupProblem();
  if (problem) return bad(res, problem, 503);
  await loadCoaches();
  const action = clean(req.query.action, 20) || 'send';
  const b = body(req);
  try {
    if (action === 'send') {
      if (req.method !== 'POST') return bad(res, 'Use POST', 405);
      if (b.website) return send(res, 200, { ok: true }); // spam trap
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
      if (!(await rateLimit(`enq:${ip}`, 6, 3600))) return bad(res, 'Too many messages from here. Please call or WhatsApp us instead.', 429);
      if (!(await humanCheck(b.cfToken, ip, { failOpen: true })).ok) return bad(res, NOT_HUMAN, 403);
      const e = {
        id: id('e'), about: clean(b.about, 80), name: clean(b.name, 80), phone: clean(b.phone, 30), email: clean(b.email, 120).toLowerCase(),
        reply: clean(b.reply, 30), experience: clean(b.experience, 40), when: clean(b.when, 120), message: clean(b.message, 1500),
        page: clean(b.page, 60), created: Date.now(), status: 'new',
      };
      e.message = screen(e.message); e.when = screen(e.when); // security lesson S-008
      if (!e.name) return bad(res, 'Add your name so we know who to reply to.');
      const ph = checkPhone(e.phone);
      if (!ph.ok) return bad(res, ph.why);
      e.phone = ph.value;
      if (/whatsapp|text/i.test(e.reply) && ph.mobile === false) return bad(res, 'WhatsApp and texts need a mobile number. Add a mobile, or pick “Phone call”.');
      if (/email/i.test(e.reply) && !e.email) return bad(res, 'Add your email address, or pick another way to reply.');
      if (e.email && !validEmail(e.email)) return bad(res, 'That email address doesn’t look right.');
      if (!b.consent) return bad(res, 'Tick the box so we can contact you about your enquiry.');
      await redis.hset(`enquiry:${e.id}`, e);
      await redis.zadd('enquiries', { score: e.created, member: e.id });
      const to = [await coachEmail('jay'), process.env.BOOKINGS_COPY_EMAIL || '', 'warriorspirit@gmail.com'].filter((v, i, a) => v && a.indexOf(v) === i);
      await mail(to, `New enquiry: ${e.about || 'Website'}, ${e.name}`, [
        `New enquiry from the website (${fmt(e.created)}).`, '',
        `About: ${e.about}`, `Name: ${e.name}`, e.phone ? `Mobile: ${e.phone}` : '', e.email ? `Email: ${e.email}` : '',
        `Best way to reply: ${e.reply}`, e.experience ? `Experience: ${e.experience}` : '', e.when ? `Best days: ${e.when}` : '',
        e.message ? `Message: ${e.message}` : '', '', `See all enquiries: ${SITE}/coach#enquiries`,
      ].filter(x => x !== ''));
      return send(res, 200, { ok: true });
    }

    /* ----- Jay: read and tick off enquiries ----- */
    const c = coachSession(req);
    if (!c) return bad(res, 'Please log in.', 401);
    if (!c.admin) return bad(res, 'Only Jay can see enquiries.', 403);
    if (action === 'list') {
      const ids = await redis.zrange('enquiries', Date.now() - 180 * 864e5, Date.now() + 1, { byScore: true });
      const out = [];
      for (const i of ids.reverse().slice(0, 200)) { const e = await redis.hgetall(`enquiry:${i}`); if (e) out.push({ ...e, created: Number(e.created), when_: fmt(Number(e.created)) }); }
      return send(res, 200, { enquiries: out, unread: out.filter(e => e.status === 'new').length });
    }
    if (action === 'status' && req.method === 'POST') {
      const e = await redis.hgetall(`enquiry:${clean(b.id, 40)}`);
      if (!e) return bad(res, 'Not found.', 404);
      await redis.hset(`enquiry:${e.id}`, { status: b.status === 'new' ? 'new' : 'done', doneBy: c.first, doneAt: Date.now() });
      return send(res, 200, { ok: true });
    }
    return bad(res, 'Unknown action', 404);
  } catch (err) {
    console.error(err);
    return bad(res, 'Something went wrong. Please call or WhatsApp us instead.', 500);
  }
}

/* Security lesson S-008: free text never keeps a card number or a password. A run of 13 to 19 digits that passes the card
   check (Luhn), or text after "password", is replaced before the enquiry is saved or emailed. Phone numbers are 11 digits
   and stay as they are. */
export function screen(text) {
  let t = String(text || '');
  t = t.replace(/\b(?:\d[ -]?){12,18}\d\b/g, m => (luhn(m.replace(/\D/g, '')) ? '[card number removed]' : m));
  t = t.replace(/\b(pass ?word|pwd|pin)\b\s*(?:is|:|=)?\s*\S+/gi, '$1 [removed]');
  return t;
}
function luhn(d) {
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) { let n = Number(d[d.length - 1 - i]); if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; }
  return sum % 10 === 0;
}
