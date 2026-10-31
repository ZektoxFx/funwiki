// Shared helpers for Vercel serverless functions (underscore = not a route).
// NOTE: the in-memory cache lives per function instance — warm instances reuse
// it, cold starts don't. Fine for the hackathon; use Vercel KV for durable cache.

const WIKI = 'https://en.wikipedia.org';
const CACHE_TTL = 1000 * 60 * 60;
const cache = new Map();

export function getCache(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.v;
  return null;
}

export function setCache(key, value) {
  if (cache.size > 500) cache.clear();
  cache.set(key, { v: value, t: Date.now() });
}

export async function wikiFetch(apiPath) {
  const url = `${WIKI}${apiPath}`;
  const cached = getCache(url);
  if (cached) return { data: cached, cached: true };
  const r = await fetch(url, { headers: { 'User-Agent': 'FunWiki-Hackathon/0.1' } });
  if (!r.ok) throw new Error(`Wikipedia ${r.status}`);
  const data = await r.json();
  setCache(url, data);
  return { data, cached: false };
}

export async function wikiSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const cached = getCache(url);
  if (cached) return { out: cached, cached: true };
  const r = await fetch(url, { headers: { 'User-Agent': 'FunWiki-Hackathon/0.1' } });
  if (!r.ok) {
    const err = new Error('not found');
    err.status = 404;
    throw err;
  }
  const data = await r.json();
  const out = {
    title: data.title,
    extract: data.extract,
    thumbnail: data.thumbnail?.source || null,
    url: data.content_urls?.desktop?.page || null
  };
  setCache(url, out);
  return { out, cached: false };
}

export function metaEnv() {
  return {
    key: process.env.META_API_KEY,
    base: process.env.META_API_BASE || 'https://api.meta.ai/v1',
    model: process.env.META_MODEL || 'muse-spark-1.3'
  };
}

// Returns { text, model, reason }. reason explains an empty text:
// 'no-key' (META_API_KEY missing) or 'empty-response' (Muse replied with no content,
// e.g. all tokens spent on reasoning; finishReason tells which).
export async function metaChat(messages, maxTokens = 500) {
  const { key, base, model } = metaEnv();
  if (!key) return { text: null, model, reason: 'no-key' };
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens })
  });
  if (!r.ok) {
    const detail = (await r.text().catch(() => '')).slice(0, 200);
    throw new Error(`Meta API ${r.status}${detail ? `: ${detail}` : ''}`);
  }
  const data = await r.json();
  const choice = data.choices?.[0] || {};
  const text = choice.message?.content || '';
  return text
    ? { text, model }
    : { text: null, model, reason: 'empty-response', finishReason: choice.finish_reason || null };
}

// Human-readable note for a fallback response.
export function fallbackNote(ai, what) {
  if (ai.reason === 'no-key') return `Set META_API_KEY to enable Muse Spark ${what}.`;
  return `Muse Spark returned an empty reply (finish_reason: ${ai.finishReason || 'unknown'}); showing fallback.`;
}

export function send(res, code, obj) {
  res.status(code).json(obj);
}
