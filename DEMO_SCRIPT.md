# FunWiki — 2-Minute Demo Script

> The recorded demo is now built in `video/` (see the README). This script is the
> older live-demo outline; the UI it describes predates the taste-skill redesign.

Total: ~120 seconds. Record on https://funwiki.vercel.app at a wide window.
Before recording, check that the header pill is green ("Meta muse-spark-1.3"),
and run Summary, Path and Quiz on "Black hole" once so they're cached and instant.

## 0:00–0:20 — The problem (show, don't tell)
- Open the Wikipedia "Black hole" article in another tab: wall of text, hundreds of links.
- "Nobody explores like this. What if Wikipedia felt like exploring space?"
- Switch to FunWiki. Search "Black hole" → the map **bursts out of the centre and
  settles**: Gravity, Event horizon, General relativity, Hawking radiation…
- "These aren't random links: they're what the article's opening actually talks about, in order."

## 0:20–0:55 — The living map (core interaction)
- Let it breathe for a second: the map drifts gently. "It's alive."
- **Drag "Event horizon"** across the map → its link follows and the rest re-settles.
- **Double-click "Gravity"** → a new cyan branch bursts out of it.
  "Bigger nodes are hubs; colour is how deep you've gone."
- Hover a node → its links light up and flow. Scroll to zoom, drag space to pan.
- Click "Event horizon" → reading panel: photo + summary. Hit ✺ for fun, then
  "Copy share link" → paste in a fresh tab → same topic. Browser Back works too.

## 0:55–1:25 — The AI layer (Meta Muse Spark)
- Point at the green pill: "Every AI feature runs on Meta's Muse Spark."
- Summary tab → **Simple** → **Ask Muse** → kid-level summary. Switch to
  **5 bullets** → Ask Muse again. The source line reads "Meta muse-spark-1.3".
- Learning path tab → **Build my learning path** → e.g. Astronomical body →
  Gravity → Light → Event horizon → Gravitational singularity.
  "Muse turns the link graph into a curriculum, easiest first."
  Click a step → the map re-centres there.

## 1:25–1:45 — The fun (quiz)
- Quiz tab → **Test me!** → answer 3 questions live; green/red feedback, score appears.
- "Read → path → test: a full learning loop on one page, grounded only in Wikipedia's text."

## 1:45–2:00 — Close (judges)
- "No Wikipedia keys, one Meta model, and one backend that runs the same locally and on Vercel."
- Architecture in one breath: React SVG force-directed map → `api/` functions (cached)
  → Wikipedia APIs + Meta Muse Spark. "Thank you — go get lost. On purpose."

## Backup lines (if something fails live)
- Slow AI: "Muse is reasoning; repeat calls are cached and instant." Switch to a pre-run topic.
- Pill grey / no key: "Fallbacks keep the demo working: summaries and paths come straight from Wikipedia."
- Quiz error: "Muse gave an answer we couldn't verify, so we reject it rather than show a broken quiz." Click **New quiz**.
- Map too busy: ⟲ resets the view; ✺ shakes the layout loose.
