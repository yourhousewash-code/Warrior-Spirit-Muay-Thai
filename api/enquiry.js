/* Website enquiries (free class, PT, kids, questions): saved for Jay and emailed to the gym. */
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
      const e = {
        id: id('e'), about: clean(b.about, 80), name: clean(b.name, 80), phone: clean(b.phone, 30), email: clean(b.email, 120).toLowerCase(),
        reply: clean(b.reply, 30), experience: clean(b.experience, 40), when: clean(b.when, 120), message: clean(b.message, 1500),
        page: clean(b.page, 60), created: Date.now(), status: 'new',
      };
      if (!e.name) return bad(res, 'Add your name so we know who to reply to.');
      if (!e.phone && !e.email) return bad(res, 'Add a mobile number or email so we can get back to you.');
      if (e.email && !validEmail(e.email)) return bad(res, 'That email address doesn’t look right.');
      if (!b.consent) return bad(res, 'Tick the box so we can contact you about your enquiry.');
      await redis.hset(`enquiry:${e.id}`, e);
      await redis.zadd('enquiries', { score: e.created, member: e.id });
      const to = [await coachEmail('jay'), process.env.BOOKINGS_COPY_EMAIL || ''].filter((v, i, a) => v && a.indexOf(v) === i);
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
