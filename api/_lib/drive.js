import { redis } from './core.js';
/* Google Drive helpers shared by the Drive connection and the photo library. */
export const CLIENT_ID = () => process.env.GOOGLE_CLIENT_ID || '';
export const CLIENT_SECRET = () => process.env.GOOGLE_CLIENT_SECRET || '';
export const FOLDER_NAME = 'Warrior Spirit Uploads';
export const KEY_REFRESH = 'gdrive:refresh';
export const KEY_FOLDER = 'gdrive:folder';
export const configured = () => !!(CLIENT_ID() && CLIENT_SECRET());
export const origin = req => `https://${(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()}`;
export const redirectUri = req => `${origin(req)}/api/gdrive`;

export async function accessToken() {
  const refresh = await redis.get(KEY_REFRESH);
  if (!refresh) throw new Error('Google Drive isn’t connected yet.');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID(), client_secret: CLIENT_SECRET(), refresh_token: String(refresh), grant_type: 'refresh_token' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google Drive needs reconnecting.');
  return j.access_token;
}

export async function folderId(token) {
  const saved = await redis.get(KEY_FOLDER);
  if (saved) {
    const chk = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(String(saved))}?fields=id,trashed`, { headers: { authorization: `Bearer ${token}` } });
    const cj = await chk.json().catch(() => ({}));
    if (chk.ok && cj.id && !cj.trashed) return String(saved);
  }
  const r = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error('Couldn’t create the Drive folder.');
  await redis.set(KEY_FOLDER, j.id);
  return j.id;
}


export async function driveTrash(token, id) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  return r.ok;
}
