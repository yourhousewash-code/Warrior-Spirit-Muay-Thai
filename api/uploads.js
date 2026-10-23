import { Readable } from 'node:stream';
import { handleUpload } from '@vercel/blob/client';
import { list, get, del } from '@vercel/blob';
import { coachSession, send, bad, clean, COACHES, setupProblem } from './_lib/core.js';

export default async function handler(req, res) {
  const problem = setupProblem();
  if (problem) return bad(res, problem, 503);
  const c = coachSession(req);
  if (!c) return bad(res, 'Please log in.', 401);
  const action = clean(req.query.action, 20);
  try {
    if (action === 'token' && req.method === 'POST') {
      const json = await handleUpload({
        body: req.body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          if (!pathname.startsWith(`uploads/${c.id}/`)) throw new Error('Not allowed');
          return {
            allowedContentTypes: ['image/*', 'video/*'],
            maximumSizeInBytes: 500 * 1024 * 1024,
            addRandomSuffix: true,
          };
        },
      });
      return send(res, 200, json);
    }
    if (action === 'list') {
      const prefix = c.admin ? 'uploads/' : `uploads/${c.id}/`;
      const out = [];
      let cursor;
      do {
        const r = await list({ prefix, cursor, limit: 1000 });
        out.push(...r.blobs);
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor && out.length < 3000);
      out.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      return send(res, 200, {
        files: out.map(f => ({
          path: f.pathname, size: f.size, uploadedAt: f.uploadedAt,
          by: COACHES[f.pathname.split('/')[1]]?.first || f.pathname.split('/')[1],
          url: `/api/uploads?action=file&path=${encodeURIComponent(f.pathname)}`,
        })),
      });
    }
    if (action === 'file') {
      const path = clean(req.query.path, 400);
      if (!path.startsWith(c.admin ? 'uploads/' : `uploads/${c.id}/`)) return bad(res, 'Not allowed.', 403);
      const r = await get(path, { access: 'private' });
      if (!r || r.statusCode !== 200) return bad(res, 'File not found.', 404);
      res.setHeader('Content-Type', r.blob.contentType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      if (req.query.download) res.setHeader('Content-Disposition', `attachment; filename="${path.split('/').pop().replace(/"/g, '')}"`);
      Readable.fromWeb(r.stream).pipe(res);
      return;
    }
    if (action === 'delete' && req.method === 'POST') {
      const path = clean(req.body?.path, 400);
      if (!path.startsWith(c.admin ? 'uploads/' : `uploads/${c.id}/`)) return bad(res, 'Not allowed.', 403);
      await del(path);
      return send(res, 200, { ok: true });
    }
    return bad(res, 'Unknown action', 404);
  } catch (e) {
    console.error(e);
    return bad(res, e.message === 'Not allowed' ? 'Not allowed.' : 'Upload service error. Please try again.', 500);
  }
}
