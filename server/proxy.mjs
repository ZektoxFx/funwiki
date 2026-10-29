import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const WIKI = 'https://en.wikipedia.org';
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 60;

function getCache(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.v;
  return null;
}
function setCache(key, v) {
  if (cache.size > 500) cache.clear();
  cache.set(key, { v, t: Date.now() });
}

async function wikiFetch(path) {
  const url = `${WIKI}${path}`;
  const cached = getCache(url);
  if (cached) return { data: cached, cached: true };
  const r = await fetch(url, { headers: { 'User-Agent': 'FunWiki-Hackathon/0.1' } });
  if (!r.ok) throw new Error(`Wikipedia ${r.status}`);
  const data = await r.json();
  setCache(url, data);
  return { data, cached: false };
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Search: /api/wiki/search?q=black holes
app.get('/api/wiki/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    if (!q) return res.status(400).json({ error: 'missing q' });
    const { data } = await wikiFetch(
      `/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=8&format=json&origin=*`
    );
    res.json({ results: (data.query?.search || []).map((s) => ({ title: s.title, snippet: s.snippet.replace(/<[^>]+>/g, '') })) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Summary: /api/wiki/summary/:title
app.get('/api/wiki/summary/:title', async (req, res) => {
  try {
    const title = req.params.title;
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const cached = getCache(url);
    if (cached) return res.json({ ...cached, cached: true });
    const r = await fetch(url, { headers: { 'User-Agent': 'FunWiki-Hackathon/0.1' } });
    if (!r.ok) return res.status(404).json({ error: 'not found' });
    const data = await r.json();
    const out = { title: data.title, extract: data.extract, thumbnail: data.thumbnail?.source || null, url: data.content_urls?.desktop?.page || null };
    setCache(url, out);
    res.json({ ...out, cached: false });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Links (1-hop graph): /api/wiki/links/:title
app.get('/api/wiki/links/:title', async (req, res) => {
  try {
    const title = req.params.title;
    const limit = Math.min(parseInt(req.query.limit || '24', 10) || 24, 40);
    const { data } = await wikiFetch(
      `/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=links&pllimit=${limit}&plnamespace=0&format=json&origin=*`
    );
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0] || {};
    const links = (page.links || []).map((l) => l.title).slice(0, limit);
    res.json({ title: page.title || title, links });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Meta AI layer — all AI goes through Meta Model API. Falls back when no key.
function metaEnv() {
  return {
    key: process.env.META_API_KEY,
    base: process.env.META_API_BASE || 'https://api.meta.ai/v1',
    model: process.env.META_MODEL || 'muse-spark-1.3'
  };
}

async function metaChat(messages, maxTokens = 500) {
  const { key, base, model } = metaEnv();
  if (!key) return { text: null, model };
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens })
  });
  if (!r.ok) throw new Error(`Meta API ${r.status}`);
  const data = await r.json();
  return { text: data.choices?.[0]?.message?.content || '', model };
}

app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { title = '', extract = '', level = 'eli5' } = req.body || {};
    const cacheKey = `ai:${level}:${title}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const style = level === 'bullets' ? 'as 5 short bullets' : level === 'deep' ? 'as a 3-paragraph deep dive' : 'like I am 5 years old, in 3 sentences';
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
      return res.json({ ...out, cached: false });
    }
    const out = { title, level, text, source: `meta:${model}` };
    setCache(cacheKey, out);
    res.json({ ...out, cached: false });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Learning path: ordered 5-step trail starting at title through its links.
app.post('/api/ai/path', async (req, res) => {
  try {
    const { title = '', links = [] } = req.body || {};
    const cacheKey = `ai:path:${title}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

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
          return res.json({ ...out, cached: false });
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
    res.json({ ...out, cached: false });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Quiz: 3 multiple-choice questions about the article.
app.post('/api/ai/quiz', async (req, res) => {
  try {
    const { title = '', extract = '' } = req.body || {};
    const cacheKey = `ai:quiz:${title}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const { text, model } = await metaChat([
      { role: 'system', content: 'Reply with a JSON array only, no other text. Each item: {"q": string, "options": [4 strings], "answer": 0-3}.' },
      { role: 'user', content: `Article: ${title}\n\n${(extract || '').slice(0, 3000)}\n\nWrite 3 multiple-choice quiz questions using ONLY this content. JSON array only.` }
    ], 600);
    if (!text) {
      return res.json({ title, questions: [], source: 'wikipedia-fallback', cached: false, needsKey: true, note: 'Quiz needs META_API_KEY (Muse Spark).' });
    }
    try {
      const m = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(m ? m[0] : text);
      const out = { title, questions: parsed.slice(0, 3), source: `meta:${model}` };
      setCache(cacheKey, out);
      return res.json({ ...out, cached: false });
    } catch {
      return res.status(502).json({ error: 'AI returned unparseable quiz; try again.' });
    }
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`FunWiki proxy on http://localhost:${PORT}`));
