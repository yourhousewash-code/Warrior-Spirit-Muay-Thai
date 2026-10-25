/* Coach pages: /team/jay, /team/aaron, … built on the server so search engines can read them. */
import {
  COACHES, loadCoaches, publicIds, setupProblem, getPrices, priceOf, FORMATS, DURATIONS, minsLabel, SITE, ADDRESS, TZ,
} from './_lib/core.js';
import { liveProfile, profilePhotoUrl } from './_lib/profiles.js';
import { getClasses, freeIntervals, startsIn, DAY } from './_lib/avail.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const GALLERY = {
  jay: [['photos/pads-1.webp', 'Jay holding pads'], ['photos/kids-coach.webp', 'Jay coaching a junior'], ['photos/jay-win.webp', 'Jay celebrating a win'], ['photos/corner-crowd.webp', 'Jay in the corner']],
};
const hm = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`; };
const money = v => '£' + (Number.isInteger(v) ? v : v.toFixed(2));
const dayLabel = ms => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(ms));
const tm = ms => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

export default async function handler(req, res) {
  const id = String(req.query.id || '').toLowerCase().replace(/[^a-z]/g, '');
  if (setupProblem()) return page(res, 503, 'Coming soon', '<p class="lede">Coach pages are being set up. <a href="/#team">Meet the team</a>.</p>');
  try {
    await loadCoaches();
    const c = COACHES[id];
    if (!c || !c.listed) return page(res, 404, 'Coach not found', '<p class="lede">We couldn’t find that coach. <a href="/#team">Meet the team</a>.</p>');
    const p = await liveProfile(id);
    const prices = await getPrices(id);
    const photo = profilePhotoUrl(id, p.photo) || c.photo || '/img/logo.webp';
    const paras = String(p.background || '').split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
    const chips = String(p.chips || '').split('\n').map(t => t.trim()).filter(Boolean);

    /* next free 1-hour slots, or whatever length they offer */
    const fmtKey = Object.keys(FORMATS).find(f => DURATIONS.some(m => priceOf(prices, f, m))) || 'one';
    const mins = priceOf(prices, 'one', 60) ? 60 : DURATIONS.find(m => priceOf(prices, fmtKey, m)) || 60;
    const from = Date.now() + 2 * 3600e3;
    let lastKept = 0;
    const starts = startsIn(await freeIntervals(id, from, from + 14 * DAY), mins, from)
      .filter(t => { if (t >= lastKept + mins * 6e4) { lastKept = t; return true; } return false; }).slice(0, 12);
    const classes = (await getClasses()).filter(k => k.coach === id).sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7) || a.start.localeCompare(b.start));
    const others = publicIds().filter(k => k !== id).map(k => COACHES[k]);

    const priceRows = Object.entries(FORMATS).filter(([f]) => DURATIONS.some(m => priceOf(prices, f, m))).map(([f, v]) => `<tr><th scope="row">${esc(v.name)}<small>${esc(f === 'group' ? `3 to ${prices.groupMax || 6} people` : v.people)}</small></th>${DURATIONS.map(m => { const pr = priceOf(prices, f, m); return `<td>${pr ? `<a href="/book?coach=${id}&format=${f}&mins=${m}">${money(pr)}</a>` : '<span class="na">–</span>'}</td>`; }).join('')}</tr>`).join('');
    const lowest = Math.min(...Object.keys(FORMATS).flatMap(f => DURATIONS.map(m => priceOf(prices, f, m))).filter(Boolean));

    let lastDay = '';
    const slotHtml = starts.length ? starts.map(t => {
      const d = dayLabel(t), head = d !== lastDay ? `<span class="sd">${esc(d)}</span>` : ''; lastDay = d;
      return `${head}<a class="st" href="/book?coach=${id}&format=one&mins=${mins}&start=${t}">${tm(t)}</a>`;
    }).join('') : `<p class="muted">No free times in the next two weeks. <a href="/#contact">Send us a message</a> and we’ll find you a slot.</p>`;

    const title = `${c.name} | Muay Thai Coach & Personal Trainer, Potters Bar | Warrior Spirit`;
    const desc = (p.intro || `${c.name} coaches Muay Thai and kickboxing at Warrior Spirit, Potters Bar. Book 1-to-1, double or group personal training.`).slice(0, 158);
    const ld = {
      '@context': 'https://schema.org', '@type': 'Person', name: c.name, jobTitle: p.role || 'Muay Thai coach', description: p.intro || undefined,
      image: photo.startsWith('http') ? photo : SITE + '/' + photo.replace(/^\//, ''), url: `${SITE}/team/${id}`,
      sameAs: p.instagram ? [`https://www.instagram.com/${p.instagram}/`] : undefined,
      worksFor: { '@type': 'SportsActivityLocation', name: 'Warrior Spirit Muay Thai & Kickboxing', address: ADDRESS, url: SITE },
      makesOffer: Number.isFinite(lowest) ? { '@type': 'Offer', name: 'Personal training', priceCurrency: 'GBP', price: lowest } : undefined,
    };
    const gallery = (GALLERY[id] || []).map(([src, alt]) => `<div class="g"><img src="/${src}" alt="${esc(alt)}" loading="lazy"></div>`).join('');

    const body = `
<section class="hero">
  <div class="hp"><img src="${esc(photo.startsWith('/') || photo.startsWith('http') ? photo : '/' + photo)}" alt="${esc(c.name)}"></div>
  <div class="stack">
    <span class="kick">${esc(p.role || 'Coach')} · Warrior Spirit, Potters Bar</span>
    <h1>${esc(c.name)}</h1>
    ${p.intro ? `<p class="lede">${esc(p.intro)}</p>` : ''}
    <div class="row">
      <a class="btn" href="/book?coach=${id}">Book a session with ${esc(c.first)}</a>
      ${p.instagram ? `<a class="btn ghost" href="https://www.instagram.com/${esc(p.instagram)}/" target="_blank" rel="noopener">@${esc(p.instagram)}</a>` : ''}
    </div>
    ${Number.isFinite(lowest) ? `<p class="muted">Personal training from ${money(lowest)} · pay at the gym</p>` : ''}
  </div>
</section>

${paras.length || chips.length || p.ask ? `<section class="panel about">
  <h2>About ${esc(c.first)}</h2>
  ${paras.map(t => `<p>${esc(t)}</p>`).join('')}
  ${chips.length ? `<div class="chips">${chips.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
  ${p.ask ? `<p class="ask"><b>Ask ${esc(c.first)} about</b> ${esc(p.ask)}</p>` : ''}
</section>` : ''}

${gallery ? `<section class="gal">${gallery}</section>` : ''}

<div class="two">
  <section class="panel">
    <h2>Next free times</h2>
    <p class="muted">${esc(minsLabel(mins))} sessions in the next two weeks. Tap a time to book it.</p>
    <div class="slotsl">${slotHtml}</div>
    <a class="more" href="/book?coach=${id}">See all times and options →</a>
  </section>
  <section class="panel">
    <h2>Prices</h2>
    ${priceRows ? `<table class="pt"><thead><tr><td></td>${DURATIONS.map(m => `<th scope="col">${esc(minsLabel(m))}</th>`).join('')}</tr></thead><tbody>${priceRows}</tbody></table>
    <p class="muted">Price per session, not per person. Paid at the gym.</p>` : '<p class="muted">Ask at the gym for prices.</p>'}
  </section>
</div>

${classes.length ? `<section class="panel">
  <h2>Classes ${esc(c.first)} teaches</h2>
  <ul class="cls">${classes.map(k => `<li><b>${DAYS[k.day]}</b><span>${hm(k.start)}–${hm(k.end)}</span><span>${esc(k.name)}</span></li>`).join('')}</ul>
  <p class="muted">Your first class is free. <a href="/#timetable">See the full timetable</a>.</p>
</section>` : ''}

${others.length ? `<section class="others"><h2>Other coaches</h2><div class="ol">${others.map(o => `<a href="/team/${o.id}"><img src="${esc((o.photoUrl || o.photo || 'img/logo.webp').replace(/^(?!\/|http)/, '/'))}" alt="" loading="lazy"><span>${esc(o.name)}</span></a>`).join('')}</div></section>` : ''}

<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
    return page(res, 200, title, body, desc, `${SITE}/team/${id}`, photo);
  } catch (e) {
    console.error(e);
    return page(res, 500, 'Something went wrong', '<p class="lede">Please try again in a moment. <a href="/#team">Meet the team</a>.</p>');
  }
}

function page(res, status, title, body, desc = '', canonical = '', image = '') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="index, follow">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ''}
${canonical ? `<link rel="canonical" href="${esc(canonical)}"><meta property="og:url" content="${esc(canonical)}">` : ''}
<meta property="og:title" content="${esc(title)}">${desc ? `<meta property="og:description" content="${esc(desc)}">` : ''}
${image ? `<meta property="og:image" content="${esc(image.startsWith('http') ? image : SITE + '/' + image.replace(/^\//, ''))}">` : ''}
<link rel="icon" href="/img/logo.webp" type="image/webp">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@900&family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@700&display=swap">
<link rel="stylesheet" href="/assets/app.css">
<style>
main{display:grid;gap:22px}
.hero{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:32px;align-items:center}
.hp{aspect-ratio:4/5;overflow:hidden;background:var(--ink-2);border-bottom:4px solid var(--red)}
.hp img{width:100%;height:100%;object-fit:cover;object-position:50% 20%}
.hero h1{font-size:clamp(52px,8vw,96px)}
.about p{color:var(--soft);max-width:70ch}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips span{border:1px solid var(--line);padding:6px 10px;font:700 13px var(--cond);letter-spacing:.1em;text-transform:uppercase;color:var(--soft)}
.ask{border-left:4px solid var(--red);padding-left:12px;color:var(--soft)}
.gal{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.g{aspect-ratio:1;overflow:hidden}.g img{width:100%;height:100%;object-fit:cover}
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.slotsl{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.sd{width:100%;font:700 14px var(--cond);letter-spacing:.14em;text-transform:uppercase;color:var(--red);margin-top:6px}
.st{border:1px solid var(--line);background:var(--ink);padding:10px 14px;font:700 16px var(--cond);text-decoration:none}
.st:hover{border-color:var(--free,#1f9d55);background:rgba(31,157,85,.16)}
.more{font:700 14px var(--cond);letter-spacing:.12em;text-transform:uppercase;color:var(--soft)}
.pt{width:100%;border-collapse:collapse}
.pt th,.pt td{padding:10px 8px;border-bottom:1px solid var(--line);text-align:center}
.pt thead th{font:700 13px var(--cond);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.pt tbody th{text-align:left;font:900 22px/1 var(--display);text-transform:uppercase}
.pt tbody th small{display:block;font:600 13px var(--body);color:var(--muted);text-transform:none;margin-top:4px}
.pt td a{font:700 20px var(--cond);text-decoration:none}.pt td a:hover{color:var(--red)}
.na{color:var(--muted)}
.cls{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.cls li{display:grid;grid-template-columns:120px 130px 1fr;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
.cls b{font:700 16px var(--cond);letter-spacing:.08em;text-transform:uppercase}
.others h2{margin-bottom:12px}
.ol{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.ol a{text-decoration:none;background:var(--ink-2);display:grid}
.ol img{aspect-ratio:1;object-fit:cover;object-position:50% 20%;width:100%}
.ol span{padding:10px;font:900 20px/1 var(--display);text-transform:uppercase}
@media (max-width:520px){.brand b{display:none}.toplinks{gap:12px}}
@media (max-width:820px){.hero,.two{grid-template-columns:1fr}.hp{max-width:420px;aspect-ratio:1}.gal{grid-template-columns:1fr 1fr}.cls li{grid-template-columns:1fr 1fr}.cls li span:last-child{grid-column:1/-1}}
</style>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/"><img src="/img/logo.webp" alt=""><b>Warrior Spirit</b></a>
  <nav class="toplinks"><a href="/#team">Team</a><a href="/#timetable">Timetable</a><a href="/book">Book PT</a></nav>
</div></header>
<main class="wrap">${body}<p style="margin-top:8px"><span data-fb="powered"></span></p></main>
<script src="/assets/fighterbase.js" defer></script>
</body>
</html>`);
}
