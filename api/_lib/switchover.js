/* FighterBase switch-over (orders WS-009 and WS-010; plan: warrior-spirit-fighterbase-switchover-plan.md in The Manor).
   ONE switch for switch-over day. Off (now): the site works exactly as before, and no FighterBase name, address or club
   code reaches any public page. On: adult class booking, PT booking, new member accounts and the club calendar feed move
   to FighterBase; bookings already made run out on the site; kids class booking stays on the site until the kids review.

   On the day, one commit: set `on: true`, fill `base`, the three links and `clubFeed` with FighterBase's LIVE addresses
   (base https://www.fighterbase.co.uk), then `npm run pages` and commit. Rollback: revert that commit.
   Never fill the links while `on` is false: the club code must stay off public pages until the owner approves joiners. */
export const SWITCHOVER = {
  on: false,
  base: '',      // e.g. 'https://www.fighterbase.co.uk'
  join: '',      // e.g. '/#join=<CLUB CODE>&src=site'  (sign in or join)
  book: '',      // e.g. '/#book=<CLUB CODE>&src=site'  (book a class)
  pt: '',        // e.g. '/#pt=<CLUB CODE>&src=site'    (book PT)
  clubFeed: '',  // FighterBase's club calendar feed (.ics), from the club's Classes page
  name: 'FighterBase',
};

export const switchedOn = () => !!(SWITCHOVER.on && SWITCHOVER.base);
export const fbLink = k => (switchedOn() && SWITCHOVER[k] ? SWITCHOVER.base + SWITCHOVER[k] : '');

/* Kids classes stay bookable on the site after the switch, until FighterBase's kids and safeguarding review is done. */
export const isKidsClass = k => /\bkids?\b|junior/i.test(String(k?.name || k?.className || ''));

/* What the account and coach pages need to know (only when switched on, so nothing leaks before the day). */
export function switchInfo() {
  if (!switchedOn()) return null;
  return { name: SWITCHOVER.name, join: fbLink('join'), book: fbLink('book'), pt: fbLink('pt') };
}

/* The API answer for something that has moved. */
export const MOVED = what => `${what} has moved to the ${SWITCHOVER.name} app.`;
