/* Cloudflare Turnstile ("are you human"), usually invisible: a puzzle shows only if Cloudflare is unsure.
   It does nothing until the keys are set in Vercel (/api/auth?action=config then returns a site key).
   Use: var h = wsHuman(element); later h.token().then(function (t) { ... send t as cfToken ... }); h.reset() after sending. */
(function () {
  var cfg, lib;
  function siteKey() {
    return cfg || (cfg = fetch('/api/auth?action=config', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); }).then(function (j) { return j.turnstile || ''; }).catch(function () { return ''; }));
  }
  function load() {
    return lib || (lib = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    }));
  }
  window.wsHuman = function (el) {
    var ready = !el ? Promise.resolve(null) : siteKey().then(function (k) {
      if (!k) return null;
      return load().then(function () { return window.turnstile.render(el, { sitekey: k, appearance: 'interaction-only', size: 'flexible' }); });
    }).catch(function () { return null; });
    return {
      token: function () {
        return ready.then(function (id) {
          if (id == null) return '';
          return new Promise(function (done) {
            var tries = 0;
            (function wait() {
              var t = window.turnstile.getResponse(id);
              if (t || tries++ > 40) return done(t || '');
              setTimeout(wait, 200);
            })();
          });
        });
      },
      reset: function () { ready.then(function (id) { if (id != null) window.turnstile.reset(id); }); },
    };
  };
})();
