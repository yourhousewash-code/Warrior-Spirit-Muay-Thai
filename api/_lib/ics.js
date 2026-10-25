/* iCalendar (.ics) helpers. Times are written in UTC so daylight saving never breaks them. */
const pad = n => String(n).padStart(2, '0');
export const utc = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; };
const esc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line) {
  const out = []; let l = line;
  while (Buffer.byteLength(l) > 74) { let cut = 73; while (Buffer.byteLength(l.slice(0, cut)) > 73) cut--; out.push(l.slice(0, cut)); l = ' ' + l.slice(cut); }
  out.push(l); return out.join('\r\n');
}
/* e: { uid, start, end, summary, description, location, url, alarmMins } (start/end are epoch ms) */
export function vevent(e) {
  const L = ['BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${utc(e.stamp || Date.now())}`, `DTSTART:${utc(e.start)}`, `DTEND:${utc(e.end)}`, `SUMMARY:${esc(e.summary)}`];
  if (e.description) L.push(`DESCRIPTION:${esc(e.description)}`);
  if (e.location) L.push(`LOCATION:${esc(e.location)}`);
  if (e.url) L.push(`URL:${e.url}`);
  if (e.alarmMins) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.summary)}`, `TRIGGER:-PT${e.alarmMins}M`, 'END:VALARM');
  L.push('END:VEVENT');
  return L.map(fold).join('\r\n');
}
export function vcal(name, events, { method = 'PUBLISH', refreshHours = 6 } = {}) {
  const head = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Warrior Spirit Muay Thai//Website//EN', 'CALSCALE:GREGORIAN', `METHOD:${method}`,
    `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:Europe/London', `REFRESH-INTERVAL;VALUE=DURATION:PT${refreshHours}H`, `X-PUBLISHED-TTL:PT${refreshHours}H`];
  return head.map(fold).join('\r\n') + '\r\n' + events.join('\r\n') + (events.length ? '\r\n' : '') + 'END:VCALENDAR\r\n';
}
