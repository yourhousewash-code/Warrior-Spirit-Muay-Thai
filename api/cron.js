/* Daily reminders. Vercel calls this on a schedule (see vercel.json):
   morning run  -> sessions today that asked for a morning reminder
   evening run  -> sessions tomorrow that asked for an evening reminder
   Each booking is only ever reminded once. */
import { redis, COACHES, loadCoaches, send, bad, setupProblem, clean, mail, fmt, SITE, ADDRESS, TYPES, FORMATS } from './_lib/core.js';
import { londonMs, londonDate, addDays } from './_lib/avail.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const ok = secret ? req.headers.authorization === `Bearer ${secret}` : /vercel-cron/.test(req.headers['user-agent'] || '');
  if (!ok) return bad(res, 'Not allowed.', 401);
  const problem = setupProblem(); if (problem) return bad(res, problem, 503);
  try {
    await loadCoaches();
    const run = clean(req.query.run, 10) === 'evening' ? 'evening' : 'morning';
    const today = londonDate(Date.now()), date = run === 'evening' ? addDays(today, 1) : today;
    const from = londonMs(date, '00:00'), to = londonMs(addDays(date, 1), '00:00') - 1;
    let sent = 0;
    for (const i of await redis.zrange('bookings:all', from, to, { byScore: true })) {
      const bk = await redis.hgetall(`booking:${i}`);
      if (!bk || bk.status !== 'booked' || bk.remind !== run || bk.reminded) continue;
      const what = [TYPES[bk.type]?.name || bk.type, bk.format ? FORMATS[bk.format]?.name : ''].filter(Boolean).join(', ');
      const ok1 = await mail(bk.email, `Reminder: ${what} with ${COACHES[bk.coach]?.first}, ${fmt(Number(bk.start))}`, [
        `Hi ${String(bk.name).split(' ')[0]},`, `A reminder about your personal training session ${run === 'morning' ? 'today' : 'tomorrow'}.`,
        `When: ${fmt(Number(bk.start))}`, `Coach: ${COACHES[bk.coach]?.name || ''}`, `Where: ${ADDRESS}`, 'Bring water, a towel and your wraps and gloves if you have them.',
        `Need to cancel? Do it from your account up to 24 hours before: ${SITE}/account`]);
      if (ok1) { await redis.hset(`booking:${bk.id}`, { reminded: '1' }); sent++; }
    }
    for (const i of await redis.zrange('cbookings:all', from, to, { byScore: true })) {
      const cb = await redis.hgetall(`cbk:${i}`);
      if (!cb || cb.status !== 'booked' || cb.remind !== run || cb.reminded) continue;
      const ok2 = await mail(cb.email, `Reminder: ${cb.className}, ${fmt(Number(cb.start))}`, [
        `Hi ${String(cb.name).split(' ')[0]},`, `A reminder: you have a place in ${cb.className} ${run === 'morning' ? 'today' : 'tomorrow'}.`,
        `When: ${fmt(Number(cb.start))}`, `Coach: ${COACHES[cb.coach]?.name || ''}`, `Where: ${ADDRESS}`,
        `Can’t make it? Please cancel from your account (up to 2 hours before) so someone else can have your place: ${SITE}/account`]);
      if (ok2) { await redis.hset(`cbk:${cb.id}`, { reminded: '1' }); sent++; }
    }
    return send(res, 200, { run, date, sent });
  } catch (e) { console.error(e); return bad(res, 'Reminder run failed.', 500); }
}
