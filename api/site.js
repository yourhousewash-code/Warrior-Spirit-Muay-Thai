import { Readable } from 'node:stream';
import { get } from '@vercel/blob';
import { redis, COACHES, loadCoaches, send, bad, setupProblem, body, clean, coachSession, coachEmail, mail, SITE } from './_lib/core.js';
import { DEFAULT_HERO, DEFAULT_VIDEOS } from './_lib/sitedefaults.js';

/* Website photos and videos that coaches can change.
   LISTS: the hero carousel and the video gallery. Until someone edits a list, the website keeps its built-in version.
   Owners (Jay, Steve) publish straight away. Other coaches send changes for an owner to approve. */
const LISTS = { hero: { def: DEFAULT_HERO, max: 40, label: 'Homepage carousel' }, videos: { def: DEFAULT_VIDEOS, max: 60, label: 'Video gallery' } };
const FILE = /^\/api\/site\?action=file&path=site\/[a-z]+\/[\w.\-]+$/;
const STATIC = /^(photos|video|img)\/[\w.\-\/]+$/;
const okSrc = s => typeof s === 'string' && s.length < 300 && (FILE.test(s) || STATIC.test(s));
const CATS = new Set(['fight', 'fight win', 'win', 'training', 'training win']);

function cleanItems(list, input) {
  if (!Array.isArray(input) || !input.length) throw new Error('Keep at least one item in the list.');
  if (input.length > LISTS[list].max) throw new Error(`Too many items (max ${LISTS[list].max}).`);
  const seen = new Set();
  return input.map((x, n) => {
    const idv = clean(x.id, 30).replace(/[^\w\-]/g, '') || `n${Date.now().toString(36)}${n}`;
    if (seen.has(idv)) throw new Error('Duplicate item.'); seen.add(idv);
    if (!okSrc(x.src)) throw new Error('One of the files isn’t valid. Try uploading it again.');
    if (x.poster && !okSrc(x.poster)) throw new Error('A video thumbnail isn’t valid. Try uploading the video again.');
    if (list === 'hero') {
      const type = x.type === 'video' ? 'video' : 'photo';
      if (type === 'video' && !x.poster) throw new Error('A video in the carousel needs a thumbnail.');
      const m = /^(\d{1,3})% (\d{1,3})%$/.exec(String(x.pos || ''));
      return { id: idv, type, src: x.src, ...(type === 'video' ? { poster: x.poster } : {}), alt: clean(x.alt, 200), pos: m ? `${Math.min(100, +m[1])}% ${Math.min(100, +m[2])}%` : '60% 35%' };
    }
    const title = clean(x.title, 80); if (!title) throw new Error('Every video needs a title.');
    if (!x.poster) throw new Error('Every video needs a thumbnail.');
    const cat = CATS.has(x.cat) ? x.cat : 'fight';
    return { id: idv, src: x.src, poster: x.poster, title, caption: clean(x.caption, 200), date: clean(x.date, 30), cat, dur: clean(x.dur, 8) };
  });
}
const nameOf = c => COACHES[c]?.first || c;

export default async function handler(req, res) {
  const action = clean(req.query.action, 20);
  const problem = setupProblem();
  if (problem) return bad(res, problem, 503);
  try {
    /* ---- public ---- */
    if (action === 'public') {
      const [hero, videos] = await Promise.all([redis.get('site:hero'), redis.get('site:videos')]);
      res.setHeader('Cache-Control', 'public, max-age=20, s-maxage=30, stale-while-revalidate=300');
      return res.status(200).json({ hero: hero?.items || null, videos: videos?.items || null });
    }
    if (action === 'file') {
      const path = clean(req.query.path, 300);
      if (!/^site\/[a-z]+\/[\w.\-]+$/.test(path)) return bad(res, 'No file.', 404);
      const r = await get(path, { access: 'private' });
      if (!r || r.statusCode !== 200) return bad(res, 'No file.', 404);
      res.setHeader('Content-Type', r.blob.contentType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return Readable.fromWeb(r.stream).pipe(res);
    }

    /* ---- coaches ---- */
    await loadCoaches();
    const me = coachSession(req);
    if (!me) return bad(res, 'Please log in.', 401);
    const b = body(req);
    const list = clean(req.query.list || b.list, 10);

    if (action === 'get') {
      if (!LISTS[list]) return bad(res, 'Unknown list.', 404);
      const live = await redis.get(`site:${list}`);
      const mine = await redis.get(`site:pending:${list}:${me.id}`);
      return send(res, 200, { items: live?.items || LISTS[list].def, custom: !!live, pending: mine || null });
    }

    if (action === 'save' && req.method === 'POST') {
      if (!LISTS[list]) return bad(res, 'Unknown list.', 404);
      let items;
      try { items = cleanItems(list, b.items); } catch (e) { return bad(res, e.message); }
      if (me.admin) {
        await redis.set(`site:${list}`, { items, updatedAt: Date.now(), by: me.id });
        await redis.del(`site:pending:${list}:${me.id}`);
        return send(res, 200, { status: 'live' });
      }
      await redis.set(`site:pending:${list}:${me.id}`, { items, by: me.id, at: Date.now(), note: clean(b.note, 300) });
      const to = await Promise.all(['jay', 'steve'].map(coachEmail));
      await mail(to.filter(Boolean), `${nameOf(me.id)} has changed the website ${LISTS[list].label.toLowerCase()}`, [
        `${COACHES[me.id].name} has sent changes to the ${LISTS[list].label.toLowerCase()} on the website.`,
        'They won’t show until you approve them.', `Review them here: ${SITE}/coach#club`]);
      return send(res, 200, { status: 'pending' });
    }

    if (action === 'discard' && req.method === 'POST') {
      if (!LISTS[list]) return bad(res, 'Unknown list.', 404);
      await redis.del(`site:pending:${list}:${me.id}`);
      return send(res, 200, { ok: true });
    }

    /* ---- owners ---- */
    if (!me.admin) return bad(res, 'Only the owners can do that.', 403);

    if (action === 'pending') {
      const out = [];
      for (const l of Object.keys(LISTS)) {
        const live = (await redis.get(`site:${l}`))?.items || LISTS[l].def;
        for (const c of Object.keys(COACHES)) {
          const p = await redis.get(`site:pending:${l}:${c}`);
          if (p) out.push({ list: l, label: LISTS[l].label, coach: c, name: COACHES[c].first, at: p.at, note: p.note || '', items: p.items, live });
        }
      }
      return send(res, 200, { pending: out });
    }

    if (action === 'review' && req.method === 'POST') {
      const c = clean(b.coach, 20);
      if (!LISTS[list] || !COACHES[c]) return bad(res, 'Unknown request.', 404);
      const key = `site:pending:${list}:${c}`;
      const p = await redis.get(key);
      if (!p) return bad(res, 'Nothing waiting for approval.', 404);
      const to = await coachEmail(c);
      if (b.decision === 'approve') {
        await redis.set(`site:${list}`, { items: p.items, updatedAt: Date.now(), by: me.id, approvedFor: c });
        await redis.del(key);
        if (to) await mail(to, 'Your website changes are live', [`Your changes to the ${LISTS[list].label.toLowerCase()} were approved and are now on the website.`, SITE]);
        return send(res, 200, { status: 'live' });
      }
      await redis.del(key);
      const note = clean(b.note, 300);
      if (to) await mail(to, 'Website changes not approved', [`Your changes to the ${LISTS[list].label.toLowerCase()} weren’t approved this time.`, note ? `Note: ${note}` : '', `You can try again here: ${SITE}/coach#club`].filter(Boolean));
      return send(res, 200, { status: 'rejected' });
    }

    if (action === 'reset' && req.method === 'POST') {
      if (!LISTS[list]) return bad(res, 'Unknown list.', 404);
      await redis.del(`site:${list}`);
      return send(res, 200, { ok: true });
    }
    return bad(res, 'Unknown action', 404);
  } catch (e) {
    console.error(e);
    return bad(res, 'Something went wrong on our side. Please try again.', 500);
  }
}
