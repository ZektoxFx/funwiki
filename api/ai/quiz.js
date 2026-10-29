import { getCache, setCache, metaChat, send } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const { title = '', extract = '' } = req.body || {};
    const cacheKey = `ai:quiz:${title}`;
    const cached = getCache(cacheKey);
    if (cached) return send(res, 200, { ...cached, cached: true });

    const { text, model } = await metaChat([
      { role: 'system', content: 'Reply with a JSON array only, no other text. Each item: {"q": string, "options": [4 strings], "answer": 0-3}.' },
      { role: 'user', content: `Article: ${title}\n\n${(extract || '').slice(0, 3000)}\n\nWrite 3 multiple-choice quiz questions using ONLY this content. JSON array only.` }
    ], 600);
    if (!text) {
      return send(res, 200, {
        title, questions: [], source: 'wikipedia-fallback',
        cached: false, needsKey: true,
        note: 'Quiz needs META_API_KEY (Muse Spark).'
      });
    }
    try {
      const m = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(m ? m[0] : text);
      const out = { title, questions: parsed.slice(0, 3), source: `meta:${model}` };
      setCache(cacheKey, out);
      return send(res, 200, { ...out, cached: false });
    } catch {
      return send(res, 502, { error: 'AI returned unparseable quiz; try again.' });
    }
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
