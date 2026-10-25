import { COACHES, TYPES, FORMATS, ADDRESS, SITE } from './core.js';
import { vevent } from './ics.js';
const UID = 'warriorspiritmuaythai.co.uk';

export function ptEvent(bk, site = SITE) {
  const start = Number(bk.start), mins = Number(bk.mins);
  const what = [TYPES[bk.type]?.name || bk.type, bk.format ? FORMATS[bk.format]?.name : ''].filter(Boolean).join(', ');
  return vevent({
    uid: `pt-${bk.id}@${UID}`, start, end: start + mins * 6e4, summary: `PT with ${COACHES[bk.coach]?.first || 'coach'} (Warrior Spirit)`,
    description: `${what}. Bring water, a towel and your wraps and gloves if you have them. Manage your booking: ${site}/account`, location: ADDRESS, url: `${site}/account`,
  });
}
/* a class a member has booked a place in */
export function classBookingEvent(cb, site = SITE) {
  const start = Number(cb.start), mins = Number(cb.mins);
  return vevent({
    uid: `cls-${cb.id}@${UID}`, start, end: start + mins * 6e4, summary: `${cb.className} (Warrior Spirit)`,
    description: `Coach: ${COACHES[cb.coach]?.first || ''}. Your place is booked. Manage it: ${site}/account`, location: ADDRESS, url: `${site}/account`,
  });
}
/* a class on the club timetable (no booking needed) */
export function clubClassEvent(k, desc, site = SITE) {
  return vevent({
    uid: `club-${k.classId}-${k.date}@${UID}`, start: k.start, end: k.start + k.mins * 6e4, summary: `${k.name} (Warrior Spirit)`,
    description: [desc, `Coach: ${COACHES[k.coach]?.first || ''}${k.cover ? ' (covering)' : ''}`, k.max ? `Places must be booked: ${site}/account` : 'Come along, no need to book.', 'Your first class is free.'].filter(Boolean).join('\n'),
    location: ADDRESS, url: `${site}/#timetable`,
  });
}
