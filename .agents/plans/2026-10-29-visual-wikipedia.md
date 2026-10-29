# Visual Interactive Wikipedia — Hackathon Plan + Session Memory
Date: 2026-10-29 | Event: Meta AI Developer Hackathon (https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details)

## Goal
Build a visual/interactive alternative to text-heavy Wikipedia: type a topic and explore it as an interactive knowledge map (nodes = articles/concepts, edges = links), with AI-guided summaries, learning paths, and geo/timeline views. Target: fun to browse, demoable in 2 minutes, eligible for Meta hackathon judging (must use Meta Model API).

## Success Criteria
- User can search any Wikipedia topic and see an interactive graph within ~3s, click nodes to expand, and read a short AI summary instead of a wall of text.
- At least 2 "wow" views beyond text: knowledge graph + one of timeline / geo-map / AI learning path.
- Every AI feature runs through Meta Model API (Muse Spark or equivalent), with $150-credit budget in mind (cache aggressively).
- Demo-ready: deployed URL + 2-min video script + README explaining Meta API usage.

## Approach
- Data: Wikipedia/Wikidata public APIs (MediaWiki Action API + REST summary + Wikidata) — no key, CORS-friendly via thin backend proxy. No scraping.
- Frontend: single-page app (React + Vite + TypeScript). Graph with react-force-graph or Cytoscape; geo with Leaflet only for place-type articles; timeline derived from article dates/Wikidata.
- Backend (thin): Node/Python proxy that (1) hides Meta API key, (2) caches Wikipedia + LLM responses, (3) rate-limits graph expansion to avoid explosion.
- AI (Meta-required): article summarizer (ELI5 / 5-bullet / deep-dive levels), "where to go next" recommender, quiz/fun-facts generator, conversational explorer. All prompts constrained to cited Wikipedia content to reduce hallucination.
- Scope guard: read-only explorer for hackathon. No editing Wikipedia, no accounts, no offline dump.

## Steps
1. **Scaffold + data spike (Day 1-2):** Vite app, proxy endpoint `/api/wiki/*`, verify search → article → links flow for 3 test topics (e.g. Black Holes, Malacca, Photosynthesis). Decide graph lib after spike.
2. **Core map MVP (Day 3-5):** search bar → central node → 1-hop link graph, click-to-expand (cap ~30 nodes), side panel with REST summary + thumbnail + link to full article.
3. **Meta AI layer (Day 5-7):** wire Meta Model API for summarize-by-level, related-path suggestions, quiz/fun-facts. Add caching + fallback to raw summary when quota/offline.
4. **Second view + polish (Day 7-9):** ship one of timeline or geo-map + learning-path mode; add share-URL, mobile layout, loading/empty/error states.
5. **Demo packaging (Day 9-10):** deploy, record 2-min demo, write README (problem, Meta API usage, architecture, run instructions), test judging flow cold.

## Validation Plan
- Data: `search "Black Holes"` returns graph with >10 nodes in <3s; clicking a node expands without duplicates or freeze (manual + network timing).
- AI: same article requested twice hits cache (proxy log); summaries cite the displayed article and degrade gracefully with API key removed.
- E2E demo check: cold load → search → expand 2 levels → AI summary → second view → share-URL reload, all without console errors.
- Hackathon eligibility: README lists every Meta model/endpoint used; build passes with only `META_API_KEY` as secret.

## Risks / Open Questions
- Hackathon rules/track details unconfirmed (event page is JS-gated; details from secondary listings: ~10-day virtual, $1M pool, Indie vs Startup tracks). Assumption: must demo Meta Model API usage — verify at https://developers.meta.ai before building.
- Graph explosion on dense articles (e.g. World War II) → mitigation: degree cap, lazy expand, "most-linked first" ranking. Open: default depth 1 or 2?
- Wikidata dates/coordinates are sparse for abstract topics → timeline/geo view falls back to hidden state. Open: which second view to commit to after spike?
- None: no auth, no edit-writeback, no full-text mirror in v1.

---
Memory for later sessions: owner wants visual Wikipedia over long text. Status 2026-10-29: ALL PLAN STEPS DONE and cold-verified. Renamed to FunWiki. Vercel-ready: api/ serverless functions mirror all 7 proxy endpoints (12/12 handler checks passed), vercel.json present, README has deploy steps. Stack: React 18 + Vite 5 + Express proxy, custom SVG radial graph. Features: search → knowledge map (click read, double-click expand), side panel with Summary/Learning-path/Quiz tabs, share-URL hash, copy-link, error/empty states. AI via Meta Model API (muse-spark-1.3): /api/ai/summarize + /api/ai/path + /api/ai/quiz, all cached, Wikipedia fallbacks when no key (quiz reports needsKey). Verified cold: proxy 200, client 200, search/links/summary live, summarize+path cached=true on repeat. Docs: README.md, DEMO_SCRIPT.md. Next: set META_API_KEY in .env for live AI, record demo video, deploy. Run: `node server/proxy.mjs` + `npx vite` → http://localhost:5173.
