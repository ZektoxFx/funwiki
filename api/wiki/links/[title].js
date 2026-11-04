import { wikiFetch, leadLinks, send } from '../../_lib.js';

export default async function handler(req, res) {
  try {
    const title = req.query.title;
    if (!title) return send(res, 400, { error: 'missing title' });
    const limit = Math.min(parseInt(req.query.limit || '24', 10) || 24, 40);
    const t = encodeURIComponent(title);

    const { data: lead } = await wikiFetch(
      `/w/api.php?action=parse&page=${t}&prop=text&section=0&redirects=1&format=json&formatversion=2&origin=*`
    );
    const links = leadLinks(lead.parse?.text).filter((l) => l !== lead.parse?.title);

    // Short stubs have few lead links: top up from the full (alphabetical) link list.
    if (links.length < limit) {
      const { data } = await wikiFetch(
        `/w/api.php?action=query&titles=${t}&redirects=1&prop=links&pllimit=${limit}&plnamespace=0&format=json&origin=*`
      );
      const page = Object.values(data.query?.pages || {})[0] || {};
      for (const l of page.links || []) if (!links.includes(l.title)) links.push(l.title);
    }
    send(res, 200, { title: lead.parse?.title || title, links: links.slice(0, limit) });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
