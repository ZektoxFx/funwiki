import { wikiFetch, send } from '../_lib.js';

export default async function handler(req, res) {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    if (!q) return send(res, 400, { error: 'missing q' });
    const { data } = await wikiFetch(
      `/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=8&format=json&origin=*`
    );
    send(res, 200, {
      results: (data.query?.search || []).map((s) => ({
        title: s.title,
        snippet: s.snippet.replace(/<[^>]+>/g, '')
      }))
    });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
