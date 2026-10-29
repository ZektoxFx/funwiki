import { wikiSummary, send } from '../../_lib.js';

export default async function handler(req, res) {
  try {
    const title = req.query.title;
    if (!title) return send(res, 400, { error: 'missing title' });
    const { out, cached } = await wikiSummary(title);
    send(res, 200, { ...out, cached });
  } catch (e) {
    send(res, e.status || 500, { error: String(e.message || e) });
  }
}
