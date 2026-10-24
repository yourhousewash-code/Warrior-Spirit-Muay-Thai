/* "Continue with Google" button, shown only when GOOGLE_CLIENT_ID is set on the server.
   Usage: WSSignIn.google(containerEl, function (user) { ... }) */
(function () {
  var cfg = null;
  function config() {
    return cfg || (cfg = fetch('/api/auth?action=config', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).catch(function () { return {}; }));
  }
  function loadGis() {
    return new Promise(function (ok, no) {
      if (window.google && google.accounts && google.accounts.id) return ok();
      var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
      s.onload = ok; s.onerror = no; document.head.appendChild(s);
    });
  }
  window.WSSignIn = {
    google: function (box, done, onError) {
      if (!box) return;
      config().then(function (c) {
        if (!c.google) return;
        return loadGis().then(function () {
          google.accounts.id.initialize({
            client_id: c.google, ux_mode: 'popup',
            callback: function (resp) {
              fetch('/api/auth?action=google', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: resp.credential }) })
                .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Google sign-in didn’t work.'); return j; }); })
                .then(function (j) { done(j.user); })
                .catch(function (e) { if (onError) onError(e.message); });
            },
          });
          box.innerHTML = '<div class="gwrap"></div><p class="gor"><span>or use your email</span></p>';
          google.accounts.id.renderButton(box.querySelector('.gwrap'), { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular', width: Math.min(340, box.clientWidth || 340), logo_alignment: 'left' });
          box.hidden = false;
        });
      }).catch(function () {});
    },
  };
})();
