import { getCache, setCache, metaChat, fallbackNote, parseJsonArray, shuffleOptions, send } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const { title = '', extract = '' } = req.body || {};
    const cacheKey = `ai:quiz:${title}`;
    const cached = getCache(cacheKey);
    if (cached) return send(res, 200, { ...cached, cached: true });

    const ai = await metaChat([
      { role: 'system', content: 'Reply with a JSON array only, no other text. Each item: {"q": string, "options": [4 strings], "answer": 0-3}.' },
      { role: 'user', content: `Article: ${title}\n\n${(extract || '').slice(0, 3000)}\n\nWrite 3 multiple-choice quiz questions using ONLY this content. JSON array only.` }
    ], 600);
    const { text, model } = ai;
    if (!text) {
      return send(res, 200, {
        title, questions: [], source: 'wikipedia-fallback',
        cached: false, needsKey: ai.reason === 'no-key', reason: ai.reason,
        note: fallbackNote(ai, 'quizzes')
      });
    }
    const questions = parseJsonArray(text, (x) =>
      typeof x?.q === 'string' && Array.isArray(x.options) && x.options.length >= 2 &&
      Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.options.length
    ).slice(0, 3).map(shuffleOptions);
    if (!questions.length) return send(res, 502, { error: 'Muse Spark returned an unusable quiz; try again.' });
    const out = { title, questions, source: `meta:${model}` };
    setCache(cacheKey, out);
    send(res, 200, { ...out, cached: false });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
