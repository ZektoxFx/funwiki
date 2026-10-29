import { getCache, setCache, metaChat, send } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const { title = '', extract = '', level = 'eli5' } = req.body || {};
    const cacheKey = `ai:${level}:${title}`;
    const cached = getCache(cacheKey);
    if (cached) return send(res, 200, { ...cached, cached: true });

    const style =
      level === 'bullets' ? 'as 5 short bullets'
      : level === 'deep' ? 'as a 3-paragraph deep dive'
      : 'like I am 5 years old, in 3 sentences';
    const { text, model } = await metaChat([
      { role: 'system', content: 'Summarize only the provided Wikipedia content. Do not add facts beyond it.' },
      { role: 'user', content: `Article: ${title}\n\n${(extract || '').slice(0, 4000)}\n\nSummarize ${style}.` }
    ]);
    if (!text) {
      const out = {
        title, level,
        text: (extract || '').split('. ').slice(0, 3).join('. ') + '.',
        source: 'wikipedia-fallback',
        note: 'Set META_API_KEY to enable Muse Spark summaries.'
      };
      setCache(cacheKey, out);
      return send(res, 200, { ...out, cached: false });
    }
    const out = { title, level, text, source: `meta:${model}` };
    setCache(cacheKey, out);
    send(res, 200, { ...out, cached: false });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
