import crypto from 'node:crypto';
import { redis, COACHES, loadCoaches, send, bad, setupProblem, clean, userSession, SITE } from './_lib/core.js';
import { londonDate, DAY, getClasses, getCover, classInstances } from './_lib/avail.js';
import { vcal } from './_lib/ics.js';
import { ptEvent, classBookingEvent, clubClassEvent } from './_lib/calevents.js';

const host = req => `https://${req.headers['x-forwarded-host'] || req.headers.host || 'www.warriorspiritmuaythai.co.uk'}`;
const ics = (res, name, body, cache) => {
  res.status(200).setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${name}"`);
  res.setHeader('Cache-Control', cache);
  res.end(body);
};
async function tokenFor(email, reset) {
  const u = await redis.hgetall(`user:${email}`); if (!u) return null;
  if (u.calToken && !reset) return u.calToken;
  if (u.calToken) await redis.del(`calfeed:${u.calToken}`);
  const t = crypto.randomBytes(18).toString('base64url');
  await redis.set(`calfeed:${t}`, email);
  await redis.hset(`user:${email}`, { calToken: t });
  return t;
}
const mineEvents = async (email, site) => {
  const from = Date.now() - 30 * DAY, to = Date.now() + 365 * DAY, out = [];
  for (const i of await redis.zrange(`bookings:user:${email}`, from, to, { byScore: true })) {
    const bk = await redis.hgetall(`booking:${i}`); if (bk && bk.status === 'booked') out.push(ptEvent(bk, site));
  }
  for (const i of await redis.zrange(`cbookings:user:${email}`, from, to, { byScore: true })) {
    const cb = await redis.hgetall(`cbk:${i}`); if (cb && cb.status === 'booked') out.push(classBookingEvent(cb, site));
  }
  return out;
};

export default async function handler(req, res) {
  const problem = setupProblem();
  if (problem) return bad(res, problem, 503);
  try {
    await loadCoaches();
    const site = host(req), feed = clean(req.query.feed, 10), action = clean(req.query.action, 10);

    /* the whole club timetable, public: anyone can subscribe */
    if (feed === 'club') {
      const now = Date.now(), [classes, cover] = [await getClasses(), await getCover()];
      const types = (await redis.get('classtypes')) || [];
      const list = (await classInstances(now - DAY, now + 56 * DAY, classes, cover)).filter(k => !k.cancelled && k.start > now - DAY);
      const byId = Object.fromEntries(classes.map(k => [k.id, k]));
      const ev = list.map(k => { const src = byId[k.classId] || {}; return clubClassEvent({ ...k, max: src.max }, src.desc || types.find(t => t.name === k.name)?.desc || '', site); });
      return ics(res, 'warrior-spirit-timetable.ics', vcal('Warrior Spirit classes', ev), 'public, max-age=900, s-maxage=900');
    }

    /* one member's own sessions, private link */
    if (feed === 'me') {
      const t = clean(req.query.t, 80).replace(/\.ics$/i, '');
      const email = t ? await redis.get(`calfeed:${t}`) : null;
      if (!email) return bad(res, 'That calendar link isn’t valid.', 404);
      return ics(res, 'my-warrior-spirit.ics', vcal('My Warrior Spirit sessions', await mineEvents(email, site), { refreshHours: 1 }), 'private, max-age=300');
    }

    /* one booking, for “Add to calendar” */
    if (clean(req.query.one, 60)) {
      const email = userSession(req); if (!email) return bad(res, 'Please log in.', 401);
      const one = clean(req.query.one, 60);
      const bk = one.startsWith('cb_') ? await redis.hgetall(`cbk:${one}`) : await redis.hgetall(`booking:${one}`);
      if (!bk || bk.email !== email) return bad(res, 'Booking not found.', 404);
      const ev = one.startsWith('cb_') ? classBookingEvent(bk, site) : ptEvent(bk, site);
      return ics(res, 'warrior-spirit-session.ics', vcal('Warrior Spirit', [ev]), 'private, no-store');
    }

    /* links for the account page */
    if (action === 'link') {
      const email = userSession(req); if (!email) return bad(res, 'Please log in.', 401);
      const t = await tokenFor(email, req.method === 'POST' && clean(req.query.reset, 2) === '1');
      const h = site.replace('https://', '');
      return send(res, 200, { club: `webcal://${h}/calendar/club.ics`, clubHttps: `${site}/calendar/club.ics`, me: `webcal://${h}/calendar/me/${t}.ics`, meHttps: `${site}/calendar/me/${t}.ics` });
    }
    return bad(res, 'Unknown request.', 404);
  } catch (e) {
    console.error(e);
    return bad(res, 'Something went wrong on our side.', 500);
  }
}
