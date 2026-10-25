import crypto from 'node:crypto';
import { redis, coachSession, loadCoaches, send, bad, body, clean, setupProblem } from './_lib/core.js';

/* Coach uploads go to a "Warrior Spirit Uploads" folder in the owner's Google Drive.
   One admin approves the connection once; the site then keeps a refresh token in the database
   and mints short-lived access tokens when a coach uploads. The browser sends the file straight to Google. */

const CLIENT_ID = () => process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = () => process.env.GOOGLE_CLIENT_SECRET || '';
const FOLDER_NAME = 'Warrior Spirit Uploads';
const KEY_REFRESH = 'gdrive:refresh';
const KEY_FOLDER = 'gdrive:folder';
const configured = () => !!(CLIENT_ID() && CLIENT_SECRET());
const origin = req => `https://${(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()}`;
const redirectUri = req => `${origin(req)}/api/gdrive`;

async function accessToken() {
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

async function folderId(token) {
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

export default async function handler(req, res) {
  const problem = setupProblem();
  if (problem) return bad(res, problem, 503);
  await loadCoaches();
  const c = coachSession(req);
  const action = clean(req.query.action, 20);
  try {
    /* Google sends the admin back here with ?code=... after they approve. */
    if (req.query.code || req.query.error) {
      if (!c || !c.admin) { res.statusCode = 302; res.setHeader('Location', '/coach'); return res.end(); }
      const state = clean(req.query.state, 80);
      const okState = state && (await redis.get(`gdrive:state:${state}`)) === 'ok';
      if (okState) await redis.del(`gdrive:state:${state}`);
      let why = '';
      let dest = '/coach?drive=failed#uploads';
      if (req.query.error) why = 'google_' + clean(req.query.error, 40);
      else if (!okState) why = 'expired_or_bad_state';
      else if (!configured()) why = 'not_configured';
      else if (req.query.code) {
        const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code: String(req.query.code), client_id: CLIENT_ID(), client_secret: CLIENT_SECRET(), redirect_uri: redirectUri(req), grant_type: 'authorization_code' }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.refresh_token) { await redis.set(KEY_REFRESH, j.refresh_token); await redis.del(KEY_FOLDER); dest = '/coach?drive=connected#uploads'; }
        else why = clean(j.error || (r.ok ? 'no_refresh_token' : 'token_' + r.status), 40) + (j.error_description ? ':' + clean(j.error_description, 60) : '');
      }
      if (why) { console.error('[gdrive connect]', why); dest = dest.replace('#uploads', '') + '&why=' + encodeURIComponent(why) + '#uploads'; }
      res.statusCode = 302; res.setHeader('Location', dest); return res.end();
    }

    if (!c) return bad(res, 'Please log in.', 401);

    if (action === 'status') {
      const connected = configured() && !!(await redis.get(KEY_REFRESH));
      const fid = connected ? await redis.get(KEY_FOLDER) : null;
      return send(res, 200, { configured: configured(), connected, admin: !!c.admin, folderUrl: fid ? `https://drive.google.com/drive/folders/${fid}` : '', ...(c.admin && req.query.debug ? { secretLength: CLIENT_SECRET().length, secretStart: CLIENT_SECRET().slice(0, 7), secretHasSpace: /\s/.test(CLIENT_SECRET()), idEnd: CLIENT_ID().slice(-30) } : {}) });
    }

    if (action === 'connect') {
      if (!c.admin) return bad(res, 'Only an owner can connect Google Drive.', 403);
      if (!configured()) return bad(res, 'Google isn’t set up on the site yet.', 503);
      const state = crypto.randomBytes(16).toString('hex');
      await redis.set(`gdrive:state:${state}`, 'ok', { ex: 600 });
      const q = new URLSearchParams({
        client_id: CLIENT_ID(), redirect_uri: redirectUri(req), response_type: 'code',
        scope: 'https://www.googleapis.com/auth/drive.file', access_type: 'offline', prompt: 'consent', state,
      });
      res.statusCode = 302; res.setHeader('Location', `https://accounts.google.com/o/oauth2/v2/auth?${q}`); return res.end();
    }

    /* Start a direct-to-Drive upload: returns a one-off Google URL the browser sends the file to. */
    if (action === 'session' && req.method === 'POST') {
      if (!configured()) return bad(res, 'Google Drive isn’t set up.', 503);
      const b = body(req);
      const type = clean(b.type, 80) || 'application/octet-stream';
      const size = Number(b.size) || 0;
      if (!/^(image|video)\//.test(type)) return bad(res, 'Photos and videos only.');
      if (size <= 0 || size > 5 * 1024 * 1024 * 1024) return bad(res, 'That file is too big (5 GB max).');
      const token = await accessToken();
      const fid = await folderId(token);
      const stamp = new Date().toISOString().slice(0, 10);
      const safe = clean(b.name, 120).replace(/[^\w.\- ]+/g, '_') || 'upload';
      const name = `${stamp} ${c.first} - ${safe}`;
      const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=UTF-8',
          'x-upload-content-type': type, 'x-upload-content-length': String(size), origin: origin(req),
        },
        body: JSON.stringify({ name, parents: [fid] }),
      });
      const loc = r.headers.get('location');
      if (!r.ok || !loc) return bad(res, 'Google wouldn’t start the upload. Please try again.', 502);
      return send(res, 200, { url: loc });
    }
    return bad(res, 'Unknown action', 404);
  } catch (e) {
    console.error('[gdrive]', e.message);
    return bad(res, e.message.startsWith('Google') || e.message.startsWith('Couldn’t') ? e.message : 'Upload service error. Please try again.', 500);
  }
}
