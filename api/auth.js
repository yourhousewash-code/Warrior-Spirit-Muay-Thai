import crypto from 'node:crypto';
import {
  redis, COACHES, loadCoaches, activeIds, publicIds, send, bad, setupProblem, body, clean, validEmail, rateLimit,
  hashPassword, checkPassword, checkCoachPassword, setSession, clearSession, saveCoaches,
  coachSession, userSession, coachEmail, mail, mailReady, SITE, readSigned, SESS,
} from './_lib/core.js';
import {
  twoStepState, askWho, startSession, endAllSessions, listDevices, trustedDevice, touchDevice, trustThisDevice,
  removeDevices, forgetTrustCookie, trustCookie, sendCode, checkCode, challenge, setChallenge, clearChallenge, noEmailPass, isOwner, RESEND_WAIT,
} from './_lib/twostep.js';

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
        /* Two-step sign-in: owners always, other coaches if they switched it on. A trusted device skips the code. */
        const ts = await twoStepState(cid);
        if (ts === 'off') { startSession(res, cid, 'p'); return send(res, 200, { coach: await coachInfo(cid) }); }
        const dev = await trustedDevice(req, cid);
        if (dev) { await touchDevice(cid, dev); startSession(res, cid, 't', dev.id); return send(res, 200, { coach: await coachInfo(cid) }); }
        if (!(await coachEmail(cid))) {
          /* No email to send a code to. A coach who chose two-step is let in (it's optional for them); an owner is let in
             once, with a warning and an email to the other owner, then has to ask the other owner to add an email. */
          if (ts === 'on') { startSession(res, cid, 'p'); return send(res, 200, { coach: await coachInfo(cid), warning: 'noemail' }); }
          if (await noEmailPass(cid)) { startSession(res, cid, 'n'); return send(res, 200, { coach: await coachInfo(cid), warning: 'noemail' }); }
          return send(res, 403, { error: `There’s no email address on your account, so we can’t send your sign-in code, and owners can’t sign in without one. Ask ${askWho(cid)} to add your email in Manage coaches → Change email, then try again.`, noEmail: true });
        }
        const r = await sendCode(cid, 'login');
        if (r.error) return bad(res, r.error, r.status);
        setChallenge(res, cid, r.n);
        return send(res, 200, { step: 'code', to: r.to, ask: askWho(cid), wait: RESEND_WAIT });
      }
      /* Second step: the 6-digit code from the email. */
      case 'coach-code': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const ch = challenge(req);
        if (!ch || !COACHES[ch.id]?.active || (ch.g || 0) !== (SESS_G(ch.id))) return send(res, 401, { error: 'Your sign-in timed out. Enter your username and password again.', restart: true });
        if (!(await rateLimit(`2fa:try:${ip}`, 30, 900))) return bad(res, 'Too many attempts. Try again in 15 minutes.', 429);
        const r = await checkCode(ch.id, 'login', ch.n, b.code);
        if (r.error) return send(res, r.status, { error: r.error, expired: !!r.expired });
        clearChallenge(res);
        const dv = b.trust ? await trustThisDevice(req, res, ch.id) : null;
        if (!dv) forgetTrustCookie(res, ch.id);
        startSession(res, ch.id, '2', dv);
        return send(res, 200, { coach: await coachInfo(ch.id) });
      }
      case 'coach-code-resend': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const ch = challenge(req);
        if (!ch || !COACHES[ch.id]?.active) return send(res, 401, { error: 'Your sign-in timed out. Enter your username and password again.', restart: true });
        const r = await sendCode(ch.id, 'login', { resend: true });
        if (r.error) return bad(res, r.error, r.status);
        setChallenge(res, ch.id, r.n);
        return send(res, 200, { to: r.to, wait: RESEND_WAIT });
      }
      case 'coach-forgot': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const cid = clean(b.username, 30).toLowerCase();
        const same = { ok: true, message: 'If that username has an email address saved, we’ve sent a reset link. It works for one hour.' };
        if (!(await rateLimit(`forgot:${ip}`, 6, 3600)) || !(await rateLimit(`forgot:${cid}`, 3, 3600))) return send(res, 200, same);
        const to = COACHES[cid]?.active ? await coachEmail(cid) : '';
        if (to) {
          const token = crypto.randomBytes(24).toString('base64url');
          await redis.set(`coach:reset:${crypto.createHash('sha256').update(token).digest('hex')}`, cid, { ex: 3600 });
          await mail(to, 'Reset your Warrior Spirit coach password', [
            `Hi ${COACHES[cid].first},`, 'Someone asked to reset your coach area password. Use this link within the hour to choose a new one:',
            `${SITE}/coach?reset=${token}`, 'If it wasn’t you, ignore this email and your password stays the same.',
          ]);
        }
        return send(res, 200, same);
      }
      case 'coach-reset': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        if (!(await rateLimit(`reset:${ip}`, 10, 3600))) return bad(res, 'Too many attempts. Try again later.', 429);
        const pw = String(b.password || '');
        if (pw.length < 8) return bad(res, 'Choose a password of at least 8 characters.');
        const key = `coach:reset:${crypto.createHash('sha256').update(String(b.token || '')).digest('hex')}`;
        const cid = await redis.get(key);
        if (!cid || !COACHES[cid]?.active) return bad(res, 'That reset link has expired. Ask for a new one.', 400);
        await redis.set(`coach:${cid}:hash`, hashPassword(pw));
        await redis.del(key);
        /* A new password signs out every device and forgets trusted devices. The link came to their email, so it counts as the code. */
        await endAllSessions(cid);
        forgetTrustCookie(res, cid);
        startSession(res, cid, 'r');
        return send(res, 200, { coach: await coachInfo(cid) });
      }
      case 'coach-me': {
        const c = coachSession(req);
        if (!c) return send(res, 200, { coach: null });
        const dev = await trustedDevice(req, c.id); // keeps "last used" up to date on trusted devices
        if (dev && Date.now() - (dev.last || 0) > 600e3) await touchDevice(c.id, dev);
        return send(res, 200, { coach: await coachInfo(c.id) });
      }
      case 'coach-logout': clearSession(res, 'ws_coach'); clearChallenge(res); return send(res, 200, { ok: true });

      /* ----- Settings → Two-step sign-in ----- */
      case 'coach-devices': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const here = readSigned(req, trustCookie(c.id))?.dv || '';
        const devices = (await listDevices(c.id)).map(d => ({ id: d.id, name: d.name, added: d.added, last: d.last, until: d.exp, here: d.id === here }));
        return send(res, 200, { twoStep: await twoStepState(c.id), devices });
      }
      case 'coach-device-remove': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const id = clean(b.id, 40);
        if (!(await listDevices(c.id)).some(d => d.id === id)) return bad(res, 'That device has already been removed.', 404);
        await removeDevices(c.id, [id]);
        if (readSigned(req, trustCookie(c.id))?.dv === id) forgetTrustCookie(res, c.id);
        const self = readSigned(req, 'ws_coach')?.dv === id;
        if (self) clearSession(res, 'ws_coach');
        return send(res, 200, { ok: true, signedOut: self });
      }
      case 'coach-signout-all': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        await endAllSessions(c.id);
        forgetTrustCookie(res, c.id); clearSession(res, 'ws_coach');
        return send(res, 200, { ok: true });
      }
      /* Coaches (not owners) switch it on with a test code, so we know the codes reach them. */
      case 'coach-twostep-start': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        if (isOwner(c.id)) return bad(res, 'Two-step sign-in is always on for owners.');
        if ((await twoStepState(c.id)) === 'on') return bad(res, 'Two-step sign-in is already on.');
        const r = await sendCode(c.id, 'enable', { resend: true });
        if (r.error) return bad(res, r.error, r.status);
        return send(res, 200, { to: r.to, wait: RESEND_WAIT });
      }
      case 'coach-twostep-confirm': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        if (isOwner(c.id)) return bad(res, 'Two-step sign-in is always on for owners.');
        if (!(await rateLimit(`2fa:try:${ip}`, 30, 900))) return bad(res, 'Too many attempts. Try again in 15 minutes.', 429);
        const r = await checkCode(c.id, 'enable', null, b.code);
        if (r.error) return send(res, r.status, { error: r.error, expired: !!r.expired });
        await redis.set(`coach:${c.id}:2fa`, { on: true, at: Date.now() });
        return send(res, 200, { coach: await coachInfo(c.id) });
      }
      case 'coach-twostep-off': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        if (isOwner(c.id)) return bad(res, 'Two-step sign-in is required for owners, so it can’t be switched off.', 403);
        if (!(await rateLimit(`coach:${c.id}:${ip}`, 8, 900))) return bad(res, 'Too many attempts. Try again in 15 minutes.', 429);
        if (!(await checkCoachPassword(c.id, String(b.password || '')))) return bad(res, 'That password isn’t right.', 401);
        await redis.del(`coach:${c.id}:2fa`, `coach:${c.id}:2fa:enable`);
        return send(res, 200, { coach: await coachInfo(c.id) });
      }
      /* Every coach: members who asked (in their account) to be left out of photos and videos. Names and dates only. */
      case 'photo-optouts': {
        const c = coachSession(req); if (!c) return bad(res, 'Please log in.', 401);
        const all = (await redis.hgetall(OPTOUT)) || {};
        const list = Object.values(all).map(v => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } })
          .filter(v => v && v.name).map(v => ({ name: String(v.name).slice(0, 80), at: Number(v.at) || 0 }))
          .sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
        return send(res, 200, { members: list });
      }

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
        /* Owners can change any coach's email, including the other owner's (so an owner with no email for sign-in codes can be helped). */
        if (b.email !== undefined) {
          const e = clean(b.email, 120).toLowerCase();
          if (!validEmail(e)) return bad(res, 'That email address doesn’t look right.');
          await changeEmail(cid, e, c.first);
          return send(res, 200, { ok: true });
        }
        if (COACHES[cid].admin) return bad(res, 'An owner account can’t be changed here.');
        if (typeof b.active === 'boolean') COACHES[cid].active = b.active;
        if (b.name) { const n = clean(b.name, 60).replace(/\s+/g, ' '); if (n.includes(' ')) { COACHES[cid].name = n; COACHES[cid].first = n.split(' ')[0]; } }
        await saveCoaches();
        if (b.password) {
          if (String(b.password).length < 8) return bad(res, 'Choose a password of at least 8 characters.');
          await redis.set(`coach:${cid}:hash`, hashPassword(String(b.password)));
          await endAllSessions(cid); // signs them out everywhere and forgets their trusted devices
        }
        return send(res, 200, { ok: true });
      }
      case 'coach-settings': {
        const c = coachSession(req);
        if (!c) return bad(res, 'Please log in.', 401);
        if (b.email !== undefined) {
          const e = clean(b.email, 120).toLowerCase();
          if (e && !validEmail(e)) return bad(res, 'That email address doesn’t look right.');
          const ts = await twoStepState(c.id);
          if (!e && !envEmail(c.id) && ts !== 'off') return bad(res, ts === 'required' ? 'Owners need an email address for sign-in codes. Enter a new one instead of clearing it.' : 'Your sign-in codes go to this email. Enter a new one, or switch two-step sign-in off first.');
          await changeEmail(c.id, e, '');
        }
        if (b.newPassword) {
          if (!(await checkCoachPassword(c.id, String(b.currentPassword || '')))) return bad(res, 'Your current password isn’t right.', 401);
          if (String(b.newPassword).length < 8) return bad(res, 'Choose a password of at least 8 characters.');
          await redis.set(`coach:${c.id}:hash`, hashPassword(String(b.newPassword)));
          /* A new password signs out every other device and forgets every trusted device. This one stays signed in. */
          await endAllSessions(c.id);
          forgetTrustCookie(res, c.id);
          startSession(res, c.id, readSigned(req, 'ws_coach')?.m || 'p');
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
        await redis.hset(`user:${email}`, { email, name, mobile, hash: hashPassword(pw), verified: 'no', created: Date.now() });
        await sendVerify(email, name);
        setSession(res, 'ws_user', { email }, 60);
        return send(res, 200, { user: userOut({ email, name, mobile, verified: 'no' }) });
      }
      case 'login': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const email = clean(b.email, 120).toLowerCase();
        if (!(await rateLimit(`login:${email}:${ip}`, 8, 900))) return bad(res, 'Too many attempts. Try again in 15 minutes.', 429);
        const u = await redis.hgetall(`user:${email}`);
        if (!u || !checkPassword(String(b.password || ''), u.hash)) return bad(res, 'That email or password isn’t right.', 401);
        setSession(res, 'ws_user', { email }, 60);
        return send(res, 200, { user: userOut(u) });
      }
      case 'me': {
        const email = userSession(req);
        if (!email) return send(res, 200, { user: null });
        const u = await redis.hgetall(`user:${email}`);
        return send(res, 200, { user: u ? userOut(u) : null });
      }
      case 'logout': clearSession(res, 'ws_user'); return send(res, 200, { ok: true });
      case 'config': return send(res, 200, { google: process.env.GOOGLE_CLIENT_ID || '' });
      case 'verify': {
        const token = clean(req.query.token, 80);
        const email = token && await redis.get(`verify:${token}`);
        if (!email) { res.statusCode = 302; res.setHeader('Location', '/account?verified=expired'); return res.end(); }
        await redis.hset(`user:${email}`, { verified: 'yes' });
        await redis.del(`verify:${token}`);
        setSession(res, 'ws_user', { email }, 60);
        res.statusCode = 302; res.setHeader('Location', '/account?verified=1'); return res.end();
      }
      case 'resend': {
        const email = userSession(req); if (!email) return bad(res, 'Please log in.', 401);
        const u = await redis.hgetall(`user:${email}`);
        if (!u) return bad(res, 'Please log in again.', 401);
        if (u.verified === 'no') {
          if (!(await rateLimit(`resend:${email}`, 3, 3600))) return bad(res, 'We’ve sent a few already. Check your junk folder, or try again in an hour.', 429);
          await sendVerify(email, u.name);
        }
        return send(res, 200, { ok: true });
      }
      case 'profile': {
        const email = userSession(req); if (!email) return bad(res, 'Please log in.', 401);
        const mobile = clean(b.mobile, 30);
        if (mobile.replace(/\D/g, '').length < 10) return bad(res, 'Add a mobile number so your coach can reach you.');
        await redis.hset(`user:${email}`, { mobile });
        return send(res, 200, { user: userOut(await redis.hgetall(`user:${email}`)) });
      }
      /* Photos and videos: "ok" (happy to be in them) or "out" (please leave me out). One setting per account; it covers
         a parent's child too. Coaches see the names of everyone who chose "out" (photo-optouts above). */
      case 'photo-pref': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const email = userSession(req); if (!email) return bad(res, 'Please log in.', 401);
        const u = await redis.hgetall(`user:${email}`); if (!u) return bad(res, 'Please log in again.', 401);
        const v = b.photos === 'out' ? 'out' : b.photos === 'ok' ? 'ok' : null;
        if (!v) return bad(res, 'Choose one of the two options.');
        if (v !== u.photos) {
          const at = Date.now();
          await redis.hset(`user:${email}`, { photos: v, photosAt: at });
          if (v === 'out') await redis.hset(OPTOUT, { [email]: JSON.stringify({ name: u.name || email.split('@')[0], at }) });
          else await redis.hdel(OPTOUT, email);
        }
        return send(res, 200, { user: userOut(await redis.hgetall(`user:${email}`)) });
      }
      case 'google': {
        if (req.method !== 'POST') return bad(res, 'Use POST', 405);
        const cid = process.env.GOOGLE_CLIENT_ID;
        if (!cid) return bad(res, 'Google sign-in isn’t switched on yet. Use your email and password.', 503);
        if (!(await rateLimit(`gsign:${ip}`, 20, 900))) return bad(res, 'Too many attempts. Try again in 15 minutes.', 429);
        let t;
        try { t = await (await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(b.credential || '')))).json(); } catch { t = null; }
        if (!t || t.aud !== cid || !['accounts.google.com', 'https://accounts.google.com'].includes(t.iss) || String(t.email_verified) !== 'true' || !t.email || Number(t.exp) * 1000 < Date.now()) return bad(res, 'Google sign-in didn’t work. Please try again or use your email.', 401);
        const email = String(t.email).toLowerCase();
        let u = await redis.hgetall(`user:${email}`);
        if (!u) {
          await redis.hset(`user:${email}`, { email, name: clean(t.name || email.split('@')[0], 80), mobile: '', hash: '', google: 'yes', verified: 'yes', created: Date.now() });
        } else if (u.verified === 'no') await redis.hset(`user:${email}`, { verified: 'yes', google: 'yes' });
        setSession(res, 'ws_user', { email }, 60);
        return send(res, 200, { user: userOut(await redis.hgetall(`user:${email}`)) });
      }
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

const OPTOUT = 'photo:optout'; // hash: member email → { name, at } for everyone who asked to be left out of photos and videos
function userOut(u) { return { email: u.email, name: u.name, mobile: u.mobile || '', verified: u.verified !== 'no', needsMobile: !(u.mobile || '').replace(/\D/g, '').length, photos: u.photos === 'out' || u.photos === 'ok' ? u.photos : '', photosAt: Number(u.photosAt) || 0 }; }
async function sendVerify(email, name) {
  if (!mailReady()) return;
  const token = crypto.randomBytes(24).toString('base64url');
  await redis.set(`verify:${token}`, email, { ex: 7 * 86400 });
  await mail(email, 'Confirm your email for Warrior Spirit', [
    `Hi ${String(name || '').split(' ')[0] || 'there'},`, 'Please confirm your email address so you can book personal training.',
    `Confirm here: ${SITE}/api/auth?action=verify&token=${token}`, 'If you didn’t create an account, ignore this email.',
  ]);
}
async function coachInfo(cid) {
  const c = COACHES[cid];
  const team = Object.values(COACHES).filter(x => x.active).map(x => ({ id: x.id, name: x.name, first: x.first }));
  const email = await coachEmail(cid), twoStep = await twoStepState(cid);
  return { id: c.id, name: c.name, first: c.first, admin: c.admin, email, passwordChanged: !!(await redis.get(`coach:${cid}:hash`)), team,
    twoStep, needsEmail: twoStep !== 'off' && !email, ask: askWho(cid) };
}
const envEmail = cid => (COACHES[cid]?.envEmail ? process.env[COACHES[cid].envEmail] : '') || '';
/* Saves a coach's email (booking alerts and sign-in codes). The old address is told, in case it wasn't them. */
async function changeEmail(cid, e, by) {
  const before = await coachEmail(cid);
  await redis.set(`coach:${cid}:email`, e);
  const after = await coachEmail(cid);
  if (before && before !== after) await mail(before, 'Your Warrior Spirit coach email has changed', [
    `Hi ${COACHES[cid].first},`,
    `${by ? by + ' changed the' : 'The'} email on your Warrior Spirit coach account ${by ? 'to' : 'was changed to'} ${after || 'nothing'}. Booking alerts and sign-in codes now go there.`,
    `If this wasn’t expected, tell ${askWho(cid)} straight away and change your password.`,
  ]);
}
const SESS_G = cid => SESS[cid]?.g || 0;
