# FunWiki — Project Memory

Durable notes for future sessions. Full session history lives in
`.agents/plans/2026-10-29-visual-wikipedia.md` (canonical record).

- **What:** Visual, interactive Wikipedia — search any topic, explore it as a
  knowledge map instead of long text. Meta AI Developer Hackathon entry.
- **Repo:** https://github.com/ZektoxFx/funwiki (`main`, pushed after every change)
- **Live:** https://funwiki.vercel.app (public, verified 200 + app title + API ok)
- **Local run:** `node server/proxy.mjs` (API :3001) + `npx vite` (app :5173).
  Copy `.env.example` to `.env` and set `META_API_KEY` for live AI.
- **Stack:** React 18 + Vite 5 + Express proxy (local) / `api/` serverless
  functions (Vercel). Custom SVG graph. AI via Meta Model API (`muse-spark-1.3`):
  `/api/ai/summarize`, `/api/ai/path`, `/api/ai/quiz` — cached, with Wikipedia
  fallbacks when no key.
- **Standing rules:** push to GitHub after every change; verify with real runs
  (build, handler checks, live endpoints), not assumptions.
- **Pending:** set `META_API_KEY` in Vercel env for live AI; record demo video
  (script in `DEMO_SCRIPT.md`).
