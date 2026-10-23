import crypto from 'node:crypto';
import {
  redis, COACHES, loadCoaches, activeIds, publicIds, send, bad, setupProblem, body, clean, validEmail, rateLimit,
  hashPassword, checkPassword, checkCoachPassword, setSession, clearSession, saveCoaches,
  coachSession, userSession, coachEmail, mail, SITE,
} from './_lib/core.js';

export default async function handler(req, res) {
  const problem = setupProblem();
  if (problem) return bad(res, problem, 503);
  await loadCoaches();
  const action = clean(req.query.action, 40);
  const b = body(req);
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  try {
    switch (action) {
      /* ----- coaches ----- */
      case 'coach-login': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const cid = clean(b.username, 30).toLowerCase();
        if (!(await rateLimit(`coach:${cid}:${ip}`, 8, 900))) return bad(res, 'Too many attempts. Try again in 15 minutes.', 429);
        if (!COACHES[cid]?.active || !(await checkCoachPassword(cid, String(b.password || '')))) return bad(res, 'That username or password isn’t right.', 401);
        setSession(res, 'ws_coach', { id: cid }, 30);
        return send(res, 200, { coach: await coachInfo(cid) });
      }
      case 'coach-me': {
        const c = coachSession(req);
        if (!c) return send(res, 200, { coach: null });
        return send(res, 200, { coach: await coachInfo(c.id) });
      }
      case 'coach-logout': clearSession(res, 'ws_coach'); return send(res, 200, { ok: true });

      /* ----- Jay: manage the coaching team ----- */
      case 'team': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        if (!c.admin) return bad(res, 'Only Jay can manage coaches.', 403);
        const list = [];
        for (const k of Object.keys(COACHES)) list.push({ ...(await coachInfo(k)), active: COACHES[k].active, listed: COACHES[k].listed, base: !!COACHES[k].base });
        return send(res, 200, { coaches: list });
      }
      case 'coach-add': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        if (!c.admin) return bad(res, 'Only Jay can add coaches.', 403);
        const name = clean(b.name, 60).replace(/\s+/g, ' ');
        if (!/^[A-Za-zÀ-ÿ'’\-]+( [A-Za-zÀ-ÿ'’\-]+)+$/.test(name)) return bad(res, 'Add the coach’s first and last name.');
        const first = name.split(' ')[0];
        let cid = clean(b.username || first, 20).toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
        if (cid.length < 2) return bad(res, 'Choose a username using letters only.');
        if (COACHES[cid] || ['all', 'none', 'admin', 'coach', 'team'].includes(cid)) return bad(res, `The username “${cid}” is taken. Choose another, e.g. ${cid}${name.split(' ')[1]?.[0]?.toLowerCase() || '2'}.`);
        const pw = String(b.password || '');
        if (pw.length < 8) return bad(res, 'Choose a starting password of at least 8 characters.');
        const email = clean(b.email, 120).toLowerCase();
        if (email && !validEmail(email)) return bad(res, 'That email address doesn’t look right.');
        COACHES[cid] = { id: cid, name, first, active: true, added: Date.now() };
        await saveCoaches();
        await redis.set(`coach:${cid}:hash`, hashPassword(pw));
        await redis.set(`coach:${cid}:weekly`, []); // no PT hours until they set them
        if (email) await redis.set(`coach:${cid}:email`, email);
        if (email) await mail(email, 'Your Warrior Spirit coach login', [
          `Hi ${first},`, `Jay has set you up on the Warrior Spirit coach area.`,
          `Log in here: ${SITE}/coach`, `Your username is: ${cid}`, 'Jay will give you your starting password. Change it in Settings once you’re in.',
          'Then fill in My profile (Jay approves it before it goes on the website), set your prices and add your weekly hours.',
        ]);
        return send(res, 200, { coach: await coachInfo(cid) });
      }
      case 'coach-update': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        if (!c.admin) return bad(res, 'Only Jay can change coaches.', 403);
        const cid = clean(b.id, 20);
        if (!COACHES[cid]) return bad(res, 'Coach not found.', 404);
        if (cid === 'jay') return bad(res, 'Jay’s own account can’t be changed here.');
        if (typeof b.active === 'boolean') COACHES[cid].active = b.active;
        if (b.name) { const n = clean(b.name, 60).replace(/\s+/g, ' '); if (n.includes(' ')) { COACHES[cid].name = n; COACHES[cid].first = n.split(' ')[0]; } }
        await saveCoaches();
        if (b.password) {
          if (String(b.password).length < 8) return bad(res, 'Choose a password of at least 8 characters.');
          await redis.set(`coach:${cid}:hash`, hashPassword(String(b.password)));
        }
        return send(res, 200, { ok: true });
      }
      case 'coach-settings': {
        const c = coachSession(req);
        if (!c) return bad(res, 'Please log in.', 401);
        if (b.email !== undefined) {
          const e = clean(b.email, 120).toLowerCase();
          if (e && !validEmail(e)) return bad(res, 'That email address doesn’t look right.');
          await redis.set(`coach:${c.id}:email`, e);
        }
        if (b.newPassword) {
          if (!(await checkCoachPassword(c.id, String(b.currentPassword || '')))) return bad(res, 'Your current password isn’t right.', 401);
          if (String(b.newPassword).length < 8) return bad(res, 'Choose a password of at least 8 characters.');
          await redis.set(`coach:${c.id}:hash`, hashPassword(String(b.newPassword)));
        }
        return send(res, 200, { coach: await coachInfo(c.id) });
      }

      /* ----- customers ----- */
      case 'register': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        if (!(await rateLimit(`reg:${ip}`, 10, 3600))) return bad(res, 'Too many sign-ups from here. Try again later.', 429);
        const email = clean(b.email, 120).toLowerCase(), name = clean(b.name, 80), mobile = clean(b.mobile, 30), pw = String(b.password || '');
        if (!name) return bad(res, 'Add your name.');
        if (!validEmail(email)) return bad(res, 'Add a valid email address.');
        if (mobile.replace(/\D/g, '').length < 10) return bad(res, 'Add a mobile number so your coach can reach you.');
        if (pw.length < 8) return bad(res, 'Choose a password of at least 8 characters.');
        const exists = await redis.exists(`user:${email}`);
        if (exists) return bad(res, 'There’s already an account with that email. Log in instead, or reset your password.', 409);
        await redis.hset(`user:${email}`, { email, name, mobile, hash: hashPassword(pw), created: Date.now() });
        setSession(res, 'ws_user', { email }, 60);
        return send(res, 200, { user: { email, name, mobile } });
      }
      case 'login': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const email = clean(b.email, 120).toLowerCase();
        if (!(await rateLimit(`login:${email}:${ip}`, 8, 900))) return bad(res, 'Too many attempts. Try again in 15 minutes.', 429);
        const u = await redis.hgetall(`user:${email}`);
        if (!u || !checkPassword(String(b.password || ''), u.hash)) return bad(res, 'That email or password isn’t right.', 401);
        setSession(res, 'ws_user', { email }, 60);
        return send(res, 200, { user: { email, name: u.name, mobile: u.mobile } });
      }
      case 'me': {
        const email = userSession(req);
        if (!email) return send(res, 200, { user: null });
        const u = await redis.hgetall(`user:${email}`);
        return send(res, 200, { user: u ? { email, name: u.name, mobile: u.mobile } : null });
      }
      case 'logout': clearSession(res, 'ws_user'); return send(res, 200, { ok: true });
      case 'forgot': {
        const email = clean(b.email, 120).toLowerCase();
        if (validEmail(email) && (await rateLimit(`forgot:${email}`, 3, 3600)) && (await redis.exists(`user:${email}`))) {
          const token = crypto.randomBytes(24).toString('base64url');
          await redis.set(`reset:${token}`, email, { ex: 3600 });
          await mail(email, 'Reset your Warrior Spirit password', [
            'Someone asked to reset the password for your Warrior Spirit account.',
            `To choose a new password, open this link within an hour: ${SITE}/account?reset=${token}`,
            'If this wasn’t you, ignore this email and nothing will change.',
          ]);
        }
        return send(res, 200, { ok: true });
      }
      case 'reset': {
        const token = clean(b.token, 80), pw = String(b.password || '');
        const email = await redis.get(`reset:${token}`);
        if (!email) return bad(res, 'That reset link has expired. Ask for a new one.', 410);
        if (pw.length < 8) return bad(res, 'Choose a password of at least 8 characters.');
        await redis.hset(`user:${email}`, { hash: hashPassword(pw) });
        await redis.del(`reset:${token}`);
        setSession(res, 'ws_user', { email }, 60);
        return send(res, 200, { ok: true });
      }
      default: return bad(res, 'Unknown action', 404);
    }
  } catch (e) {
    console.error(e);
    return bad(res, 'Something went wrong on our side. Please try again.', 500);
  }
}

async function coachInfo(cid) {
  const c = COACHES[cid];
  const team = Object.values(COACHES).filter(x => x.active).map(x => ({ id: x.id, name: x.name, first: x.first }));
  return { id: c.id, name: c.name, first: c.first, admin: c.admin, email: await coachEmail(cid), passwordChanged: !!(await redis.get(`coach:${cid}:hash`)), team };
}
