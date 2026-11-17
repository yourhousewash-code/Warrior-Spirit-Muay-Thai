/* FighterBase switch-over (orders WS-009 and WS-010; plan: warrior-spirit-fighterbase-switchover-plan.md in The Manor).
   ONE switch for switch-over day. Off (now): the site works exactly as before, and no FighterBase name, address or club
   code reaches any public page. On: FighterBase runs everything (Steve, 17 Nov 2026 11:5x: "the combat sports gym's
   website ... is just a shop front ... if you book on the website, you're basically booking on fighter base ... I want
   fighter base being in control of everything"). Class booking (adults and kids), PT, member accounts, the timetable,
   calendar feeds and "Get the app" all go to FighterBase; the site keeps its pages, wording, photos, enquiries and the
   coach area's content tools. The few bookings left on the site are test ones and are deleted on the day (Steve: "they
   can be removed or deleted"), after Steve has seen the list.

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
  timetable: '', // FighterBase's timetable data feed (.json, same address as clubFeed with .json): the site's timetable reads it
  app: '',       // e.g. '/?src=site' (where "Get the app" goes)
  kidsOnSite: false, // true only if FighterBase's kids and safeguarding review isn't done on the day: kids classes stay bookable here
  name: 'FighterBase',
};

export const switchedOn = () => !!(SWITCHOVER.on && SWITCHOVER.base);
export const fbLink = k => (switchedOn() && SWITCHOVER[k] ? SWITCHOVER.base + SWITCHOVER[k] : '');

export const isKidsClass = k => !!k?.kids || /\bkids?\b|junior/i.test(String(k?.name || k?.className || ''));
/* Can this class still be booked on the website? Before the switch: yes. After it: only kids classes, and only if
   `kidsOnSite` is set for the day (Steve's default, 17 Nov: everything moves). */
export const bookableHere = k => !switchedOn() || (SWITCHOVER.kidsOnSite && isKidsClass(k));

/* What the account and coach pages need to know (only when switched on, so nothing leaks before the day). */
export function switchInfo() {
  if (!switchedOn()) return null;
  return { name: SWITCHOVER.name, join: fbLink('join'), book: fbLink('book'), pt: fbLink('pt'), app: fbLink('app') || fbLink('join'), kidsOnSite: !!SWITCHOVER.kidsOnSite };
}

/* The API answer for something that has moved. */
export const MOVED = what => `${what} has moved to the ${SWITCHOVER.name} app.`;
