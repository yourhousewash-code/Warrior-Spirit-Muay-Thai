/* Finds the pieces of the page that coaches may change (plain text blocks and photos) and applies saved changes.
   Nothing here changes layout. Text may only use line breaks, bold and italic. */
(function () {
  var TEXT = 'h1,h2,h3,h4,p,li,figcaption,blockquote,summary,dt,dd,.kick,td,th';
  var SKIP = 'nav,form,button,a,script,style,svg,select,textarea,header,.ticker,#tkTrack,#timetable,[data-hours],[data-noedit],.shbtn,.sh-menu,dialog,.hero-news,.dots';
  var INLINE = { BR: 1, STRONG: 1, B: 1, EM: 1, I: 1 };
  var IMGSKIP = 'nav,form,button,a,header,#slides,.vgrid,.dots,[data-noedit],.hero-badge,.hero-news,.townhero,.teamhero,.campgal .x';
  function fnv(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function scope(el) { var a = el.closest('[id]'); return a ? a.id.replace(/[^\w\-]/g, '').slice(0, 30) : 'page'; }
  function plainOk(el) {
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
      if (!INLINE[c.tagName] || c.attributes.length) return false;
      for (var d = c.firstElementChild; d; d = d.nextElementSibling) if (!INLINE[d.tagName]) return false;
    }
    return true;
  }
  /* html <-> the simple text people edit: **bold**, _italic_ not supported (keeps it simple), line breaks */
  function toEdit(html) {
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(strong|b)>/gi, '**').replace(/<\/?(em|i)>/gi, '_*').replace(/&nbsp;/g, ' ')
      .replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fromEdit(t) {
    t = esc(String(t).replace(/\r/g, '').slice(0, 2000));
    var n = 0; t = t.replace(/\*\*/g, function () { return (n++ % 2) ? '</strong>' : '<strong>'; }); if (n % 2) t += '</strong>';
    var m = 0; t = t.replace(/_\*/g, function () { return (m++ % 2) ? '</em>' : '<em>'; }); if (m % 2) t += '</em>';
    return t.replace(/\n/g, '<br>');
  }
  /* what visitors may be shown: only these tags survive, whatever was stored */
  function safe(html) {
    return String(html).replace(/<(\/?)(\w+)[^>]*>/g, function (m, s, t) { t = t.toLowerCase(); return /^(br|strong|em|b|i)$/.test(t) ? '<' + s + t + (t === 'br' ? '>' : '>') : ''; });
  }
  var cache = null;
  function collect() {
    if (cache) return cache;
    var seen = {}, texts = [], imgs = [];
    function key(base, el) { var k = base; seen[k] = (seen[k] || 0) + 1; return seen[k] > 1 ? k + '-' + seen[k] : k; }
    var main = document.getElementById('top') || document.body;
    [].forEach.call(main.querySelectorAll(TEXT), function (el) {
      if (el.closest(SKIP) || el.id === 'ticker') return;
      if (!plainOk(el)) return;
      if (el.querySelector('img,video,svg')) return;
      var h = el.innerHTML.trim(), t = el.textContent.replace(/\s+/g, ' ').trim();
      if (t.length < 2 || /^(\W|\d)*$/.test(t)) return;
      texts.push({ el: el, key: key(scope(el) + '.t' + fnv(t), el), orig: h });
    });
    [].forEach.call(main.querySelectorAll('img'), function (el) {
      if (el.closest(IMGSKIP)) return;
      var s = el.getAttribute('src') || ''; if (!/^photos\/.+\.(webp|jpe?g|png)$/i.test(s)) return;
      imgs.push({ el: el, key: key(scope(el) + '.i' + fnv(s), el), orig: s, origAlt: el.getAttribute('alt') || '' });
    });
    cache = { texts: texts, imgs: imgs };
    return cache;
  }
  function apply(text, images) {
    var c = collect();
    c.texts.forEach(function (x) { var v = text && text[x.key]; if (v && typeof v.html === 'string') x.el.innerHTML = safe(v.html); else if (x.el.__edited) x.el.innerHTML = x.orig; x.el.__edited = !!(v && v.html); });
    c.imgs.forEach(function (x) {
      var v = images && images[x.key];
      if (v && /^(photos\/[\w.\-]+|\/api\/site\?action=file&path=site\/[a-z]+\/[\w.\-]+)$/.test(v.src || '')) { x.el.src = v.src; x.el.removeAttribute('srcset'); if (typeof v.alt === 'string') x.el.alt = v.alt.slice(0, 200); x.el.__edited = true; }
      else if (x.el.__edited) { x.el.src = x.orig; x.el.alt = x.origAlt; x.el.__edited = false; }
    });
  }
  document.addEventListener('DOMContentLoaded', function () { collect(); });
  window.WSEdit = { collect: collect, apply: apply, toEdit: toEdit, fromEdit: fromEdit, safe: safe };
})();
