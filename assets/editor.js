/* Edit mode for coaches: tap a piece of text or a photo on the real site and change it.
   Only wording and picture swaps from the photo library. Layout, sections and links are never touched. */
(function () {
  if (!window.WSEdit) return;
  var E = window.WSEdit, $ = function (s, r) { return (r || document).querySelector(s); };
  var css = document.createElement('style');
  css.textContent = '.wse-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:99999;background:#14161d;color:#f4efe6;border:1px solid #333;border-top:3px solid #e11d2e;padding:10px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 16px);font:600 14px/1.2 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.6)}' +
    '.wse-bar button,.wse-dlg button,.wse-dlg label.b{font:700 13px system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;border:1px solid #444;background:transparent;color:#f4efe6;padding:10px 12px;cursor:pointer;min-height:40px}' +
    '.wse-bar button.p,.wse-dlg button.p{background:#e11d2e;border-color:#e11d2e;color:#fff}.wse-bar button:disabled{opacity:.4;cursor:default}' +
    '[data-wse]{cursor:pointer;outline:1px dashed rgba(225,29,46,.55);outline-offset:3px}[data-wse]:hover{outline:2px solid #e11d2e;background-color:rgba(225,29,46,.08)}[data-wse].wse-done{outline:2px solid #f2b705}' +
    '.wse-dlg{background:#14161d;color:#f4efe6;border:0;border-top:4px solid #e11d2e;padding:20px;width:min(640px,calc(100vw - 20px));max-height:calc(100vh - 20px);overflow:auto;font:15px/1.4 system-ui,sans-serif}.wse-dlg::backdrop{background:rgba(0,0,0,.7)}' +
    '.wse-dlg h2{margin:0 0 10px;font:800 20px system-ui,sans-serif;text-transform:uppercase}.wse-dlg textarea,.wse-dlg input[type=text]{width:100%;box-sizing:border-box;background:#0b0c10;color:#f4efe6;border:1px solid #444;padding:10px;font:16px/1.4 system-ui,sans-serif}' +
    '.wse-dlg .m{color:#a9a9b3;font-size:13px;margin:6px 0 12px}.wse-dlg .r{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.wse-dlg .e{color:#ff6b6b;margin:8px 0}' +
    '.wse-lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin:10px 0}.wse-lib button{padding:0;border:2px solid transparent;background:#000;min-height:0;aspect-ratio:4/3;position:relative}.wse-lib img{width:100%;height:100%;object-fit:cover;display:block}.wse-lib button[aria-pressed=true]{border-color:#e11d2e}.wse-cur{max-height:160px;max-width:100%;display:block;margin:0 0 10px;object-fit:contain;background:#000}' +
    '.wse-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#1c8f4a;color:#fff;padding:10px 16px;z-index:100000;font:700 14px system-ui,sans-serif}';
  document.head.appendChild(css);

  var me = null, dText = {}, dImg = {}, items = [], byEl = new Map(), dirtyCount = 0, bar;
  function toast(m) { var t = document.createElement('div'); t.className = 'wse-toast'; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3500); }
  function api(url, data) {
    return fetch(url, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong.'); return j; }); });
  }
  function count() { return Object.keys(dText).length + Object.keys(dImg).length; }
  function refresh() {
    var n = count(); bar.querySelector('.n').textContent = n ? n + ' unsaved change' + (n > 1 ? 's' : '') : 'Tap any outlined text or photo to change it';
    bar.querySelector('[data-save]').disabled = !n; bar.querySelector('[data-undo]').disabled = !n;
  }
  function mark(it) { var changed = (it.key in dText) || (it.key in dImg) || it.el.__edited; it.el.classList.toggle('wse-done', !!changed); }

  function dlg(html) { var d = document.createElement('dialog'); d.className = 'wse-dlg'; d.innerHTML = html; document.body.appendChild(d); d.addEventListener('close', function () { d.remove(); }); d.addEventListener('click', function (e) { if (e.target === d) d.close(); }); d.showModal(); return d; }
  function editText(it) {
    var cur = E.toEdit(it.el.innerHTML), d = dlg('<h2>Change the wording</h2><textarea rows="' + Math.min(12, Math.max(3, Math.ceil(cur.length / 55) + 1)) + '" maxlength="2000"></textarea><p class="m">New line: press Enter. Bold: put **two stars** either side of the words. This only changes the words. The design and layout stay as they are.</p><p class="e" hidden></p><div class="r"><button class="p" data-ok>Use this</button><button data-rev>Put back the original</button><button data-no>Cancel</button></div>');
    var ta = $('textarea', d); ta.value = cur; ta.focus();
    $('[data-no]', d).onclick = function () { d.close(); };
    $('[data-rev]', d).onclick = function () { it.el.innerHTML = it.orig; it.el.__edited = false; if (dText[it.key] === undefined && !it.live) { } dText[it.key] = null; mark(it); refresh(); d.close(); };
    $('[data-ok]', d).onclick = function () {
      var v = ta.value.trim(); if (!v) { var er = $('.e', d); er.textContent = 'This can’t be empty. Use “Put back the original” to undo a change.'; er.hidden = false; return; }
      var html = E.fromEdit(v); if (html === it.el.innerHTML) { d.close(); return; }
      it.el.innerHTML = html; it.el.__edited = true; dText[it.key] = { html: html, orig: it.orig }; mark(it); refresh(); d.close();
    };
  }
  var lib = null;
  function editImage(it) {
    var chosen = null;
    var d = dlg('<h2>Change the photo</h2><img class="wse-cur" alt=""><label class="m" style="display:block">Describe the picture (for people who can’t see it)<input type="text" maxlength="200" data-alt></label><p class="m">Pick a different photo. The picture is swapped in the same place and size.</p><div class="wse-lib" data-lib>Loading photos…</div><p class="e" hidden></p><div class="r"><button class="p" data-ok disabled>Use this photo</button><button data-rev>Put back the original</button><button data-no>Cancel</button></div>');
    $('.wse-cur', d).src = it.el.currentSrc || it.el.src; $('[data-alt]', d).value = it.el.alt || '';
    $('[data-no]', d).onclick = function () { d.close(); };
    $('[data-rev]', d).onclick = function () { it.el.src = it.orig; it.el.alt = it.origAlt; it.el.__edited = false; dImg[it.key] = null; mark(it); refresh(); d.close(); };
    $('[data-ok]', d).onclick = function () {
      var alt = $('[data-alt]', d).value.trim().slice(0, 200), src = chosen || (it.el.__edited ? it.el.getAttribute('src') : null);
      if (!src) { src = it.el.getAttribute('src'); }
      it.el.src = src; it.el.removeAttribute('srcset'); it.el.alt = alt; it.el.__edited = true;
      dImg[it.key] = { src: src, alt: alt, orig: it.orig }; mark(it); refresh(); d.close();
    };
    function draw(list) {
      var box = $('[data-lib]', d); box.innerHTML = '';
      list.forEach(function (p) {
        var b = document.createElement('button'); b.type = 'button'; b.title = p.name; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', p.name);
        var im = document.createElement('img'); im.loading = 'lazy'; im.alt = ''; im.src = p.src.charAt(0) === '/' ? p.src : '/' + p.src; b.appendChild(im);
        b.onclick = function () { chosen = p.src; [].forEach.call(box.children, function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); $('.wse-cur', d).src = im.src; $('[data-ok]', d).disabled = false; };
        box.appendChild(b);
      });
    }
    (lib ? Promise.resolve(lib) : api('/api/site?action=library').then(function (r) { lib = r; return r; })).then(function (r) {
      draw(r.photos);
      if (r.canAdd) {
        var l = document.createElement('label'); l.className = 'b'; l.style.cssText = 'display:inline-block;margin-top:4px'; l.innerHTML = 'Add a new photo to the library<input type="file" accept="image/*" hidden>';
        l.querySelector('input').onchange = function (e) { addToLibrary(e.target.files[0], d, r, draw); };
        $('[data-lib]', d).after(l);
      }
    }).catch(function (e) { $('[data-lib]', d).textContent = e.message; });
  }
  function addToLibrary(f, d, r, draw) {
    if (!f) return; var er = $('.e', d); er.hidden = false; er.style.color = '#a9a9b3'; er.textContent = 'Uploading…';
    createImageBitmap(f, { imageOrientation: 'from-image' }).then(function (b) {
      var k = Math.min(1, 2200 / Math.max(b.width, b.height)), c = document.createElement('canvas'); c.width = Math.round(b.width * k); c.height = Math.round(b.height * k); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
      return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', .86); });
    }).then(function (blob) {
      return import('/assets/blob-client.js').then(function (m) { return m.upload('site/' + me + '/' + Date.now() + '-' + f.name.replace(/[^\w.\-]+/g, '_').replace(/\.\w+$/, '').slice(-40) + '.jpg', blob, { access: 'private', handleUploadUrl: '/api/uploads?action=token', contentType: 'image/jpeg' }); });
    }).then(function (u) {
      var src = '/api/site?action=file&path=' + u.pathname;
      return api('/api/site?action=library-add', { src: src, name: f.name.replace(/\.\w+$/, '').slice(0, 60) }).then(function () { r.photos.push({ src: src, name: f.name }); draw(r.photos); er.hidden = true; });
    }).catch(function (e) { er.style.color = '#ff6b6b'; er.textContent = 'Couldn’t add that photo. ' + (e && e.message || ''); });
  }

  function start() {
    var c = E.collect(); items = c.texts.map(function (x) { x.kind = 't'; return x; }).concat(c.imgs.map(function (x) { x.kind = 'i'; return x; }));
    items.forEach(function (it) { it.el.setAttribute('data-wse', it.kind); byEl.set(it.el, it); mark(it); });
    document.addEventListener('click', function (e) {
      if (e.target.closest('.wse-bar,.wse-dlg')) return;
      var t = e.target.closest('[data-wse]'); if (!t) return;
      var it = byEl.get(t); if (!it) return; e.preventDefault(); e.stopPropagation();
      it.kind === 't' ? editText(it) : editImage(it);
    }, true);
    bar = document.createElement('div'); bar.className = 'wse-bar';
    bar.innerHTML = '<span>✏️ Editing</span><span class="n"></span><button class="p" data-save disabled>' + (window.__wsAdmin ? 'Save &amp; publish' : 'Send for approval') + '</button><button data-undo disabled>Undo</button><button data-exit>Exit</button>';
    document.body.appendChild(bar);
    bar.querySelector('[data-save]').onclick = function () {
      var b = this; b.disabled = true;
      api('/api/site?action=edits-save', { text: dText, images: dImg }).then(function (r) {
        dText = {}; dImg = {}; refresh(); items.forEach(mark);
        toast(r.status === 'live' ? 'Saved. It’s live on the website.' : 'Sent. Jay or Steve will approve it before it goes live.');
      }).catch(function (e) { toast(e.message); b.disabled = false; });
    };
    bar.querySelector('[data-undo]').onclick = function () { if (!confirm('Undo all your unsaved changes?')) return; location.reload(); };
    bar.querySelector('[data-exit]').onclick = function () {
      if (count() && !confirm('You have unsaved changes. Leave without saving?')) return;
      try { sessionStorage.removeItem('ws_edit'); } catch (e) { }
      location.href = '/coach';
    };
    window.addEventListener('beforeunload', function (e) { if (count()) { e.preventDefault(); e.returnValue = ''; } });
    refresh();
  }
  api('/api/auth?action=coach-me').then(function (r) {
    me = r.coach.id; window.__wsAdmin = !!r.coach.admin;
    if (!r.coach.admin) throw new Error('owners only');
    return api('/api/site?action=edits-get');
  }).then(function (r) {
    E.apply(Object.assign({}, r.text, r.pending ? r.pending.text : {}), Object.assign({}, r.images, r.pending ? r.pending.images : {}));
    start();
  }).catch(function () {
    try { sessionStorage.removeItem('ws_edit'); } catch (e) { }
    var b = document.createElement('div'); b.className = 'wse-bar'; b.innerHTML = '<span>Only Jay and Steve can edit the website. Please log in as an owner.</span><button class="p" onclick="location.href=\'/coach\'">Coach login</button>'; css.parentNode && document.body.appendChild(b);
  });
})();
