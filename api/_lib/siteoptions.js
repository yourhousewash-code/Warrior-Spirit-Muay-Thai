/* Optional parts of the public pages. Owners switch them on or off in the coach area (Club details → What the website shows).
   Anything switched off is left out completely: no empty space and no "to confirm" wording.

   In site-src/index.html an optional part is marked data-opt="<key>". Wording shown only while it is OFF is marked data-opt-alt="<key>".
   tools/build-pages.mjs bakes the default (on) into the pages as a data-on attribute, so the pages are right with no JavaScript
   and with an empty database. The page then follows what owners have saved (site:options, sent with /api/site?action=public).

   key    matches data-opt / data-opt-alt in the page
   on     the default when nothing has been saved
   texts  wording an owner must fill in (Edit the website) before it can be switched on. These are the data-ek keys of the
          placeholder text. A placeholder counts as filled once it has been changed and no [square brackets] are left in it.
   link   it needs a web address, saved with the switch
   page   where to fill in the wording (opened in edit mode) */
export const SITE_OPTIONS = [
  { key: 'parking', label: 'Parking', page: '/faq', on: false, texts: ['opt.parking'],
    desc: 'A “Parking” line in the Getting here box on every town page, and “Is there parking?” in the FAQ.' },
  { key: 'gloves', label: 'Borrowing gloves', page: '/faq', on: false, texts: ['opt.gloves'],
    desc: '“Can I borrow kit?” in the FAQ.' },
  { key: 'contract-terms', label: 'Contract and notice', page: '/faq', on: false, texts: ['opt.contract-terms'],
    desc: '“Do you have a contract?” in the FAQ.' },
  { key: 'parents-watching', label: 'Parents watching kids classes', page: '/kids-muay-thai', on: false, texts: ['opt.parents-watching'],
    desc: '“Can parents watch?” on the Kids Muay Thai page, and the same answer on the Safeguarding page.' },
  { key: 'welfare-officer', label: 'Welfare officer', page: '/safeguarding', on: false, texts: ['opt.welfare-officer'],
    desc: 'The club welfare officer’s name and contact details on the Safeguarding page. While it’s off, the page tells people to speak to Jay or call the club.' },
  { key: 'dbs-all', label: 'Every coach DBS checked', page: '/safeguarding', on: false,
    desc: '“All coaches working with children hold an up-to-date DBS check” on the Safeguarding page. Switch it on once that is true for every coach who works with children.' },
  { key: 'insurance', label: 'Governing body and insurance', page: '/safeguarding', on: false, texts: ['opt.insurance'],
    desc: 'Which governing body the club belongs to and its insurance, on the Safeguarding page.' },
  { key: 'fight-results', label: 'Show-day results', page: '/blog', on: false, texts: ['opt.fight-results'],
    desc: 'Fighter names and results in the “Medals and big smiles” news post.' },
  { key: 'steve-result', label: 'Warriors League result', page: '/blog', on: false, texts: ['opt.steve-result'],
    desc: 'The opponent, show and result in the “Hands raised” news post, with its Read more button.' },
  { key: 'youtube', label: 'YouTube channel', page: '/videos', on: false, link: 'youtube',
    desc: 'The YouTube box on the Videos page, the YouTube card on the News page, and a YouTube icon in the header and footer.' },
  { key: 'reviews', label: 'Google reviews rating', page: '/contact', on: true,
    desc: 'The “4.9 from 100 Google reviews” line on the home page and the Contact page.' },
];
export const OPTION_KEYS = new Set(SITE_OPTIONS.map(o => o.key));
export const optionByKey = k => SITE_OPTIONS.find(o => o.key === k);

/* A placeholder is filled once an owner has saved new wording for it with no [square brackets] left. */
const plain = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
export function missingTexts(o, text) {
  return (o.texts || []).filter(k => { const t = plain(text?.[k]?.html); return !t || /\[[^\]]*\]/.test(t); });
}
/* YouTube channel addresses only: youtube.com/@name, /channel/…, /c/… or /user/…. Returns '' for empty, null if not valid. */
export function cleanLink(kind, v) {
  let s = String(v || '').trim().slice(0, 200);
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u; try { u = new URL(s); } catch { return null; }
  if (kind === 'youtube') {
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(u.hostname.toLowerCase())) return null;
    const p = decodeURIComponent(u.pathname).replace(/\/+$/, '');
    if (!/^\/(@[\w.\-]{2,60}|channel\/[\w\-]{10,40}|c\/[\w.\-]{1,80}|user\/[\w.\-]{1,80})$/.test(p)) return null;
    return `https://www.youtube.com${p}`;
  }
  return null;
}
/* What visitors see: on only if switched on (or on by default), its wording is filled in and any web address is set. */
export function effectiveOptions(saved, text) {
  const out = {};
  for (const o of SITE_OPTIONS) {
    const s = saved?.[o.key];
    let on = typeof s?.on === 'boolean' ? s.on : o.on;
    if (on && missingTexts(o, text).length) on = false;
    const link = o.link ? (s?.link || '') : '';
    if (on && o.link && !link) on = false;
    out[o.key] = link && on ? { on, link } : { on };
  }
  return out;
}
