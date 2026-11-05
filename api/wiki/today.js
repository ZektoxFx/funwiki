import { wikiFetch, send } from '../_lib.js';

// Wikipedia's daily front page: the most-read articles (of the day before) and the picture of the day.
// GET /api/wiki/today?date=YYYY-MM-DD
export default async function handler(req, res) {
  try {
    const date = (req.query.date || new Date().toISOString().slice(0, 10)).toString();
    // Validated strictly: it is interpolated into the upstream URL.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: 'date must be YYYY-MM-DD' });
    const { data } = await wikiFetch(`/api/rest_v1/feed/featured/${date.replace(/-/g, '/')}`);
    const mr = data.mostread || {};
    const im = data.image;
    send(res, 200, {
      date,
      readOn: (mr.date || '').slice(0, 10) || null,
      mostread: (mr.articles || []).slice(0, 8).map((a) => ({
        title: a.normalizedtitle || a.title,
        views: a.views,
        description: a.description || null,
        thumbnail: a.thumbnail?.source || null
      })),
      image: im ? {
        title: (im.title || '').replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        thumbnail: im.thumbnail?.source || null,
        artist: im.artist?.text || null,
        license: im.license?.type || null,
        page: im.file_page || null
      } : null,
      featured: data.tfa?.normalizedtitle || null
    });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
