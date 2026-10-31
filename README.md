# FunWiki — Visual, Interactive Wikipedia

Type a topic, explore it as an interactive knowledge map instead of a wall of
text. Click nodes to read, double-click to grow the map, and use AI for
summaries, guided learning paths, and quizzes.

Built for the Meta AI Developer Hackathon.

## How it works

- **Data:** Wikipedia + Wikidata public APIs (search, article summaries, article
  links). No scraping, no key, cached 1h in the proxy.
- **Map:** search → central node → 1-hop link ring. Click a node to read it,
  double-click (or Expand) to grow that branch. Share any view with the URL —
  the topic lives in the hash (`#/Black_hole`).
- **AI (Meta Model API):** every AI feature goes through `META_API_BASE` /
  `META_MODEL` (default `muse-spark-1.3`):
  - `POST /api/ai/summarize` — Explain simply / 5 bullets / Deep dive
  - `POST /api/ai/path` — 5-step beginner-friendly learning path
  - `POST /api/ai/quiz` — 3 multiple-choice questions with scoring
  - Without `META_API_KEY`: summaries and paths fall back to Wikipedia text,
    quiz explains it needs a key. All responses cached (repeat call → `cached`).

## Run it

Requirements: Node 18+.

```powershell
npm install --cache .npm-cache   # first time only
node server/proxy.mjs            # terminal 1 — API on http://localhost:3001
npx vite                         # terminal 2 — app on http://localhost:5173
```

Open http://localhost:5173 in a browser. For real AI, copy `.env.example`
to `.env` and set `META_API_KEY` before starting the proxy.

## Deploy on Vercel

The same app runs serverless — no code changes needed on the frontend:

1. Push this folder to GitHub and import it in Vercel (framework preset: Vite,
   build `npm run build`, output `dist` — see [vercel.json](vercel.json)).
2. Add environment variables in Vercel → Project → Settings → Environment
   Variables: `META_API_KEY` (required for live AI), optionally `META_API_BASE`
   and `META_MODEL`.
3. Deploy. The Express proxy is **not** used on Vercel — [api/](api) holds the
   same seven endpoints as serverless functions (`api/health.js`,
   `api/wiki/*`, `api/ai/*`), and the client already calls same-origin
   `/api/...` paths. `server/proxy.mjs` stays for local development only.

Note: the 1-hour in-memory cache is per function instance on Vercel, so cold
starts refetch — fine for the demo, but AI calls cost more credits than locally.

## Architecture

```text
browser (React + Vite, custom SVG radial graph)
   │  /api/*
   ▼
server/proxy.mjs (Express: Wikipedia proxy + 1h cache + Meta AI layer)
   ├── en.wikipedia.org (Action API + REST summaries)
   └── Meta Model API (OpenAI-compatible /chat/completions)
```

Files: [src/App.jsx](src/App.jsx) (tabs, path stepper, quiz) ·
[src/Graph.jsx](src/Graph.jsx) (SVG map) · [src/wiki.js](src/wiki.js) (API client,
graph state, share-URL helpers) · [server/proxy.mjs](server/proxy.mjs).
