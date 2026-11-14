/* Cloudflare Turnstile: the free, usually invisible "are you human" check on public forms (order A-038).
   Switched on only when BOTH keys are set in Vercel (TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY), so forms keep working
   until Steve has made the widget. The token is always checked here on the server; the page alone is never trusted. */
export const turnstileSiteKey = () => (process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY ? process.env.TURNSTILE_SITE_KEY : '');

/* A missing, expired, invalid or already-used token always fails. If Cloudflare itself can't be reached, `failOpen`
   decides: the enquiry form lets the person through (losing a real enquiry costs more, and its rate limit still
   applies); sign-up and password reset refuse and ask the person to try again. */
export async function humanCheck(token, ip, { failOpen = false } = {}) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.TURNSTILE_SITE_KEY) return { ok: true, skipped: true };
  if (!token || typeof token !== 'string' || token.length > 2048) return { ok: false };
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, remoteip: ip && ip !== 'x' ? ip : '' }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`siteverify answered ${r.status}`);
    const j = await r.json();
    return { ok: j.success === true, codes: Array.isArray(j['error-codes']) ? j['error-codes'] : [] };
  } catch (e) {
    console.error('turnstile check failed', e?.message);
    return { ok: !!failOpen, unreachable: true };
  }
}

export const NOT_HUMAN = 'We couldn’t confirm you’re a person. Refresh the page and try again, or call us on 07904 032142.';
