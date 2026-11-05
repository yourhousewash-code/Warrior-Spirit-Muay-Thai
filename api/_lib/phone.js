// UK-first phone check, shared by the enquiry form and the server (the browser copy in
// site-src/index.html is the same function). Returns { ok, mobile, value, why }:
// value is the tidy form to keep (e.g. "07957 100963"); mobile is true for 07, false for a
// UK landline, null for a number outside the UK.
export function checkPhone(raw) {
  const s = String(raw || '').trim();
  if (!s) return { ok: false, why: 'Add your phone number so we can get back to you.' };
  if (/[a-z]/i.test(s)) return { ok: false, why: 'That phone number has letters in it. Numbers only, please.' };
  let d = s.replace(/\(0\)/g, '').replace(/[^\d+]/g, '');
  if (d.startsWith('+44')) d = '0' + d.slice(3);
  else if (d.startsWith('0044')) d = '0' + d.slice(4);
  else if (/^44\d{10}$/.test(d)) d = '0' + d.slice(2);
  d = d.replace(/^00(?=[1-9]\d{9,10}$)/, '0');
  if (d.startsWith('+') || d.startsWith('00')) {
    const n = d.replace(/^\+|^00/, '');
    return n.length >= 8 && n.length <= 15 ? { ok: true, mobile: null, value: '+' + n } : { ok: false, why: 'That phone number doesn’t look right. Check the number of digits.' };
  }
  if (/^7\d{9}$/.test(d)) return { ok: false, why: 'Add the 0 at the start: UK mobile numbers start 07.' };
  if (/^07\d{9}$/.test(d)) return { ok: true, mobile: true, value: `${d.slice(0, 5)} ${d.slice(5)}` };
  if (/^02\d{9}$/.test(d)) return { ok: true, mobile: false, value: `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}` };
  if (/^03\d{9}$/.test(d)) return { ok: true, mobile: false, value: `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` };
  if (/^01\d{9}$/.test(d)) return { ok: true, mobile: false, value: `${d.slice(0, 5)} ${d.slice(5)}` };
  if (/^01\d{8}$/.test(d)) return { ok: true, mobile: false, value: `${d.slice(0, 5)} ${d.slice(5)}` };
  if (/^07\d*$/.test(d)) return { ok: false, why: `UK mobile numbers have 11 digits, starting 07. That one has ${d.length}.` };
  if (/^0\d*$/.test(d)) return { ok: false, why: 'That phone number doesn’t look right. UK numbers start 07, 01, 02 or 03 and have 10 or 11 digits.' };
  return { ok: false, why: 'That phone number doesn’t look right. Start it with 0, or +44 for a UK number.' };
}
