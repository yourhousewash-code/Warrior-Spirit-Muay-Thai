/* Gold, red and white confetti that bursts over any .winpic photo when it scrolls into view.
   Tap or click the photo to fire it again. Off for visitors who prefer reduced motion. */
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var COLORS = ['#f5c542', '#fff3b0', '#e3141e', '#ffffff', '#c99a1d'];
  function burst(host) {
    if (host.__confetti) return; host.__confetti = true;
    var c = document.createElement('canvas'), r = host.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = r.width * dpr; c.height = r.height * dpr;
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:5;pointer-events:none';
    host.appendChild(c);
    var x = c.getContext('2d'); x.scale(dpr, dpr);
    var W = r.width, H = r.height, P = [], i, n = Math.round(Math.min(140, Math.max(60, W / 4)));
    for (i = 0; i < n; i++) {
      var left = i % 2 === 0, dir = left ? 1 : -1;
      P.push({ x: left ? 0 : W, y: H, vx: dir * (2 + Math.random() * 8), vy: -(9 + Math.random() * 10) * Math.min(1.3, H / 300),
        w: 5 + Math.random() * 6, h: 3 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - .5) * .4,
        col: COLORS[(Math.random() * COLORS.length) | 0], life: 0 });
    }
    var start = performance.now();
    (function frame(t) {
      var el = t - start; x.clearRect(0, 0, W, H);
      P.forEach(function (p) {
        p.vy += 0.28; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        x.save(); x.globalAlpha = Math.max(0, 1 - el / 3200); x.translate(p.x, p.y); x.rotate(p.rot);
        x.fillStyle = p.col; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore();
      });
      if (el < 3200) requestAnimationFrame(frame); else { c.remove(); host.__confetti = false; }
    })(start);
  }
  function init() {
    var hosts = [].slice.call(document.querySelectorAll('.winpic'));
    if (!hosts.length) return;
    hosts.forEach(function (h) { h.addEventListener('click', function () { burst(h); }); });
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting && e.intersectionRatio > .5) { burst(e.target); io.unobserve(e.target); } });
    }, { threshold: [.5] });
    hosts.forEach(function (h) { io.observe(h); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
