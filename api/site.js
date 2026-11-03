import { Readable } from 'node:stream';
import { get, del } from '@vercel/blob';
import { accessToken, driveTrash, folderId, configured as driveConfigured, KEY_REFRESH } from './_lib/drive.js';
import { redis, COACHES, loadCoaches, send, bad, setupProblem, body, clean, coachSession, coachEmail, mail, SITE } from './_lib/core.js';
import { DEFAULT_HERO, DEFAULT_VIDEOS } from './_lib/sitedefaults.js';
import { PHOTOLIB } from './_lib/photolib.js';
import { PHOTO_USAGE, TIMETABLE_URL } from './_lib/photousage.js';
import { GALLERY, profilePhotoUrl } from './_lib/profiles.js';
import { getClasses } from './_lib/avail.js';

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
const CLASSIMG = { 'kids': 'photos/class-kids.webp', 'kids muay thai': 'photos/class-kids.webp', 'pads': 'photos/class-pads.webp', 'drills & sparring': 'photos/class-drills.webp', 'sparring': 'photos/class-sparring.webp', 'beginners': 'photos/class-beginners.webp', 'personal training': 'photos/class-pt.webp', 'open gym': 'photos/class-gym.webp' };
/* ---- page text and photo swaps ---- */
const KEY = /^[\w\-]{1,40}\.[\w\-]{1,60}$/;
const safeHtml = h => String(h).slice(0, 4000).replace(/<(\/?)(\w+)[^>]*>/g, (m, s, t) => /^(br|strong|em|b|i)$/i.test(t) ? `<${s}${t.toLowerCase()}>` : '').slice(0, 3000);
async function library() {
  const hid = new Set(((await redis.smembers('site:libhide')) || []).map(String));
  return [...PHOTOLIB.map(p => ({ ...p, builtin: true })), ...((await redis.get('site:library')) || [])].filter(p => !hid.has(p.src));
}
/* ---- Where is each photo shown on the website? ----
   Put together from: the homepage carousel (site:hero), every photo on the public pages (PHOTO_USAGE, made by
   tools/build-pages.mjs) with owners' swaps (site:images), the class pictures on the timetable (site:classimg),
   and the coach pages (live profile gallery, the standard gallery, the main photo). */
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const STATIC_TIMETABLE = ['Kids', 'Drills & sparring', 'Pads', 'Beginners', 'Sparring', 'Personal training'];
const mergedCI = ci => Object.fromEntries(Object.entries({ ...CLASSIMG, ...(ci || {}) }).filter(([, v]) => v));
/* The picture a timetable card shows, picked the same way as the public page. Returns [the key it came from, the photo]. */
function classPick(name, merged) { const n = norm(name); if (merged[n]) return [n, merged[n]]; if (/kid/.test(n) && merged.kids) return ['kids', merged.kids]; return [n, '']; }
const andList = a => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
const galList = g => String(g || '').split('|').filter(Boolean);
/* "photos/poster-dino.webp" → "Poster dino"; uploads lose their time stamp */
const nameFromFile = src => { const f = src.split('/').pop().replace(/\.\w+$/, '').replace(/^\d{10,}-/, '').replace(/[-_]+/g, ' ').trim(); return f ? f[0].toUpperCase() + f.slice(1) : 'Photo'; };

async function siteState() {
  const [hero, imgs, ci, classes, lib] = await Promise.all([redis.get('site:hero'), redis.get('site:images'), redis.get('site:classimg'), getClasses(), redis.get('site:library')]);
  const profiles = {}, drafts = {};
  await Promise.all(Object.keys(COACHES).map(async c => { [profiles[c], drafts[c]] = await Promise.all([redis.get(`profile:${c}:live`), redis.get(`profile:${c}:draft`)]); }));
  /* class names on the timetable: the coach area's schedule, or the page's built-in timetable if there is none */
  const live = (classes || []).filter(k => COACHES[k.coach]);
  const names = live.length ? [...new Set(live.map(k => k.name))] : STATIC_TIMETABLE.slice();
  if (live.length && !live.some(k => k.day === 6)) names.push('Personal training');
  return { hero: hero?.items || DEFAULT_HERO, imgs: imgs || {}, ci: ci || {}, names, profiles, drafts, libSrcs: new Set([...PHOTOLIB, ...(lib || [])].map(x => x.src)) };
}
/* Map of photo → every place it is shown. Each place: kind (carousel, spot, fixed, class, coach), label, page, url. */
function placesFrom(st) {
  const m = new Map(), add = (src, p) => { if (!src) return; if (!m.has(src)) m.set(src, []); m.get(src).push(p); };
  for (const h of st.hero) if (h.type !== 'video') add(h.src, { kind: 'carousel', label: 'Homepage carousel', page: 'Homepage carousel', url: '/' });
  for (const u of PHOTO_USAGE) {
    if (u.kind === 'carousel' || u.kind === 'videos') continue;
    if (u.coach && st.profiles[u.coach]?.photo) continue; // the coach's own profile photo shows here instead
    const o = u.key && st.imgs[u.key]?.src ? st.imgs[u.key] : null;
    add(o ? o.src : u.src, { kind: u.kind, ...(u.key ? { key: u.key } : {}), label: u.page + (u.place ? `: ${u.place}` : ''), page: u.page, url: u.url, original: !o, orig: u.src });
  }
  const merged = mergedCI(st.ci), seen = new Set();
  for (const name of st.names) {
    const [k, src] = classPick(name, merged), label = `Timetable: ${name}`;
    if (!src || seen.has(label)) continue; seen.add(label);
    add(src, { kind: 'class', name: norm(name), ckey: k, label, page: 'Class timetable', url: TIMETABLE_URL, original: !st.ci[k] });
  }
  for (const c of Object.keys(COACHES)) {
    const co = COACHES[c]; if (!co.listed) continue;
    const p = st.profiles[c], page = `${co.first}’s coach page`, url = `/team/${c}`;
    const g = galList(p?.gallery).filter(s => st.libSrcs.has(s));
    if (g.length) g.forEach(s => add(s, { kind: 'coach', coach: c, part: 'gallery', label: page, page, url }));
    else (GALLERY[c] || []).forEach(([s]) => add(s, { kind: 'coach', coach: c, part: 'standard', label: page, page, url }));
    if (!p?.photo && co.photo) add(co.photo, { kind: 'coach', coach: c, part: 'photo', label: `${page}: main photo`, page, url });
  }
  return m;
}
async function placesFor(src) { return placesFrom(await siteState()).get(src) || []; }
async function usedBy(src) { return [...new Set((await placesFor(src)).map(p => p.label))]; }
const FIXED_WHY = 'It’s built into the page design here, so it can’t be changed from the coach area.';

/* Take a photo off every place it is shown, but keep it in the library. dry: only work out what would happen.
   Carousel: removed. Page spots: back to their original. Class pictures: back to the standard picture, or none if that is this photo.
   Coach pages: taken out of the coach's gallery (and out of changes waiting for approval). Returns what was done and what is left. */
async function takeOff(src, me, dry) {
  const st = await siteState(), places = placesFrom(st).get(src) || [], done = [], left = [];
  const items = st.hero.filter(h => h.src !== src);
  if (items.length !== st.hero.length) {
    if (!items.length) left.push({ label: 'Homepage carousel', why: 'The carousel needs at least one photo. Add another one first.' });
    else { if (!dry) await redis.set('site:hero', { items, updatedAt: Date.now(), by: me.id }); done.push('Homepage carousel'); }
  }
  const imgs = Object.fromEntries(Object.entries(st.imgs).filter(([, v]) => v?.src !== src));
  if (!dry && Object.keys(imgs).length !== Object.keys(st.imgs).length) await redis.set('site:images', imgs);
  for (const p of places.filter(p => p.kind === 'spot' || p.kind === 'fixed')) {
    if (p.kind === 'fixed') left.push({ label: p.label, why: FIXED_WHY });
    else if (p.original || p.orig === src) left.push({ label: p.label, why: 'It’s the original photo here. Use “Replace everywhere” to put a different photo in.' });
    else done.push(`${p.label} (back to its original photo)`);
  }
  const ci = { ...st.ci }; let cch = false;
  for (const p of places.filter(p => p.kind === 'class')) {
    for (let i = 0; i < 4; i++) {
      const [k, cur] = classPick(p.name, mergedCI(ci)); if (cur !== src) break;
      if (ci[k]) delete ci[k]; else ci[k] = null; // undo an owner's choice; if the standard picture is this photo too, show none
      cch = true;
    }
    done.push(`${p.label} (${classPick(p.name, mergedCI(ci))[1] ? 'back to its standard picture' : 'now shows no picture'})`);
  }
  if (cch && !dry) await redis.set('site:classimg', ci);
  for (const c of new Set(places.filter(p => p.kind === 'coach').map(p => p.coach))) {
    const ps = places.filter(p => p.kind === 'coach' && p.coach === c), first = COACHES[c].first, page = `${first}’s coach page`, live = st.profiles[c];
    if (ps.some(p => p.part === 'gallery' || p.part === 'standard')) {
      if (!live) left.push({ label: page, why: `It’s one of the standard photos on ${first}’s page. Choose ${first}’s own gallery photos in My profile to change it.` });
      else {
        let g = galList(live.gallery); if (!g.length) g = (GALLERY[c] || []).map(x => x[0]);
        g = g.filter(s => s !== src);
        if (!g.length) g = (GALLERY[c] || []).map(x => x[0]).filter(s => s !== src); // an empty gallery shows the standard photos
        if (!dry) await redis.set(`profile:${c}:live`, { ...live, gallery: g.join('|'), updatedAt: Date.now() });
        done.push(`${page} (taken out of the gallery)`);
      }
    }
    if (ps.some(p => p.part === 'photo')) left.push({ label: `${page}: main photo`, why: `It’s ${first}’s main photo. Upload a different one in My profile.` });
  }
  /* changes a coach has sent for approval would bring it back, so take it out of those too */
  if (!dry) for (const c of Object.keys(COACHES)) {
    const d = st.drafts[c]; if (d && galList(d.gallery).includes(src)) await redis.set(`profile:${c}:draft`, { ...d, gallery: galList(d.gallery).filter(s => s !== src).join('|') });
  }
  return { done, left };
}
/* Swap one photo for another wherever owners can change it: carousel, page spots, class pictures. Coach pages are left to the coach. */
async function replaceEverywhere(src, to, alt, me) {
  const st = await siteState(), places = placesFrom(st).get(src) || [], done = [], left = [];
  if (st.hero.some(h => h.type !== 'video' && h.src === src)) {
    const has = st.hero.some(h => h.src === to);
    const items = has ? st.hero.filter(h => h.src !== src) : st.hero.map(h => h.type !== 'video' && h.src === src ? { ...h, src: to, alt, pos: '50% 50%' } : h);
    await redis.set('site:hero', { items, updatedAt: Date.now(), by: me.id }); done.push('Homepage carousel');
  }
  const imgs = { ...st.imgs }; let ch = false;
  for (const p of places) {
    if (p.kind === 'spot') { if (p.orig === to) delete imgs[p.key]; else imgs[p.key] = { src: to, alt, orig: p.orig }; ch = true; done.push(p.label); }
    else if (p.kind === 'fixed') left.push({ label: p.label, why: FIXED_WHY });
  }
  if (ch) await redis.set('site:images', imgs);
  const ci = { ...st.ci }; let cch = false;
  for (const p of places.filter(p => p.kind === 'class')) { if (CLASSIMG[p.ckey] === to) delete ci[p.ckey]; else ci[p.ckey] = to; cch = true; done.push(p.label); }
  if (cch) await redis.set('site:classimg', ci);
  for (const p of places.filter(p => p.kind === 'coach')) {
    const first = COACHES[p.coach].first;
    left.push({ label: p.label, why: p.part === 'photo' ? `It’s ${first}’s main photo. Upload a different one in My profile.` : `Coach pages aren’t changed by this. Change ${first}’s gallery in My profile.` });
  }
  return { done, left };
}
async function cleanEdits(d) {
  const lib = new Set((await library()).map(x => x.src));
  const out = { text: {}, images: {} };
  const t = d?.text || {}, im = d?.images || {};
  if (Object.keys(t).length + Object.keys(im).length > 300) throw new Error('Too many changes at once.');
  for (const [k, v] of Object.entries(t)) {
    if (!KEY.test(k)) continue;
    if (v === null) { out.text[k] = null; continue; }
    const html = safeHtml(v?.html ?? ''); if (!html.replace(/<[^>]+>/g, '').trim()) throw new Error('A text box can’t be left empty. Use “Put back the original” instead.');
    out.text[k] = { html, orig: safeHtml(v?.orig ?? '').slice(0, 600) };
  }
  for (const [k, v] of Object.entries(im)) {
    if (!KEY.test(k)) continue;
    if (v === null) { out.images[k] = null; continue; }
    if (!lib.has(v?.src) && !FILE.test(v?.src || '')) throw new Error('That photo isn’t in the photo library.');
    out.images[k] = { src: v.src, alt: clean(v.alt, 200), orig: clean(v.orig, 200) };
  }
  return out;
}
function merge(live, delta) { const o = { ...(live || {}) }; for (const [k, v] of Object.entries(delta || {})) { if (v === null) delete o[k]; else o[k] = v; } return o; }
const nameOf = c => COACHES[c]?.first || c;

export default async function handler(req, res) {
  const action = clean(req.query.action, 20);
  const problem = setupProblem();
  if (problem) return bad(res, problem, 503);
  try {
    /* ---- public ---- */
    if (action === 'public') {
      const [hero, videos, text, images] = await Promise.all([redis.get('site:hero'), redis.get('site:videos'), redis.get('site:text'), redis.get('site:images')]);
      res.setHeader('Cache-Control', 'no-cache, max-age=0, s-maxage=5');
      const ci = (await redis.get('site:classimg')) || {};
      return res.status(200).json({ hero: hero?.items || null, videos: videos?.items || null, text: text || null, images: images || null, classimg: Object.fromEntries(Object.entries({ ...CLASSIMG, ...ci }).filter(([, v]) => v)) });
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
    /* Changing the website itself is for the owners only. Other coaches can still read the photo library for their own profile gallery. */
    if (!me.admin && ['get', 'save', 'discard', 'classimg-save', 'overview', 'edits-get', 'edits-save', 'edits-discard', 'unpublish', 'replace-everywhere'].includes(action)) return bad(res, 'Only Jay and Steve can change the website.', 403);

    /* Photos & videos hub: the whole library, each photo with every place it is shown. Owners also get every swappable photo spot. */
    if (action === 'hub') {
      const [lib, st] = await Promise.all([library(), siteState()]);
      const pm = placesFrom(st), inLib = new Set(lib.map(p => p.src));
      const photos = lib.map(p => ({ src: p.src, name: p.name || 'Photo', by: p.by || (p.builtin ? 'club' : ''), at: p.at || 0, builtin: !!p.builtin, drive: !!p.driveId, places: pm.get(p.src) || [] }));
      /* owners also see photos that are on the site but not in the library (older carousel uploads, hidden originals) */
      if (me.admin) for (const [src, places] of pm) if (!inLib.has(src) && (FILE.test(src) || /^photos\//.test(src))) {
        photos.push({ src, name: PHOTOLIB.find(x => x.src === src)?.name || st.hero.find(h => h.src === src)?.alt || nameFromFile(src), by: '', at: 0, builtin: !FILE.test(src), extra: true, places });
      }
      const spots = me.admin ? PHOTO_USAGE.filter(u => u.key).map(u => {
        const o = st.imgs[u.key]?.src ? st.imgs[u.key] : null, pp = u.coach && st.profiles[u.coach]?.photo;
        return { key: u.key, page: u.page, place: u.place, url: u.url, orig: u.src, src: o ? o.src : u.src, swapped: !!o, ...(pp ? { profilePhoto: profilePhotoUrl(u.coach, pp), first: COACHES[u.coach]?.first || u.coach } : {}) };
      }) : [];
      const mine = st.drafts[me.id] || st.profiles[me.id];
      return send(res, 200, { photos, spots, admin: !!me.admin, me: me.id, myPage: !!COACHES[me.id]?.listed, myGallery: galList(mine?.gallery), myLive: galList(st.profiles[me.id]?.gallery), myPending: st.drafts[me.id]?.status === 'pending' });
    }
    if (action === 'where') {
      const src = clean(req.query.src || b.src, 300);
      return send(res, 200, { src, places: await placesFor(src) });
    }

    if (action === 'library') {
      const [photos, hero] = await Promise.all([library(), redis.get('site:hero')]);
      const inHero = new Set((hero?.items || DEFAULT_HERO).map(h => h.src));
      return send(res, 200, { photos: photos.map(p => inHero.has(p.src) ? { ...p, carousel: true } : p), canAdd: true, admin: !!me.admin, me: me.id });
    }
    if (action === 'library-add' && req.method === 'POST') {
      const src = clean(b.src, 300); if (!FILE.test(src)) return bad(res, 'Not a valid photo.');
      if (!me.admin && !src.includes(`path=site/${me.id}/`)) return bad(res, 'You can only add your own photos.', 403);
      const cur = (await redis.get('site:library')) || [];
      if (!cur.some(x => x.src === src)) await redis.set('site:library', [...cur, { src, name: clean(b.name, 60) || 'Added photo', by: me.id, at: Date.now() }].slice(-400));
      return send(res, 200, { ok: true });
    }
    if (action === 'library-del' && req.method === 'POST') {
      const src = clean(b.src, 300);
      const cur = (await redis.get('site:library')) || [];
      const item = cur.find(x => x.src === src), builtin = PHOTOLIB.some(p => p.src === src);
      if (!item && !builtin) return bad(res, 'That photo isn’t in the library.', 404);
      if (!me.admin && (builtin || item.by !== me.id)) return bad(res, 'You can only delete photos you added.', 403);
      if (me.admin && b.force) {
        /* Owners: take it off everywhere it's shown, then delete. If it can't come off somewhere, change nothing. */
        const plan = await takeOff(src, me, true);
        if (plan.left.length) return bad(res, `That photo can’t be taken off ${andList([...new Set(plan.left.map(x => x.label))])}, so it hasn’t been deleted. ${plan.left[0].why}`, 409);
        await takeOff(src, me, false);
      }
      const used = await usedBy(src);
      if (used.length) return bad(res, `That photo is still shown on ${andList(used)}. ${me.admin ? 'Take it off the website first.' : 'Ask Jay or Steve to take it off the website first.'}`, 409);
      if (builtin) { await redis.sadd('site:libhide', src); return send(res, 200, { ok: true, hidden: true }); }
      await redis.set('site:library', cur.filter(x => x.src !== src));
      const path = /path=(.+)$/.exec(src)?.[1];
      try { if (path) await del(path); } catch {}
      if (item.driveId) { try { await driveTrash(await accessToken(), item.driveId); } catch {} }
      return send(res, 200, { ok: true });
    }
    if (action === 'overview') {
      if (!me.admin) return bad(res, 'Only Jay and Steve can see the overview.', 403);
      const [lib, hero, vids, imgs, txt, st] = await Promise.all([library(), redis.get('site:hero'), redis.get('site:videos'), redis.get('site:images'), redis.get('site:text'), siteState()]);
      const used = placesFrom(st);
      const photos = lib.map(p => ({ src: p.src, name: p.name, by: p.by || (p.builtin ? 'club' : ''), at: p.at || 0, builtin: !!p.builtin, drive: !!p.driveId, usedOn: [...new Set((used.get(p.src) || []).map(x => x.label))] }));
      let drive = { connected: false, waiting: 0, total: 0 };
      try {
        if (driveConfigured() && await redis.get(KEY_REFRESH)) {
          const token = await accessToken(), fid = await folderId(token);
          const q = encodeURIComponent(`'${fid}' in parents and trashed=false and mimeType contains 'image/'`);
          const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=200&fields=${encodeURIComponent('files(id,name)')}`, { headers: { authorization: `Bearer ${token}` } });
          const j = await r.json().catch(() => ({})); const seen = new Set(((await redis.smembers('site:driveseen')) || []).map(String));
          drive = { connected: true, total: (j.files || []).length, waiting: (j.files || []).filter(f => !seen.has(f.id)).length };
        }
      } catch {}
      const pend = [];
      for (const c of Object.keys(COACHES)) for (const l of ['edits', 'hero', 'videos']) if (await redis.get(`site:pending:${l}:${c}`)) pend.push(`${COACHES[c].first}: ${l === 'edits' ? 'page text and photos' : LISTS[l].label.toLowerCase()}`);
      return send(res, 200, {
        photos, drive, pending: pend,
        carousel: (hero?.items || DEFAULT_HERO).map(h => ({ type: h.type, src: h.src, alt: h.alt || '' })), carouselCustom: !!hero,
        videos: (vids?.items || DEFAULT_VIDEOS).length, videosCustom: !!vids,
        textEdits: Object.keys(txt || {}).length, photoSwaps: Object.keys(imgs || {}).length,
      });
    }
    /* ---- club social posts: saved drafts every coach can reuse ---- */
    if (action === 'posts-list') {
      const posts = ((await redis.get('site:posts')) || []).slice().reverse();
      return send(res, 200, { posts, me: me.id, admin: !!me.admin });
    }
    if (action === 'posts-save' && req.method === 'POST') {
      const text = String(b.text || '').replace(/\r/g, '').trim().slice(0, 2200);
      if (!text) return bad(res, 'Write something for the post first.');
      const img = b.img ? clean(b.img, 300) : '';
      if (img) { const lib = new Set((await library()).map(x => x.src)); if (!lib.has(img) && !FILE.test(img) && !/^(photos|video)\/[\w.\-]+$/.test(img)) return bad(res, 'That picture isn’t in the photo library.'); }
      const all = (await redis.get('site:posts')) || [];
      const title = clean(b.title, 60) || text.split('\n')[0].slice(0, 60);
      const now = Date.now();
      if (b.id) {
        const i = all.findIndex(p => p.id === clean(b.id, 20)); if (i < 0) return bad(res, 'That post no longer exists.', 404);
        if (!me.admin && all[i].by !== me.id) return bad(res, 'You can only change your own posts. Use “Make a copy” to edit someone else’s.', 403);
        all[i] = { ...all[i], title, text, img, updatedAt: now };
        await redis.set('site:posts', all); return send(res, 200, { post: all[i] });
      }
      const post = { id: now.toString(36) + Math.random().toString(36).slice(2, 5), by: me.id, name: COACHES[me.id]?.first || me.id, title, text, img, at: now, updatedAt: now, path: clean(b.path, 80) };
      await redis.set('site:posts', [...all, post].slice(-300));
      return send(res, 200, { post });
    }
    if (action === 'posts-del' && req.method === 'POST') {
      const all = (await redis.get('site:posts')) || [], p = all.find(x => x.id === clean(b.id, 20));
      if (!p) return send(res, 200, { ok: true });
      if (!me.admin && p.by !== me.id) return bad(res, 'You can only delete your own posts.', 403);
      await redis.set('site:posts', all.filter(x => x !== p)); return send(res, 200, { ok: true });
    }
    if (action === 'classimg-get') {
      const ci = (await redis.get('site:classimg')) || {};
      return send(res, 200, { images: Object.fromEntries(Object.entries({ ...CLASSIMG, ...ci }).filter(([, v]) => v)) });
    }
    if (action === 'classimg-save' && req.method === 'POST') {
      if (!me.admin) return bad(res, 'Only Jay and Steve can change the class pictures.', 403);
      const name = clean(b.name, 60).toLowerCase().replace(/\s+/g, ' ').trim(); if (!name) return bad(res, 'Which class?');
      const lib = new Set((await library()).map(x => x.src)), src = b.src ? clean(b.src, 300) : null;
      if (src && !lib.has(src) && !FILE.test(src)) return bad(res, 'That photo isn’t in the photo library.');
      const ci = (await redis.get('site:classimg')) || {};
      if (b.reset) delete ci[name]; else ci[name] = src;
      await redis.set('site:classimg', ci);
      return send(res, 200, { ok: true });
    }
    if (action === 'edits-get') {
      const [text, images, mine] = await Promise.all([redis.get('site:text'), redis.get('site:images'), redis.get(`site:pending:edits:${me.id}`)]);
      return send(res, 200, { text: text || {}, images: images || {}, pending: mine || null, admin: !!me.admin, me: me.id });
    }
    if (action === 'edits-save' && req.method === 'POST') {
      let d; try { d = await cleanEdits(b); } catch (e) { return bad(res, e.message); }
      if (me.admin) {
        const [t, i] = await Promise.all([redis.get('site:text'), redis.get('site:images')]);
        await redis.set('site:text', merge(t, Object.fromEntries(Object.entries(d.text).map(([k, v]) => [k, v && { html: v.html, orig: v.orig }]))));
        await redis.set('site:images', merge(i, Object.fromEntries(Object.entries(d.images).map(([k, v]) => [k, v && { src: v.src, alt: v.alt, orig: v.orig }]))));
        await redis.del(`site:pending:edits:${me.id}`);
        return send(res, 200, { status: 'live' });
      }
      const prev = (await redis.get(`site:pending:edits:${me.id}`)) || { text: {}, images: {} };
      const next = { text: { ...prev.text, ...d.text }, images: { ...prev.images, ...d.images }, by: me.id, at: Date.now(), note: clean(b.note, 300) };
      await redis.set(`site:pending:edits:${me.id}`, next);
      const to = await Promise.all(['jay', 'steve'].map(coachEmail));
      await mail(to.filter(Boolean), `${nameOf(me.id)} has edited the website`, [`${COACHES[me.id].name} has changed some wording or photos on the website.`, 'They won’t show until you approve them.', `Review them here: ${SITE}/coach#photos/carousel`]);
      return send(res, 200, { status: 'pending' });
    }
    if (action === 'edits-discard' && req.method === 'POST') { await redis.del(`site:pending:edits:${me.id}`); return send(res, 200, { ok: true }); }

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
        'They won’t show until you approve them.', `Review them here: ${SITE}/coach#photos/carousel`]);
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
      for (const c of Object.keys(COACHES)) {
        const p = await redis.get(`site:pending:edits:${c}`);
        if (p) out.push({ list: 'edits', label: 'Page text and photos', coach: c, name: COACHES[c].first, at: p.at, note: p.note || '', text: p.text, images: p.images });
      }
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
      if (list === 'edits' && COACHES[c]) {
        const key = `site:pending:edits:${c}`, p = await redis.get(key);
        if (!p) return bad(res, 'Nothing waiting for approval.', 404);
        const to = await coachEmail(c);
        if (b.decision === 'approve') {
          const [t, i] = await Promise.all([redis.get('site:text'), redis.get('site:images')]);
          await redis.set('site:text', merge(t, p.text)); await redis.set('site:images', merge(i, p.images)); await redis.del(key);
          if (to) await mail(to, 'Your website edits are live', ['Your wording and photo changes were approved and are now on the website.', SITE]);
          return send(res, 200, { status: 'live' });
        }
        await redis.del(key);
        const note = clean(b.note, 300);
        if (to) await mail(to, 'Website edits not approved', ['Your wording and photo changes weren’t approved this time.', note ? `Note: ${note}` : ''].filter(Boolean));
        return send(res, 200, { status: 'rejected' });
      }
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
      if (to) await mail(to, 'Website changes not approved', [`Your changes to the ${LISTS[list].label.toLowerCase()} weren’t approved this time.`, note ? `Note: ${note}` : '', `You can try again here: ${SITE}/coach#photos`].filter(Boolean));
      return send(res, 200, { status: 'rejected' });
    }

    if (action === 'reset' && req.method === 'POST') {
      if (!LISTS[list]) return bad(res, 'Unknown list.', 404);
      await redis.del(`site:${list}`);
      return send(res, 200, { ok: true });
    }

    /* Take a photo off the website everywhere it's shown, keeping it in the library. */
    if (action === 'unpublish' && req.method === 'POST') {
      const src = clean(b.src, 300);
      if (!okSrc(src)) return bad(res, 'Not a valid photo.');
      const lib = new Set((await library()).map(x => x.src));
      if (!lib.has(src) && !(await placesFor(src)).length) return bad(res, 'That photo isn’t in the photo library.', 404);
      return send(res, 200, await takeOff(src, me, false));
    }
    /* Swap a photo for another library photo in the carousel, page spots and class pictures. */
    if (action === 'replace-everywhere' && req.method === 'POST') {
      const src = clean(b.src, 300), to = clean(b.to, 300);
      if (!okSrc(src) || !okSrc(to)) return bad(res, 'Not a valid photo.');
      if (src === to) return bad(res, 'Pick a different photo.');
      const libList = await library(), lib = new Set(libList.map(x => x.src));
      if (!lib.has(to)) return bad(res, 'The new photo isn’t in the photo library.', 404);
      if (!lib.has(src) && !(await placesFor(src)).length) return bad(res, 'That photo isn’t in the photo library.', 404);
      const p = libList.find(x => x.src === to), alt = p?.builtin ? clean(p.name, 200) : '';
      return send(res, 200, await replaceEverywhere(src, to, alt, me));
    }
    return bad(res, 'Unknown action', 404);
  } catch (e) {
    console.error(e);
    return bad(res, 'Something went wrong on our side. Please try again.', 500);
  }
}
