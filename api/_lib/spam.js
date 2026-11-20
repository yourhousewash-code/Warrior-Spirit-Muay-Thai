/* Spam and bot layers for the public forms (order A-100; the bot check itself is turnstile.js).
   Bots that trip a layer are counted and get a normal "sent" answer; sales pitches written by people are saved but
   flagged as spam, never deleted, never emailed and never counted as enquiries. Jay can mark one "Not spam" in one tap. */
import { redis } from './core.js';

/* A real person takes longer than this from first touching the form to sending it. */
export const MIN_FILL_MS = 3000;

/* Words that sales pitches use and gym enquiries don't. Strong ones flag on their own; weak ones (and links) need two. */
const STRONG = /\b(seo|search engine optimi[sz]ation|backlinks?|guest posts?|first page of google|rank(ing)? (higher|better|on google)|lead generation|web ?(site)? ?(design|development|redesign)|app development|digital marketing (agency|services)|marketing agency|crypto|bitcoin|forex|virtual assistants?|outsourc\w*|dear (business|website) owner)\b/i;
const WEAK = /\b(dear (sir|madam)|marketing|traffic|leads|business owner|google (maps|business)|reviews? (service|boost)|increase (your )?(sales|visibility)|unsubscribe|quote for your website|our (services|agency|team of experts))\b/gi;

export function pitchReason(text) {
  const t = String(text || '');
  if (STRONG.test(t)) return 'sales pitch';
  const links = (t.match(/https?:\/\/|www\./gi) || []).length;
  const weak = (t.match(WEAK) || []).length;
  return links + weak >= 2 ? 'sales pitch' : '';
}

const monthKey = () => `spamcount:${new Date().toISOString().slice(0, 7)}`;
/* kind: trap (hidden field filled), fast (sent too quickly), pitch (flagged), person or network (too many), human (bot check failed) */
export async function countBlocked(kind) {
  try { await redis.hincrby(monthKey(), kind, 1); await redis.expire(monthKey(), 400 * 86400); } catch {}
}
export async function blockedThisMonth() {
  const h = (await redis.hgetall(monthKey())) || {};
  return Object.fromEntries(Object.entries(h).map(([k, v]) => [k, Number(v) || 0]));
}
