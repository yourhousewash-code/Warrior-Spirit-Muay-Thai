import {
  redis, COACHES, loadCoaches, activeIds, publicIds, TYPES, FORMATS, DURATIONS, DEFAULT_PRICES, getPrices, priceOf, minsLabel,
  send, bad, setupProblem, body, clean, id, fmt, mail, coachEmail, coachSession, userSession, SITE, ADDRESS,
} from './_lib/core.js';
import {
  DAY, LENGTHS, londonMs, londonDate, addDays, validDate, validTime, getWeekly, getOff, isOff,
  realSlots, generated, parseVirtual, getClasses, getCover, classInstances, freeIntervals, startsIn,
} from './_lib/avail.js';
import { liveProfile } from './_lib/profiles.js';


export default async function handler(req, res) {
  const problem = setupProblem();
  if (problem) return bad(res, problem, 503);
  await loadCoaches();
  const action = clean(req.query.action, 40);
  const b = body(req);
  try {
    switch (action) {
      /* ----- public: open slots ----- */
      case 'open': {
        /* Start times customers can book for a given length, with each coach's prices. */
        const from = Date.now() + 2 * 3600e3, to = Date.now() + 42 * DAY;
        const pick = clean(req.query.coach, 20);
        const which = COACHES[pick]?.listed ? [pick] : publicIds();
        const mins = DURATIONS.includes(Number(req.query.mins)) ? Number(req.query.mins) : 60;
        const format = FORMATS[req.query.format] ? req.query.format : 'one';
        const real = await realSlots('all', from - DAY, to + DAY);
        const classes = await classInstances(from - DAY, to + DAY);
        const prices = {};
        for (const c of publicIds()) prices[c] = await getPrices(c);
        const starts = [];
        for (const c of which) {
          if (!priceOf(prices[c], format, mins)) continue;
          for (const t of startsIn(await freeIntervals(c, from, to, real, classes), mins, from)) starts.push({ coach: c, coachName: COACHES[c].name, start: t, mins, when: fmt(t), price: priceOf(prices[c], format, mins) });
        }
        starts.sort((a2, b2) => a2.start - b2.start || a2.coach.localeCompare(b2.coach));
        return send(res, 200, {
          starts, mins, format, prices,
          coaches: await Promise.all(publicIds().map(async k => {
            const p = await liveProfile(k);
            const lo = Math.min(...Object.keys(FORMATS).flatMap(f => DURATIONS.map(m => priceOf(prices[k], f, m))).filter(Boolean));
            return { ...coachPub(k), role: p.role || 'Coach', intro: p.intro || '', chips: String(p.chips || '').split('\n').map(t => t.trim()).filter(Boolean).slice(0, 6), ask: p.ask || '', instagram: p.instagram || '', from: Number.isFinite(lo) ? lo : null };
          })),
          types: Object.fromEntries(Object.entries(TYPES).filter(([, v]) => !v.hidden)), formats: FORMATS, durations: DURATIONS,
        });
      }

      /* ----- coaches: prices ----- */
      case 'prices': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const who = target(c, req.query.coach);
        return send(res, 200, { coach: who, prices: await getPrices(who), isDefault: !(await redis.exists(`coach:${who}:prices`)), formats: FORMATS, durations: DURATIONS, defaults: DEFAULT_PRICES });
      }
      case 'prices-save': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const who = target(c, b.coach);
        const out = { groupMax: Math.min(Math.max(Number(b.prices?.groupMax) || 6, 3), 20) };
        for (const f of Object.keys(FORMATS)) {
          out[f] = {};
          for (const m of DURATIONS) {
            const raw = b.prices?.[f]?.[m];
            if (raw === null || raw === '' || raw === undefined) { out[f][m] = null; continue; }
            const v = Math.round(Number(raw) * 100) / 100;
            if (!(v > 0 && v < 1000)) return bad(res, `Check the price for ${FORMATS[f].name}, ${minsLabel(m)}.`);
            out[f][m] = v;
          }
        }
        if (!Object.keys(FORMATS).some(f => DURATIONS.some(m => out[f][m]))) return bad(res, 'Offer at least one session.');
        await redis.set(`coach:${who}:prices`, out);
        return send(res, 200, { prices: out });
      }

      /* ----- coaches: calendar ----- */
      case 'calendar': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const which = target(c, req.query.coach, true);
        const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 42);
        const firstDate = validDate(req.query.from) ? req.query.from : londonDate(Date.now());
        const from = londonMs(firstDate, '00:00'), to = londonMs(addDays(firstDate, days), '00:00') - 1;
        const real = await realSlots('all', from - DAY, to + DAY);
        const classes = await classInstances(from - DAY, to + DAY);
        const items = [], offs = {};
        for (const cid of which === 'all' ? activeIds() : [which]) {
          const g = await generated(cid, from, to, real, classes);
          offs[cid] = g.off.filter(o => o.to >= firstDate && o.from <= addDays(firstDate, days));
          for (const s of real.filter(s => s.coach === cid && s.start >= from && s.start <= to && s.status !== 'cancelled')) {
            const o = { ...pub(s), status: s.status, source: s.source || 'extra' };
            if (s.bookingId) {
              const bk = await redis.hgetall(`booking:${s.bookingId}`);
              if (bk && bk.status === 'booked') o.booking = bookingInfo(bk);
            }
            if (o.status === 'booked' && !o.booking) continue;
            items.push(o);
          }
          items.push(...g.open.map(s => ({ ...pub(s), status: 'open', source: 'weekly' })));
          items.push(...g.blocked.map(s => ({ ...pub(s), status: 'blocked', source: 'weekly' })));
        }
        const allOff = {};
        for (const cid of activeIds()) allOff[cid] = offs[cid] || (await getOff(cid));
        for (const k of classes.filter(k => k.start >= from && k.start <= to)) {
          items.push({ id: k.id, type: 'class', status: k.cancelled ? 'cancelled' : 'class', name: k.name, coach: k.coach, coachName: COACHES[k.coach]?.name || k.coach,
            usual: k.usual, cover: k.cover, classId: k.classId, date: k.date, start: k.start, mins: k.mins, when: fmt(k.start),
            mine: which === 'all' || k.coach === which, needsCover: !k.cancelled && !!isOff(allOff[k.coach] || [], k.date) });
        }
        items.sort((a, b2) => a.start - b2.start);
        return send(res, 200, { from: firstDate, days, coach: which, items, off: offs });
      }

      /* ----- class timetable ----- */
      case 'classes': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        return send(res, 200, { classes: await getClasses() });
      }
      case 'classes-save': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        if (!c.admin) return bad(res, 'Only Jay can change the class timetable.', 403);
        const list = (Array.isArray(b.classes) ? b.classes : []).slice(0, 60).map(k => ({
          id: clean(k.id, 30) || id('k'), day: Number(k.day), start: String(k.start), end: String(k.end), name: clean(k.name, 40), coach: String(k.coach),
        }));
        for (const k of list) {
          if (!k.name) return bad(res, 'Every class needs a name.');
          if (!(k.day >= 0 && k.day <= 6) || !validTime(k.start) || !validTime(k.end) || k.end <= k.start) return bad(res, `Check the times for ${k.name}.`);
          if (!COACHES[k.coach]) return bad(res, `Choose who teaches ${k.name}.`);
        }
        list.sort((a, b2) => a.day - b2.day || a.start.localeCompare(b2.start));
        await redis.set('classes', list);
        return send(res, 200, { classes: list });
      }
      case 'cover': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        if (!c.admin) return bad(res, 'Only Jay can change who covers a class.', 403);
        const key = `${clean(b.classId, 30)}|${clean(b.date, 10)}`;
        if (!validDate(b.date)) return bad(res, 'Choose a date.');
        const who = String(b.coach || '');
        const cover = await getCover();
        if (!who) delete cover[key];
        else if (who === 'none' || COACHES[who]) cover[key] = who;
        else return bad(res, 'Choose a coach.');
        const cutoff = addDays(londonDate(Date.now()), -7);
        for (const k of Object.keys(cover)) if (k.split('|')[1] < cutoff) delete cover[k];
        await redis.set('classcover', cover);
        return send(res, 200, { ok: true });
      }

      /* ----- coaches: regular weekly hours ----- */
      case 'rules': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const who = target(c, req.query.coach);
        return send(res, 200, { coach: who, weekly: await getWeekly(who), isDefault: !(await redis.exists(`coach:${who}:weekly`)), off: (await getOff(who)).filter(o => o.to >= londonDate(Date.now())) });
      }
      case 'weekly': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const who = target(c, b.coach);
        const list = (Array.isArray(b.weekly) ? b.weekly : []).slice(0, 40).map(r => ({
          day: Number(r.day), start: String(r.start), end: String(r.end), mins: Number(r.mins) || 60,
          ...(typeof r.overClass === 'boolean' ? { overClass: r.overClass } : {}),
        }));
        for (const r of list) {
          if (!(r.day >= 0 && r.day <= 6) || !validTime(r.start) || !validTime(r.end)) return bad(res, 'Check the times. Each row needs a start and an end.');
          if (r.end <= r.start) return bad(res, `The end time must be after the start time (${r.start}–${r.end}).`);
          if (!LENGTHS.includes(r.mins)) return bad(res, 'Choose a session length.');
        }
        list.sort((a, b2) => a.day - b2.day || a.start.localeCompare(b2.start));
        /* Hours that overlap someone else's class need a yes/no from the coach. */
        const timetable = await getClasses(), clashes = [];
        list.forEach((r, i) => {
          const hit = timetable.filter(k => k.day === r.day && k.coach !== who && k.start < r.end && r.start < k.end);
          if (!hit.length) { delete r.overClass; return; }
          if (typeof r.overClass !== 'boolean') clashes.push({ index: i, day: r.day, start: r.start, end: r.end, classes: hit.map(k => ({ name: k.name, start: k.start, end: k.end, coach: COACHES[k.coach]?.first || k.coach })) });
        });
        if (clashes.length) return send(res, 200, { needConfirm: true, weekly: list, clashes });
        await redis.set(`coach:${who}:weekly`, list);
        return send(res, 200, { weekly: list });
      }

      /* ----- coaches: holidays & days off ----- */
      case 'off-add': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const who = target(c, b.coach);
        const from = clean(b.from, 10), to = clean(b.to, 10) || from;
        if (!validDate(from) || !validDate(to)) return bad(res, 'Choose the dates.');
        if (to < from) return bad(res, 'The last day must be on or after the first day.');
        const off = await getOff(who);
        off.push({ id: id('o'), from, to, note: clean(b.note, 60) });
        off.sort((a, b2) => a.from.localeCompare(b2.from));
        await redis.set(`coach:${who}:off`, off.filter(o => o.to >= addDays(londonDate(Date.now()), -1)));
        const clashes = (await realSlots(who, londonMs(from, '00:00'), londonMs(addDays(to, 1), '00:00') - 1)).filter(s => s.status === 'booked').length;
        return send(res, 200, { off, clashes });
      }
      case 'off-remove': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const who = target(c, b.coach);
        const off = (await getOff(who)).filter(o => o.id !== clean(b.id, 40));
        await redis.set(`coach:${who}:off`, off);
        return send(res, 200, { off });
      }

      /* ----- coaches: one-off extra slots ----- */
      case 'add': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const who = target(c, b.coach);
        const mins = Number(b.mins);
        if (!LENGTHS.includes(mins)) return bad(res, 'Choose a session length.');
        let starts = [];
        if (validDate(b.date) && validTime(b.time)) {
          const weeks = Math.min(Math.max(Number(b.weeks) || 1, 1), 12), count = Math.min(Math.max(Number(b.count) || 1, 1), 6);
          for (let w = 0; w < weeks; w++) {
            const t0 = londonMs(addDays(b.date, w * 7), b.time);
            for (let k = 0; k < count; k++) starts.push(t0 + k * mins * 6e4);
          }
        } else starts = (Array.isArray(b.starts) ? b.starts : []).map(Number).filter(Number.isFinite).slice(0, 60);
        if (!starts.length) return bad(res, 'Choose a date and time.');
        const now = Date.now(), weekly = (await generated(who, now, now + 121 * DAY)).open;
        const ks = (await classInstances(now, now + 121 * DAY)).filter(k => !k.cancelled);
        const teaching = ks.filter(k => k.coach === who), others = ks.filter(k => k.coach !== who);
        const hits = start => others.filter(x => x.start < start + mins * 6e4 && x.start + x.mins * 6e4 > start);
        if (!b.force) {
          const list = [...new Set(starts.flatMap(st => hits(st).map(k => `${fmt(k.start).replace(' at ', ', ')}: ${k.name}`)))];
          if (list.length) return send(res, 200, { needConfirm: true, clashes: list });
        }
        let added = 0, skipped = 0;
        for (const start of starts) {
          if (start < now || start > now + 120 * DAY) { skipped++; continue; }
          const s = { start, mins };
          const near = await realSlots(who, start - 90 * 6e4, start + mins * 6e4);
          const clash = near.some(x => x.status !== 'cancelled' && x.start < start + mins * 6e4 && x.start + x.mins * 6e4 > start)
            || weekly.some(x => x.start < start + mins * 6e4 && x.start + x.mins * 6e4 > start)
            || teaching.some(x => x.start < start + mins * 6e4 && x.start + x.mins * 6e4 > start);
          if (clash) { skipped++; continue; }
          const sid = id('s');
          await redis.hset(`slot:${sid}`, { id: sid, coach: who, start: s.start, mins, status: 'open', source: 'extra', created: now });
          await redis.zadd(`slots:coach:${who}`, { score: start, member: sid });
          await redis.zadd('slots:all', { score: start, member: sid });
          added++;
        }
        return send(res, 200, { added, skipped });
      }
      case 'remove': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const sid = clean(b.slotId, 60);
        const v = parseVirtual(sid);
        if (v) {
          if (v.coach !== c.id && !c.admin) return bad(res, 'Not allowed.', 403);
          await redis.sadd(`coach:${v.coach}:skip`, String(v.start));
          return send(res, 200, { ok: true });
        }
        const s = await redis.hgetall(`slot:${sid}`);
        if (!s || (s.coach !== c.id && !c.admin)) return bad(res, 'Slot not found.', 404);
        if (s.status === 'booked') return bad(res, 'This slot is booked. Cancel the booking first.', 409);
        await dropSlot(s);
        return send(res, 200, { ok: true });
      }
      case 'restore': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const v = parseVirtual(clean(b.slotId, 60));
        if (!v || (v.coach !== c.id && !c.admin)) return bad(res, 'Not allowed.', 403);
        await redis.srem(`coach:${v.coach}:skip`, String(v.start));
        return send(res, 200, { ok: true });
      }
      case 'schedule': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const which = target(c, req.query.coach, true);
        const slots = await realSlots(which, Date.now() - DAY, Date.now() + 120 * DAY);
        const out = [];
        for (const s of slots) {
          const o = { ...pub(s), status: s.status, source: s.source || 'extra' };
          if (s.bookingId) {
            const bk = await redis.hgetall(`booking:${s.bookingId}`);
            if (bk && bk.status === 'booked') o.booking = bookingInfo(bk);
          }
          out.push(o);
        }
        return send(res, 200, { slots: out, coach: which });
      }

      /* ----- customers: book, list, cancel ----- */
      case 'book': {
        const email = userSession(req); if (!email) return bad(res, 'Please log in to book.', 401);
        const u = await redis.hgetall(`user:${email}`); if (!u) return bad(res, 'Please log in again.', 401);
        const type = clean(b.type, 30), format = clean(b.format, 10), coach = clean(b.coach, 20);
        const mins = Number(b.mins), start = Number(b.start);
        if (!TYPES[type] || TYPES[type].hidden) return bad(res, 'Choose what you want to work on.');
        if (!FORMATS[format]) return bad(res, 'Choose 1-to-1, double or group.');
        if (!COACHES[coach]?.listed || !DURATIONS.includes(mins) || !Number.isFinite(start)) return bad(res, 'Pick a time.');
        const price = priceOf(await getPrices(coach), format, mins);
        if (!price) return bad(res, `${COACHES[coach].first} doesn’t offer that session. Pick another option.`);
        if (start < Date.now() + 2 * 3600e3) return bad(res, 'That time is too soon to book online. Message the gym instead.');
        /* One booking at a time per coach, so two people can't grab the same time. */
        const lock = `booklock:${coach}`;
        if (!(await redis.set(lock, '1', { nx: true, ex: 15 }))) return bad(res, 'Someone is booking with this coach right now. Try again in a few seconds.', 409);
        try {
          const real = await realSlots(coach, start - DAY, start + DAY);
          const ivs = await freeIntervals(coach, start - 1, start + mins * 6e4, real);
          if (!ivs.some(iv => iv.start <= start && start + mins * 6e4 <= iv.end)) return bad(res, 'Sorry, that time has just gone. Pick another.', 409);
          for (const x of real.filter(x => x.status === 'open' && x.start < start + mins * 6e4 && x.start + x.mins * 6e4 > start)) await dropSlot(x);
          const bid = id('b'), sid = id('s');
          await redis.hset(`slot:${sid}`, { id: sid, coach, start, mins, status: 'booked', source: 'booking', bookingId: bid, created: Date.now() });
          await redis.zadd(`slots:coach:${coach}`, { score: start, member: sid });
          await redis.zadd('slots:all', { score: start, member: sid });
          const bk = { id: bid, slotId: sid, coach, email, name: u.name, mobile: u.mobile, type, format, price, start, mins, notes: clean(b.notes, 400), status: 'booked', created: Date.now() };
          await redis.hset(`booking:${bid}`, bk);
          await redis.zadd(`bookings:user:${email}`, { score: start, member: bid });
          await redis.zadd(`bookings:coach:${coach}`, { score: start, member: bid });
          await redis.zadd('bookings:all', { score: start, member: bid });
          await notify('booked', bk);
          return send(res, 200, { booking: view(bk) });
        } finally { await redis.del(lock); }
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
        await redis.del(`slotlock:${bk.coach}:${bk.start}`);
        const s = await redis.hgetall(`slot:${bk.slotId}`);
        if (s) {
          if (s.source === 'weekly' || s.source === 'booking') {
            await dropSlot(s);
            if (byCoach && b.removeSlot) await redis.sadd(`coach:${s.coach}:skip`, String(s.start));
          } else if (byCoach && b.removeSlot) await dropSlot(s);
          else await redis.hset(`slot:${s.id}`, { status: 'open', bookingId: '' });
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

/* Which coach a request is about: a coach sees their own; Jay (admin) can pick any, or all. */
function target(c, want, allowAll = false) {
  if (c.admin && allowAll && want === 'all') return 'all';
  if (c.admin && COACHES[want]) return want;
  return c.id;
}
async function dropSlot(s) {
  await redis.del(`slot:${s.id}`);
  await redis.zrem(`slots:coach:${s.coach}`, s.id);
  await redis.zrem('slots:all', s.id);
}
const describe = bk => [TYPES[bk.type]?.name || bk.type, bk.format ? FORMATS[bk.format]?.name : '', bk.price ? `£${bk.price}` : ''].filter(Boolean).join(' · ');
function bookingInfo(bk) { return { id: bk.id, name: bk.name, email: bk.email, mobile: bk.mobile, type: describe(bk), format: bk.format || '', price: bk.price ? Number(bk.price) : null, notes: bk.notes || '' }; }
function coachPub(k) {
  const c = COACHES[k];
  return { id: k, name: c.name, first: c.first, photo: c.photoUrl || c.photo || '' };
}
function pub(s) { return { id: s.id, coach: s.coach, coachName: COACHES[s.coach]?.name || s.coach, start: s.start, mins: s.mins, when: fmt(s.start) }; }
function view(bk) {
  const start = Number(bk.start);
  return { id: bk.id, coach: bk.coach, coachName: COACHES[bk.coach]?.name || bk.coach, type: describe(bk), price: bk.price ? Number(bk.price) : null, start, mins: Number(bk.mins), when: fmt(start), status: bk.status, canCancel: bk.status === 'booked' && start - Date.now() >= DAY };
}

async function notify(kind, bk) {
  const coach = COACHES[bk.coach];
  const typeName = [TYPES[bk.type]?.name || bk.type, bk.format ? FORMATS[bk.format]?.name : ''].filter(Boolean).join(', ');
  const when = fmt(bk.start);
  const coachTo = await coachEmail(bk.coach);
  const jayTo = await coachEmail('jay');
  const copy = process.env.BOOKINGS_COPY_EMAIL || '';
  const staff = [coachTo, bk.coach !== 'jay' ? jayTo : '', copy].filter((v, i, a) => v && a.indexOf(v) === i);
  const details = [`Session: ${typeName}`, `Coach: ${coach.name}`, `When: ${when} (${minsLabel(Number(bk.mins))})`, bk.price ? `Price: £${bk.price}, paid at the gym` : '', `Where: ${ADDRESS}`].filter(Boolean);
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
