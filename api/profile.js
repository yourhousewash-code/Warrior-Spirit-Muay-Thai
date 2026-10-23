import { Readable } from 'node:stream';
import { get } from '@vercel/blob';
import { redis, COACHES, send, bad, setupProblem, body, clean, coachSession, coachEmail, mail, SITE } from './_lib/core.js';

/* What each coach's profile says on the website today. Coaches edit from here; Jay approves Aaron's and Kian's changes. */
const DEFAULTS = {
  jay: {
    role: 'Owner & head coach',
    intro: 'James “Jay” Shepherd has been teaching kickboxing for over 18 years and holds a 3rd Dan black belt. He coaches people of every age, from seven-year-olds at their first class to adults getting fit and fighters getting ready for the ring.',
    background: 'He leads the fight team and runs fight camps, building each camp backwards from the fight date. His fighters have competed at amateur and semi-pro level, and he has taken kids to around a hundred interclubs, so he knows how to bring a nervous first-timer through their first bout as well as how to sharpen an experienced fighter.\n\nIn the gym he\'s the one holding the pads, watching your feet and telling you the one thing that will make the next round better. On fight night he\'s in the corner.',
    chips: 'Qualified kickboxing coach\nDBS checked\nFirst-aid trained\nHead coach\nFight team\nFight camps\nKids & juniors\nCornering\n1-to-1 PT',
    ask: 'your first interclub, fight camp, or getting your child started.',
    instagram: '',
  },
  aaron: {
    role: 'Trainer',
    intro: 'Aaron trains members on the pads and in the classes, and makes sure every round counts.',
    background: '', chips: 'Trainer\nPads\nClasses', ask: '', instagram: 'aaronbekir_',
  },
  kian: {
    role: 'Trainer',
    intro: 'Kian coaches in the classes and on the pads, helping members tighten up their technique.',
    background: '', chips: 'Trainer\nFought at MAX Muay Thai, Thailand\nTechnique\nClasses', ask: '', instagram: 'kianh_pt',
  },
};
const FIELDS = { role: 40, intro: 500, background: 2000, chips: 400, ask: 160, instagram: 40, photo: 300 };

async function live(c) { return (await redis.get(`profile:${c}:live`)) || { ...DEFAULTS[c], photo: '' }; }
async function draft(c) { return await redis.get(`profile:${c}:draft`); }
function cleanProfile(c, inp) {
  const out = {};
  for (const [k, max] of Object.entries(FIELDS)) out[k] = clean(String(inp?.[k] ?? ''), max).replace(/\r/g, '');
  /* clean() may squash newlines; keep paragraph breaks in the background text */
  out.background = String(inp?.background ?? '').replace(/\r/g, '').slice(0, FIELDS.background).replace(/[<>]/g, '').trim();
  out.instagram = out.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/[/?#].*$/, '');
  if (out.photo && !out.photo.startsWith(`profiles/${c}/`)) out.photo = '';
  return out;
}
const photoUrl = (c, p) => p ? `/api/profile?action=photo&coach=${c}&v=${encodeURIComponent(p.split('/').pop())}` : '';

export default async function handler(req, res) {
  const problem = setupProblem();
  if (problem) return bad(res, problem, 503);
  const action = clean(req.query.action, 30);
  const b = body(req);
  try {
    /* ----- public: approved profiles for the website ----- */
    if (action === 'public') {
      const out = {};
      for (const c of Object.keys(COACHES)) {
        const p = await redis.get(`profile:${c}:live`);
        if (p) out[c] = { ...p, photo: photoUrl(c, p.photo) };
      }
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
      return send(res, 200, { profiles: out });
    }
    if (action === 'photo') {
      const c = clean(req.query.coach, 20);
      const prev = req.query.preview && coachSession(req);
      let path = '';
      if (prev && (prev.admin || prev.id === c)) path = (await draft(c))?.photo || '';
      if (!path) path = (await redis.get(`profile:${c}:live`))?.photo || '';
      if (!COACHES[c] || !path) return bad(res, 'No photo.', 404);
      const r = await get(path, { access: 'private' });
      if (!r || r.statusCode !== 200) return bad(res, 'No photo.', 404);
      res.setHeader('Content-Type', r.blob.contentType || 'image/jpeg');
      res.setHeader('Cache-Control', prev ? 'private, no-store' : 'public, max-age=86400');
      Readable.fromWeb(r.stream).pipe(res);
      return;
    }

    const me = coachSession(req);
    if (!me) return bad(res, 'Please log in.', 401);

    if (action === 'mine') {
      const c = me.admin && COACHES[req.query.coach] ? req.query.coach : me.id;
      const l = await live(c), d = await draft(c);
      const out = { coach: c, live: { ...l, photoUrl: photoUrl(c, l.photo) }, draft: d ? { ...d, photoUrl: d.photo ? `/api/profile?action=photo&coach=${c}&preview=1&v=${encodeURIComponent(d.photo.split('/').pop())}` : '' } : null };
      if (me.admin) {
        out.pending = [];
        for (const k of Object.keys(COACHES)) {
          const dd = await draft(k);
          if (dd && dd.status === 'pending') {
            const ll = await live(k);
            out.pending.push({ coach: k, name: COACHES[k].first, submittedAt: dd.submittedAt, live: { ...ll, photoUrl: photoUrl(k, ll.photo) },
              draft: { ...dd, photoUrl: dd.photo ? `/api/profile?action=photo&coach=${k}&preview=1&v=${encodeURIComponent(dd.photo.split('/').pop())}` : '' } });
          }
        }
      }
      return send(res, 200, out);
    }

    if (action === 'save' && req.method === 'POST') {
      const c = me.admin && COACHES[b.coach] ? b.coach : me.id;
      const p = cleanProfile(c, b.profile);
      if (!p.intro) return bad(res, 'Add a short intro about yourself.');
      if (me.admin) {
        /* Jay's changes (to his own or anyone's profile) go live straight away. */
        await redis.set(`profile:${c}:live`, { ...p, updatedAt: Date.now(), approvedBy: 'jay' });
        await redis.del(`profile:${c}:draft`);
        return send(res, 200, { status: 'live' });
      }
      await redis.set(`profile:${c}:draft`, { ...p, status: 'pending', submittedAt: Date.now() });
      const jay = await coachEmail('jay');
      if (jay) await mail(jay, `${COACHES[c].first} has updated their profile`, [
        `${COACHES[c].name} has sent profile changes for the website.`,
        'They won’t show on the website until you approve them.',
        `Review them here: ${SITE}/coach`,
      ]);
      return send(res, 200, { status: 'pending' });
    }

    if (action === 'review' && req.method === 'POST') {
      if (!me.admin) return bad(res, 'Only Jay can approve profile changes.', 403);
      const c = clean(b.coach, 20);
      const d = await draft(c);
      if (!COACHES[c] || !d || d.status !== 'pending') return bad(res, 'Nothing waiting for approval.', 404);
      const to = await coachEmail(c);
      if (b.decision === 'approve') {
        const { status, submittedAt, note, ...p } = d;
        await redis.set(`profile:${c}:live`, { ...p, updatedAt: Date.now(), approvedBy: 'jay' });
        await redis.del(`profile:${c}:draft`);
        if (to) await mail(to, 'Your profile is live', ['Jay approved your profile changes. They’re now on the website.', `${SITE}/#team`]);
        return send(res, 200, { status: 'live' });
      }
      const note = clean(b.note, 400);
      await redis.set(`profile:${c}:draft`, { ...d, status: 'returned', note, reviewedAt: Date.now() });
      if (to) await mail(to, 'Jay sent your profile back', ['Jay has asked for a change before your profile goes live.', note ? `Jay says: ${note}` : '', `Edit it here: ${SITE}/coach#profile`].filter(Boolean));
      return send(res, 200, { status: 'returned' });
    }

    if (action === 'discard' && req.method === 'POST') {
      const c = me.admin && COACHES[b.coach] ? b.coach : me.id;
      await redis.del(`profile:${c}:draft`);
      return send(res, 200, { ok: true });
    }
    return bad(res, 'Unknown action', 404);
  } catch (e) {
    console.error(e);
    return bad(res, 'Something went wrong on our side. Please try again.', 500);
  }
}
