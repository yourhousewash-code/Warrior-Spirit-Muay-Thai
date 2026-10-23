import {
  redis, COACHES, TYPES, send, bad, setupProblem, body, clean, id, fmt, mail, coachEmail,
  coachSession, userSession, SITE, ADDRESS,
} from './_lib/core.js';

const DAY = 864e5;
const MINS = [30, 45, 60, 75, 90];

export default async function handler(req, res) {
  const problem = setupProblem();
  if (problem) return bad(res, problem, 503);
  const action = clean(req.query.action, 40);
  const b = body(req);
  try {
    switch (action) {
      /* ----- public: open slots ----- */
      case 'open': {
        const from = Date.now() + 2 * 3600e3, to = Date.now() + 42 * DAY;
        const coach = clean(req.query.coach, 20);
        const key = COACHES[coach] ? `slots:coach:${coach}` : 'slots:all';
        const ids = await redis.zrange(key, from, to, { byScore: true });
        const slots = (await getSlots(ids)).filter(s => s.status === 'open').map(pub);
        return send(res, 200, { slots, coaches: Object.values(COACHES).map(c => ({ id: c.id, name: c.name, first: c.first })), types: TYPES });
      }

      /* ----- coaches: manage availability ----- */
      case 'add': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const mins = Number(b.mins);
        if (!MINS.includes(mins)) return bad(res, 'Choose a session length.');
        const starts = (Array.isArray(b.starts) ? b.starts : []).map(Number).filter(n => Number.isFinite(n)).slice(0, 60);
        if (!starts.length) return bad(res, 'Choose a date and time.');
        const now = Date.now(), added = [], skipped = [];
        for (const start of starts) {
          if (start < now || start > now + 120 * DAY) { skipped.push(start); continue; }
          const near = await getSlots(await redis.zrange(`slots:coach:${c.id}`, start - 90 * 60e3, start + mins * 60e3 - 1, { byScore: true }));
          const clash = near.some(s => s.status !== 'cancelled' && s.start < start + mins * 60e3 && s.start + s.mins * 60e3 > start);
          if (clash) { skipped.push(start); continue; }
          const sid = id('s');
          await redis.hset(`slot:${sid}`, { id: sid, coach: c.id, start, mins, status: 'open', created: now });
          await redis.zadd(`slots:coach:${c.id}`, { score: start, member: sid });
          await redis.zadd('slots:all', { score: start, member: sid });
          added.push(sid);
        }
        return send(res, 200, { added: added.length, skipped: skipped.length });
      }
      case 'remove': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const s = await redis.hgetall(`slot:${clean(b.slotId, 40)}`);
        if (!s || (s.coach !== c.id && !c.admin)) return bad(res, 'Slot not found.', 404);
        if (s.status === 'booked') return bad(res, 'This slot is booked. Cancel the booking first.', 409);
        await redis.del(`slot:${s.id}`);
        await redis.zrem(`slots:coach:${s.coach}`, s.id);
        await redis.zrem('slots:all', s.id);
        return send(res, 200, { ok: true });
      }
      case 'schedule': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const which = c.admin && req.query.coach === 'all' ? 'all' : (c.admin && COACHES[req.query.coach] ? req.query.coach : c.id);
        const key = which === 'all' ? 'slots:all' : `slots:coach:${which}`;
        const from = Date.now() - DAY, to = Date.now() + 120 * DAY;
        const slots = await getSlots(await redis.zrange(key, from, to, { byScore: true }));
        const out = [];
        for (const s of slots) {
          const o = { ...pub(s), status: s.status };
          if (s.bookingId) {
            const bk = await redis.hgetall(`booking:${s.bookingId}`);
            if (bk && bk.status === 'booked') o.booking = { id: bk.id, name: bk.name, email: bk.email, mobile: bk.mobile, type: TYPES[bk.type]?.name || bk.type, notes: bk.notes || '' };
          }
          out.push(o);
        }
        return send(res, 200, { slots: out, coach: which });
      }

      /* ----- customers: book, list, cancel ----- */
      case 'book': {
        const email = userSession(req); if (!email) return bad(res, 'Please log in to book.', 401);
        const u = await redis.hgetall(`user:${email}`); if (!u) return bad(res, 'Please log in again.', 401);
        const s = await redis.hgetall(`slot:${clean(b.slotId, 40)}`);
        const type = clean(b.type, 30);
        if (!s || s.status !== 'open') return bad(res, 'Sorry, that slot has just gone. Pick another.', 409);
        if (!TYPES[type]) return bad(res, 'Choose a session type.');
        if (TYPES[type].mins > Number(s.mins)) return bad(res, `${TYPES[type].name} needs a ${TYPES[type].mins}-minute slot. Pick a longer slot.`);
        if (Number(s.start) < Date.now() + 2 * 3600e3) return bad(res, 'That slot is too soon to book online. Message the gym instead.');
        const bid = id('b');
        const got = await redis.set(`slotlock:${s.id}`, bid, { nx: true });
        if (!got) return bad(res, 'Sorry, someone has just booked that slot. Pick another.', 409);
        const bk = { id: bid, slotId: s.id, coach: s.coach, email, name: u.name, mobile: u.mobile, type, start: Number(s.start), mins: Number(s.mins), notes: clean(b.notes, 400), status: 'booked', created: Date.now() };
        await redis.hset(`booking:${bid}`, bk);
        await redis.hset(`slot:${s.id}`, { status: 'booked', bookingId: bid });
        await redis.zadd(`bookings:user:${email}`, { score: bk.start, member: bid });
        await redis.zadd(`bookings:coach:${s.coach}`, { score: bk.start, member: bid });
        await redis.zadd('bookings:all', { score: bk.start, member: bid });
        await notify('booked', bk);
        return send(res, 200, { booking: view(bk) });
      }
      case 'mine': {
        const email = userSession(req); if (!email) return bad(res, 'Please log in.', 401);
        const ids = await redis.zrange(`bookings:user:${email}`, Date.now() - 60 * DAY, Date.now() + 365 * DAY, { byScore: true });
        const list = [];
        for (const i of ids) { const bk = await redis.hgetall(`booking:${i}`); if (bk) list.push(view(bk)); }
        return send(res, 200, { bookings: list });
      }
      case 'cancel': {
        const bk = await redis.hgetall(`booking:${clean(b.bookingId, 40)}`);
        if (!bk || bk.status !== 'booked') return bad(res, 'Booking not found.', 404);
        const email = userSession(req), c = coachSession(req);
        const byCustomer = email && email === bk.email;
        const byCoach = c && (c.admin || c.id === bk.coach);
        if (!byCustomer && !byCoach) return bad(res, 'You can’t cancel this booking.', 403);
        if (byCustomer && !byCoach && Number(bk.start) - Date.now() < DAY) return bad(res, 'Bookings can only be cancelled online up to 24 hours before. Please message the gym.', 409);
        await redis.hset(`booking:${bk.id}`, { status: 'cancelled', cancelledBy: byCoach ? 'coach' : 'customer', cancelledAt: Date.now() });
        await redis.del(`slotlock:${bk.slotId}`);
        if (await redis.exists(`slot:${bk.slotId}`)) {
          await redis.hset(`slot:${bk.slotId}`, { status: byCoach && b.removeSlot ? 'cancelled' : 'open', bookingId: '' });
        }
        await notify(byCoach ? 'cancelled-by-coach' : 'cancelled-by-customer', { ...bk, start: Number(bk.start), mins: Number(bk.mins) });
        return send(res, 200, { ok: true });
      }
      default: return bad(res, 'Unknown action', 404);
    }
  } catch (e) {
    console.error(e);
    return bad(res, 'Something went wrong on our side. Please try again.', 500);
  }
}

async function getSlots(ids) {
  const out = [];
  for (const i of ids) { const s = await redis.hgetall(`slot:${i}`); if (s) out.push({ ...s, start: Number(s.start), mins: Number(s.mins) }); }
  return out;
}
function pub(s) { return { id: s.id, coach: s.coach, coachName: COACHES[s.coach]?.name || s.coach, start: s.start, mins: s.mins, when: fmt(s.start) }; }
function view(bk) {
  const start = Number(bk.start);
  return { id: bk.id, coach: bk.coach, coachName: COACHES[bk.coach]?.name || bk.coach, type: TYPES[bk.type]?.name || bk.type, start, mins: Number(bk.mins), when: fmt(start), status: bk.status, canCancel: bk.status === 'booked' && start - Date.now() >= DAY };
}

async function notify(kind, bk) {
  const coach = COACHES[bk.coach];
  const typeName = TYPES[bk.type]?.name || bk.type;
  const when = fmt(bk.start);
  const coachTo = await coachEmail(bk.coach);
  const jayTo = await coachEmail('jay');
  const copy = process.env.BOOKINGS_COPY_EMAIL || '';
  const staff = [coachTo, bk.coach !== 'jay' ? jayTo : '', copy].filter((v, i, a) => v && a.indexOf(v) === i);
  const details = [`Session: ${typeName}`, `Coach: ${coach.name}`, `When: ${when} (${bk.mins} minutes)`, `Where: ${ADDRESS}`];
  const who = [`Name: ${bk.name}`, `Mobile: ${bk.mobile}`, `Email: ${bk.email}`, bk.notes ? `Notes: ${bk.notes}` : ''];
  if (kind === 'booked') {
    await mail(bk.email, `Booked: ${typeName} with ${coach.first}, ${when}`, [
      `Hi ${bk.name.split(' ')[0]},`, 'Your personal training session is booked.', ...details,
      'Payment is taken at the gym. Bring water, a towel and your wraps and gloves if you have them.',
      `Need to cancel? You can do it from your account up to 24 hours before: ${SITE}/account`,
    ]);
    await mail(staff, `New PT booking: ${bk.name}, ${when}`, ['A new PT session has been booked.', ...details, '', ...who, `See all bookings: ${SITE}/coach`]);
  } else {
    const by = kind === 'cancelled-by-coach' ? 'the gym' : 'the customer';
    await mail(bk.email, `Cancelled: ${typeName}, ${when}`, [
      `Hi ${bk.name.split(' ')[0]},`, `Your session has been cancelled by ${by}.`, ...details,
      `Book another time: ${SITE}/book`,
    ]);
    await mail(staff, `PT cancelled: ${bk.name}, ${when}`, [`A PT session was cancelled by ${by}. The slot is free again.`, ...details, '', ...who]);
  }
}
