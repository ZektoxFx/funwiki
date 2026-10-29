import React from 'react';

export async function searchWiki(q) {
  const r = await fetch(`/api/wiki/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error('search failed');
  const j = await r.json();
  return j.results || [];
}

export async function fetchSummary(title) {
  const r = await fetch(`/api/wiki/summary/${encodeURIComponent(title)}`);
  if (!r.ok) throw new Error('summary failed');
  return r.json();
}

export async function fetchLinks(title, limit = 24) {
  const r = await fetch(`/api/wiki/links/${encodeURIComponent(title)}?limit=${limit}`);
  if (!r.ok) throw new Error('links failed');
  return r.json();
}

export async function aiSummarize(title, extract, level) {
  const r = await fetch('/api/ai/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, extract, level })
  });
  if (!r.ok) throw new Error('ai failed');
  return r.json();
}

export async function aiPath(title, links) {
  const r = await fetch('/api/ai/path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, links })
  });
  if (!r.ok) throw new Error('path failed');
  return r.json();
}

export async function aiQuiz(title, extract) {
  const r = await fetch('/api/ai/quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, extract })
  });
  if (!r.ok) throw new Error('quiz failed');
  return r.json();
}

export function topicFromUrl() {
  const m = window.location.hash.match(/^#\/(.+)/);
  return m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : null;
}

export function topicToUrl(title) {
  window.location.hash = `#/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function useWikiGraph() {
  const [nodes, setNodes] = React.useState([]);
  const [edges, setEdges] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  async function explore(title) {
    setLoading(true);
    try {
      const [summary, linkData] = await Promise.all([fetchSummary(title), fetchLinks(title)]);
      const center = { id: summary.title, x: 400, y: 260, kind: 'center', summary };
      const ring = (linkData.links || []).map((t, i, arr) => {
        const angle = (2 * Math.PI * i) / Math.max(arr.length, 1);
        return { id: t, x: 400 + 220 * Math.cos(angle), y: 260 + 190 * Math.sin(angle), kind: 'link' };
      });
      setNodes([center, ...ring]);
      setEdges(ring.map((n) => ({ from: center.id, to: n.id })));
      return summary;
    } finally {
      setLoading(false);
    }
  }

  async function expand(title) {
    const linkData = await fetchLinks(title, 12);
    setNodes((prev) => {
      if (prev.find((n) => n.id === title && n.kind === 'center')) return prev;
      const parent = prev.find((n) => n.id === title) || { x: 400, y: 260 };
      const fresh = (linkData.links || [])
        .filter((t) => !prev.find((n) => n.id === t))
        .slice(0, 8)
        .map((t, i, arr) => {
          const angle = (2 * Math.PI * i) / Math.max(arr.length, 1);
          return { id: t, x: parent.x + 130 * Math.cos(angle), y: parent.y + 110 * Math.sin(angle), kind: 'link' };
        });
      return [...prev, ...fresh];
    });
    setEdges((prev) => [...prev, ...(linkData.links || []).slice(0, 8).map((t) => ({ from: title, to: t }))]);
  }

  return { nodes, edges, loading, explore, expand, setNodes };
}
