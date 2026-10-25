/* Share buttons for the public site and the coach "Share" page.
   window.WSShare.share({title,text,path,image,ref}) opens the phone's share sheet where there is one,
   otherwise a small menu (WhatsApp, Facebook, X, Email, copy link). Nothing is posted for anyone:
   the person always chooses where it goes. */
(function () {
  var SITE = 'https://www.warriorspiritmuaythai.co.uk';
  var $ = function (s, r) { return (r || document).querySelector(s); };

  function linkFor(path, ref) {
    var p = String(path || '');
    if (p.charAt(0) === '/') return SITE + p + (ref ? (p.indexOf('?') < 0 ? '?' : '&') + 'ref=' + encodeURIComponent(ref) : '');
    var hash = p.charAt(0) === '#' ? p : (p ? '#' + p : '');
    return SITE + '/' + (ref ? '?ref=' + encodeURIComponent(ref) : '') + hash;
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'sh-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, no) {
      var a = document.createElement('textarea'); a.value = text; a.style.position = 'fixed'; a.style.opacity = '0';
      document.body.appendChild(a); a.select();
      try { document.execCommand('copy') ? ok() : no(); } catch (e) { no(e); } a.remove();
    });
  }

  function menu(opts, url) {
    var old = $('.sh-menu'); if (old) old.remove();
    var full = opts.text ? opts.text + ' ' + url : url;
    var enc = encodeURIComponent;
    var items = [
      ['WhatsApp', 'https://wa.me/?text=' + enc(full)],
      ['Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + enc(url) + '&quote=' + enc(opts.text || opts.title || '')],
      ['X', 'https://twitter.com/intent/tweet?text=' + enc(opts.text || opts.title || '') + '&url=' + enc(url)],
      ['Email', 'mailto:?subject=' + enc(opts.title || 'Warrior Spirit Muay Thai') + '&body=' + enc(full)]
    ];
    var m = document.createElement('div'); m.className = 'sh-menu'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Share');
    m.innerHTML = '<div class="sh-box"><b>Share</b>' + items.map(function (i) {
      return '<a href="' + i[1] + '" target="_blank" rel="noopener">' + i[0] + '</a>';
    }).join('') + '<button type="button" data-copy>Copy link</button>' +
      (opts.image ? '<a href="' + opts.image + '" download>Save picture</a>' : '') +
      '<button type="button" data-close class="sh-x">Close</button></div>';
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.closest('[data-close]')) return m.remove();
      if (e.target.closest('[data-copy]')) copy(full).then(function () { toast('Link copied'); m.remove(); }, function () { toast('Couldn’t copy'); });
      else if (e.target.closest('a')) setTimeout(function () { m.remove(); }, 200);
    });
    document.body.appendChild(m);
  }

  async function share(opts) {
    var url = linkFor(opts.path, opts.ref);
    var data = { title: opts.title || 'Warrior Spirit Muay Thai', text: opts.text || '', url: url };
    if (navigator.share) {
      try {
        if (opts.image && navigator.canShare) {
          var r = await fetch(opts.image); var b = await r.blob();
          var f = new File([b], (opts.image.split('/').pop() || 'photo').replace(/\?.*/, ''), { type: b.type || 'image/webp' });
          if (navigator.canShare({ files: [f] })) { data.files = [f]; data.text = (opts.text ? opts.text + ' ' : '') + url; delete data.url; }
        }
        await navigator.share(data); return;
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    menu(opts, url);
  }

  /* ---- buttons on the public pages ---- */
  var ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
  function btn(label, opts) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'shbtn';
    b.innerHTML = ICON + '<span>' + (label || 'Share') + '</span>';
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); share(opts()); });
    return b;
  }
  var txt = function (el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
  function imgOf(el) { var i = el && $('img', el); return i ? new URL(i.getAttribute('src'), location.href).pathname : ''; }

  function addPublic() {
    var seen = 'data-shared';
    function put(host, label, opts, where) {
      if (!host || host.hasAttribute(seen)) return; host.setAttribute(seen, '1');
      var b = btn(label, opts); var wrap = document.createElement('div'); wrap.className = 'shrow'; wrap.appendChild(b);
      (where || host).appendChild(wrap);
    }
    document.querySelectorAll('#news .ncard').forEach(function (c) {
      put(c.querySelector('.nbody') || c, 'Share this result', function () {
        return { title: txt(c.querySelector('h3')), text: txt(c.querySelector('h3')) + ' | ' + txt(c.querySelector('.tagc')) + '. Warrior Spirit Muay Thai, Potters Bar.', path: '#news', image: imgOf(c) };
      });
    });
    put($('#news .nevent'), 'Share this fight night', function () {
      return { title: 'Warriors of Hope 2', text: 'Warriors of Hope 2, ' + txt($('#news .nevent b')) + '. Our fighters step through the ropes. Warrior Spirit Muay Thai, Potters Bar.', path: '#news' };
    });
    document.querySelectorAll('#classes .cards .card').forEach(function (c) {
      var name = txt(c.querySelector('h3')), when = txt(c.querySelector('.when'));
      put(c.querySelector('.body') || c, 'Share this class', function () {
        return { title: name + ' class | Warrior Spirit', text: name + ' at Warrior Spirit Muay Thai, Potters Bar' + (when ? ' (' + when + ')' : '') + '. First class free.', path: '#classes', image: imgOf(c) };
      });
    });
    put($('#timetable .note'), 'Share the timetable', function () {
      return { title: 'Warrior Spirit timetable', text: 'Muay Thai and kickboxing in Potters Bar. Beginners Thursday 7pm, kids Monday to Thursday 5:30pm. First class free.', path: '#timetable' };
    });
    put($('#prices .prices'), 'Share our prices', function () {
      return { title: 'Warrior Spirit prices', text: 'Adults £75 a month, kids £65, personal training from £40 an hour. First class free.', path: '#prices' };
    });
    put($('#fight-team .cta'), 'Share the fight team', function () {
      return { title: 'Warrior Spirit fight team', text: 'Our fighters step through the ropes. Warrior Spirit Muay Thai, Potters Bar.', path: '#fight' };
    }, $('#fight-team .cta'));
    var nb = $('.nextband');
    put(nb, 'Share the free class', function () {
      return { title: 'Free beginners class', text: 'Free first Muay Thai class, beginners Thursday 7pm at Warrior Spirit, Potters Bar.', path: '#contact' };
    });
  }

  window.WSShare = { share: share, link: linkFor, toast: toast, copy: copy, addPublic: addPublic };
  if ($('#news') || $('#classes')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addPublic); else addPublic();
  }
})();
