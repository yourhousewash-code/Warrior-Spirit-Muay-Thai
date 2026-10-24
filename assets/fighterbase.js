/* FighterBase badges, shared by every page.
   Put <span data-fb="powered"></span>, <span data-fb="soon"></span> or <span data-fb="created"></span> where a badge should go.
   When FighterBase is live, set FB_URL (and FB_LOGO for the logo image) here and every badge updates. */
(function () {
  var FB_URL = '';   // e.g. 'https://fighterbase.vercel.app'
  var FB_LOGO = '';  // e.g. '/img/fighterbase.svg' (a version that works on dark backgrounds)

  var css = '' +
    '.fbadge{display:inline-flex;align-items:center;gap:7px;font:700 12px/1 "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#a3a8b6;text-decoration:none;border:1px solid #262a35;background:rgba(20,22,29,.85);padding:5px 9px 5px 6px;vertical-align:middle;white-space:nowrap}' +
    '.fbadge b{color:#f3f0ea;font-weight:700;letter-spacing:.1em}' +
    '.fbadge .fbi{width:16px;height:16px;display:grid;place-items:center;background:linear-gradient(135deg,#e3141e,#7a0a10);color:#fff;font:900 10px/1 "Big Shoulders Display",Impact,sans-serif;letter-spacing:0;clip-path:polygon(50% 0,100% 18%,100% 62%,50% 100%,0 62%,0 18%)}' +
    '.fbadge img{height:16px;width:auto;display:block}' +
    'a.fbadge:hover{color:#f3f0ea;border-color:#e3141e}' +
    '.fbadge.soon{border-style:dashed}' +
    '.fbadge.soon .tag{background:#f5c542;color:#0b0c10;padding:2px 5px;letter-spacing:.1em}' +
    '.fbwrap{display:block;margin-bottom:10px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var mark = function () { return FB_LOGO ? '<img src="' + FB_LOGO + '" alt="FighterBase">' : '<span class="fbi" aria-hidden="true">FB</span><b>FighterBase</b>'; };
  function render(el) {
    var kind = el.getAttribute('data-fb') || 'powered';
    var inner = kind === 'soon' ? '<span class="tag">Coming soon</span> with ' + mark()
      : kind === 'created' ? 'Created by ' + mark()
      : 'Powered by ' + mark();
    var tag = FB_URL ? 'a' : 'span';
    var out = document.createElement(tag);
    out.className = 'fbadge' + (kind === 'soon' ? ' soon' : '');
    if (FB_URL) { out.href = FB_URL; out.target = '_blank'; out.rel = 'noopener'; }
    out.title = kind === 'soon' ? 'Coming soon with FighterBase' : 'FighterBase: tools for combat sports gyms and fighters';
    out.innerHTML = inner;
    if (el.hasAttribute('data-fb-block')) { var w = document.createElement('span'); w.className = 'fbwrap'; w.appendChild(out); el.replaceWith(w); }
    else el.replaceWith(out);
  }
  function run() { document.querySelectorAll('[data-fb]').forEach(render); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  window.FighterBase = { refresh: run, url: FB_URL };
})();
