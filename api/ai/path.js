import { getCache, setCache, metaChat, send } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const { title = '', links = [] } = req.body || {};
    const cacheKey = `ai:path:${title}`;
    const cached = getCache(cacheKey);
    if (cached) return send(res, 200, { ...cached, cached: true });

    const steps = (links || []).slice(0, 15);
    const { text, model } = await metaChat([
      { role: 'system', content: 'Reply with a JSON array only, no other text. Each item: {"title": string, "why": string}.' },
      { role: 'user', content: `I am learning about "${title}". Order 5 of these related Wikipedia articles into a beginner-friendly learning path, easiest first: ${steps.join('; ')}. Reply JSON array only.` }
    ]);
    if (text) {
      try {
        const m = text.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(m ? m[0] : text);
        if (Array.isArray(parsed) && parsed.length) {
          const out = { title, steps: parsed.slice(0, 5), source: `meta:${model}` };
          setCache(cacheKey, out);
          return send(res, 200, { ...out, cached: false });
        }
      } catch { /* fall through to fallback */ }
    }
    const out = {
      title,
      steps: steps.slice(0, 5).map((t, i) => ({ title: t, why: `Step ${i + 1}: explore this branch of ${title}.` })),
      source: 'wikipedia-fallback',
      note: 'Set META_API_KEY for an AI-ordered path.'
    };
    setCache(cacheKey, out);
    send(res, 200, { ...out, cached: false });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
