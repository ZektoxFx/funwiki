# FunWiki — Visual, Interactive Wikipedia

Type a topic, explore it as an interactive knowledge map instead of a wall of
text. Click nodes to read, double-click to grow the map, and use AI for
summaries, guided learning paths, and quizzes.

Built for the Meta AI Developer Hackathon.

**Demo video (3:00):** https://drive.google.com/file/d/10q5bn-928rzbY0GoCRdsGr6_YKbeciru/view?usp=sharing

## Demo video

`video/` is a [Remotion](https://www.remotion.dev) project that builds the demo
from real footage of the deployed app, with narration and subtitles.

```bash
cd video
npm install
npx playwright install chromium
pip install edge-tts==7.3.1
npm run capture   # record the app with Playwright (public/footage/, git-ignored)
npm run voice     # narrate the cues in src/script.json (public/voice/)
npm run render    # out/master.mp4
npm run studio    # preview and scrub in the browser
```

Narration lives in `video/src/script.json`: each cue has an `at` (seconds into
its scene) and its text. Scene cuts and zooms are in `video/src/Demo.tsx`
(`CLIPS`), timed against `public/footage/marks.json`, which `capture` writes.

## Design

The UI follows the dark variant of [design-md/elevenlabs/DESIGN.md](design-md/elevenlabs/DESIGN.md):
ink canvas, inverted pill buttons, EB Garamond Light display (the documented
Waldenburg substitute), Inter body, and pastel orb colours as the only colour.
[design-md/](design-md) holds the full [awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
collection (84 brand DESIGN.md files, MIT) for future restyles.

## How it works

- **Data:** Wikipedia + Wikidata public APIs (search, article summaries, article
  links). No scraping, no key, cached 1h in the proxy.
- **Home:** a front page in the spirit of wikipedia.org: ten featured topics
  orbit the FunWiki orb, plus search, "Surprise me" and feature tiles that open a
  demo topic on the matching tab. The FunWiki brand (top left) always returns here.
- **Map:** search → central node → the topics linked in the article's opening
  paragraphs, in reading order. It's a live force-directed mind map: nodes repel,
  links act as springs, the map drifts gently, and you can drag topics around.
  Click a node to read it, double-click (or `E`) to grow that branch out of it;
  node size follows its connections and colour its depth. Share any view with the URL —
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

Open http://localhost:5173 in a browser. `npm test` runs the helper tests. For real AI, copy `.env.example`
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
   `/api/...` paths. `server/proxy.mjs` is for local development only and
   mounts those same `api/` handlers, so local and Vercel run identical code.

Note: the 1-hour in-memory cache is per function instance on Vercel, so cold
starts refetch — fine for the demo, but AI calls cost more credits than locally.

## Architecture

```text
browser (React + Vite, dark SVG force-directed mind map: drag, pan, zoom, keyboard)
   │  /api/*
   ▼
api/*.js handlers  ← one implementation, two hosts:
   │                 Vercel serverless (prod) · server/proxy.mjs Express (local)
   ├── en.wikipedia.org (Action API + REST summaries, 1h cache)
   └── Meta Model API, Muse Spark (OpenAI-compatible /chat/completions)
```

Files: [src/App.jsx](src/App.jsx) (shell, reading panel, path stepper, quiz) ·
[src/Graph.jsx](src/Graph.jsx) (SVG map with pan/zoom) · [src/wiki.js](src/wiki.js)
(API client, graph state, share-URL helpers) · [api/_lib.js](api/_lib.js) (cache,
Wikipedia + Meta clients, Muse JSON validation) · [server/proxy.mjs](server/proxy.mjs)
(local host for the `api/` handlers).
