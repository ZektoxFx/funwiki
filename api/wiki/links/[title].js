import { wikiFetch, send } from '../../_lib.js';

export default async function handler(req, res) {
  try {
    const title = req.query.title;
    if (!title) return send(res, 400, { error: 'missing title' });
    const limit = Math.min(parseInt(req.query.limit || '24', 10) || 24, 40);
    const { data } = await wikiFetch(
      `/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=links&pllimit=${limit}&plnamespace=0&format=json&origin=*`
    );
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0] || {};
    const links = (page.links || []).map((l) => l.title).slice(0, limit);
    send(res, 200, { title: page.title || title, links });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
