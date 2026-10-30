/* "Add to your home screen" button: Android/Chrome installs directly, iPhone shows the steps. */
(function () {
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () {});
  var btns = document.querySelectorAll('[data-install]');
  if (standalone) {
    btns.forEach(function (b) { b.hidden = true; });
    /* Opened from the home-screen app: first open each (UK) day, go straight to today's classes. */
    try {
      var day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      var wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' }).format(new Date()).slice(0, 3).toLowerCase();
      var mark = function () { document.querySelectorAll('.tt .day').forEach(function (d) { var h = d.querySelector('h3'); d.classList.toggle('today', !!h && h.textContent.trim().slice(0, 3).toLowerCase() === wd); }); };
      mark(); new MutationObserver(mark).observe(document.body, { childList: true, subtree: true });
      var first = false;
      try { first = localStorage.getItem('ws_app_day') !== day; if (first) localStorage.setItem('ws_app_day', day); } catch (e) {}
      if (first && (!location.hash || location.hash === '#' || location.hash === '#home')) {
        var go = function () { var t = document.getElementById('timetable'); if (t) { location.hash = '#timetable'; t.scrollIntoView(); } };
        if (document.readyState === 'complete') setTimeout(go, 300); else addEventListener('load', function () { setTimeout(go, 300); });
      }
    } catch (e) {}
    return;
  }
  btns.forEach(function (b) { b.hidden = false; });
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var deferred = null;
  addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  addEventListener('appinstalled', function () { btns.forEach(function (b) { b.hidden = true; }); });
  function dlg(html) {
    var d = document.createElement('dialog');
    d.style.cssText = 'max-width:min(420px,calc(100vw - 32px));background:#14161d;color:#f3f0ea;border:2px solid #e3141e;padding:22px;font:16px/1.5 Barlow,system-ui,sans-serif';
    d.innerHTML = html + '<p style="margin:16px 0 0"><button type="button" style="font:700 15px/1 Barlow Condensed,sans-serif;letter-spacing:.12em;text-transform:uppercase;background:#e3141e;color:#fff;border:0;padding:12px 20px;cursor:pointer">Got it</button></p>';
    d.querySelector('button').onclick = function () { d.close(); d.remove(); };
    document.body.appendChild(d); d.showModal();
  }
  btns.forEach(function (b) {
    b.addEventListener('keydown', function (e) { if (e.key === 'Enter') b.click(); });
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (deferred) { deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; }); return; }
      if (ios) return dlg('<b style="font-size:20px">Add Warrior Spirit to your iPhone</b><ol style="padding-left:20px;margin:12px 0 0"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (the square with an arrow) at the bottom of the screen.</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li></ol>');
      dlg('<b style="font-size:20px">Add Warrior Spirit to your home screen</b><p style="margin:12px 0 0">Open your browser menu (the three dots, top right) and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>');
    });
  });
})();
