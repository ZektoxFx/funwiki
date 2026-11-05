"""Narration for the demo video: one mp3 per cue in src/script.json, via edge-tts.

    npm run voice

Writes public/voice/<scene>-<n>.mp3 and public/voice/durations.json ({"<scene>-<n>": seconds}).
Each cue's "at" is seconds into its scene; src/Demo.tsx places the audio there and
checks that no cue runs into the next one.
"""
import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

OUT = Path("public/voice")
SCRIPT = json.loads(Path("src/script.json").read_text(encoding="utf8"))


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return round(float(out.stdout.strip()), 2)


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    durations = {}
    for scene, cues in SCRIPT["scenes"].items():
        for i, cue in enumerate(cues):
            key = f"{scene}-{i}"
            path = OUT / f"{key}.mp3"
            await edge_tts.Communicate(cue["text"], SCRIPT["voice"], rate=SCRIPT["rate"]).save(str(path))
            durations[key] = duration(path)
            nxt = cues[i + 1]["at"] if i + 1 < len(cues) else None
            end = cue["at"] + durations[key]
            warn = f"  OVERLAPS next cue at {nxt}s" if nxt is not None and end > nxt - 0.2 else ""
            print(f"{key:10} at {cue['at']:5.1f}s  ends {end:5.1f}s{warn}")
    (OUT / "durations.json").write_text(json.dumps(durations, indent=2))


asyncio.run(main())
