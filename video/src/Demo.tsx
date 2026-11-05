import React from 'react';
import {
  AbsoluteFill, Easing, Sequence, Series, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig
} from 'remotion';
import { Audio, Video } from '@remotion/media';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { loadFont as loadSerif } from '@remotion/google-fonts/Newsreader';
import { loadFont as loadSans } from '@remotion/google-fonts/Inter';
import script from './script.json';
import durations from '../public/voice/durations.json';

const { fontFamily: SERIF } = loadSerif('normal', { weights: ['400', '500'], subsets: ['latin'] });
const { fontFamily: SANS } = loadSans('normal', { weights: ['400', '500'], subsets: ['latin'] });

export const FPS = 30;
const TARGET = 180; // seconds
const FADE = 15; // frames per transition

const C = { ground: '#0a0a0a', surface: '#151515', raised: '#222', ink: '#f2efe9', dim: '#9a968f', accent: '#b11226' };

// ---------------------------------------------------------------- timing

type Zoom = [scale: number, x: number, y: number]; // focus point in 0..1 of the frame
type Seg = { from: number; to: number; z0?: Zoom; z1?: Zoom };
type Clip = { src: string; rate: number; segs: Seg[] };
type SceneId = keyof typeof script.scenes;

const NONE: Zoom = [1, 0.5, 0.5];


const CLIPS: Partial<Record<SceneId, Clip>> = {
  problem: { src: 'wikipedia', rate: 1.2, segs: [{ from: 6.4, to: 24.5, z0: [1, 0.5, 0.3], z1: [1.12, 0.4, 0.3] }] },
  home: {
    src: 'home', rate: 1.1, segs: [
      { from: 3.0, to: 14.5, z0: NONE, z1: [1.05, 0.5, 0.5] },
      { from: 19.5, to: 23.0 },
      { from: 23.7, to: 33.0, z0: NONE, z1: [1.2, 0.62, 0.5] }
    ]
  },
  map: {
    src: 'map', rate: 1.15, segs: [
      { from: 4.0, to: 12.5 },
      { from: 12.5, to: 22.2, z0: [1, 0.4, 0.55], z1: [1.3, 0.4, 0.55] },
      { from: 22.2, to: 34.0, z0: [1.3, 0.4, 0.55], z1: [1.3, 0.35, 0.6] },
      { from: 34.0, to: 42.0, z0: [1.3, 0.35, 0.6], z1: [1.25, 0.3, 0.65] },
      { from: 42.0, to: 51.3, z0: [1.25, 0.3, 0.65], z1: NONE }
    ]
  },
  summary: {
    src: 'summary', rate: 1, segs: [
      { from: 1.4, to: 8.3, z0: NONE, z1: [1.15, 0.9, 0.6] },
      { from: 16.8, to: 29.0, z0: [1.7, 0.97, 0.85], z1: [1.7, 0.97, 0.85] },
      { from: 34.5, to: 41.8, z0: [1.7, 0.97, 0.85], z1: [1.7, 0.97, 0.88] }
    ]
  },
  path: {
    src: 'path', rate: 1, segs: [
      { from: 1.6, to: 9.3, z0: NONE, z1: [1.15, 0.95, 0.55] },
      { from: 16.0, to: 23.0, z0: [1.35, 0.3, 0.6], z1: [1.35, 0.3, 0.6] },
      { from: 23.0, to: 30.9, z0: [1.35, 0.3, 0.6], z1: [1.15, 0.75, 0.6] }
    ]
  },
  quiz: {
    src: 'quiz', rate: 1, segs: [
      { from: 6.0, to: 10.7, z0: NONE, z1: [1.15, 0.95, 0.4] },
      { from: 17.2, to: 34.5, z0: [1.3, 0.97, 0.75], z1: [1.3, 0.97, 0.7] }
    ]
  }
};

const FIXED: Partial<Record<SceneId, number>> = { title: 6, how: 21 };
const LABELS: Partial<Record<SceneId, string>> = {
  problem: 'The problem',
  home: 'The front page',
  map: 'The living map',
  summary: 'Muse Spark: summaries',
  path: 'Muse Spark: learning paths',
  quiz: 'Muse Spark: quizzes'
};

const segLen = (s: Seg, rate: number) => (s.to - s.from) / rate;

// Cues start at their "at", or just after the previous cue if that one runs long.
type Cue = { key: string; text: string; start: number; end: number };
function cuesFor(id: SceneId): Cue[] {
  let prevEnd = -Infinity;
  return script.scenes[id].map((c, i) => {
    const key = `${id}-${i}`;
    const d = (durations as Record<string, number>)[key];
    if (d === undefined) throw new Error(`No narration for ${key}: run npm run voice`);
    const start = Math.max(c.at, prevEnd + 0.25);
    prevEnd = start + d;
    return { key, text: c.text, start, end: prevEnd };
  });
}

const ORDER = Object.keys(script.scenes) as SceneId[];
const CUES = Object.fromEntries(ORDER.map((id) => [id, cuesFor(id)])) as Record<SceneId, Cue[]>;

function contentSeconds(id: SceneId): number {
  const clip = CLIPS[id];
  if (clip) return clip.segs.reduce((a, s) => a + segLen(s, clip.rate), 0);
  return FIXED[id] ?? 0;
}

// Every scene lasts at least as long as its footage and its narration; the close
// fills whatever is left of the target length.
const SECONDS: Record<SceneId, number> = Object.fromEntries(ORDER.map((id) => {
  const cues = CUES[id];
  return [id, Math.max(contentSeconds(id), cues[cues.length - 1].end + 0.8)];
})) as Record<SceneId, number>;
{
  const overlap = ((ORDER.length - 1) * FADE) / FPS;
  const rest = ORDER.filter((id) => id !== 'close').reduce((a, id) => a + SECONDS[id], 0);
  SECONDS.close = Math.max(SECONDS.close, TARGET + overlap - rest);
}
const FRAMES = Object.fromEntries(ORDER.map((id) => [id, Math.round(SECONDS[id] * FPS)])) as Record<SceneId, number>;
export const TOTAL_FRAMES = ORDER.reduce((a, id) => a + FRAMES[id], 0) - (ORDER.length - 1) * FADE;

// ---------------------------------------------------------------- pieces

const ease = Easing.bezier(0.45, 0, 0.2, 1);

function Camera({ z0 = NONE, z1 = z0, frames, children }: { z0?: Zoom; z1?: Zoom; frames: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const t = interpolate(f, [0, Math.max(frames - 1, 1)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
  const [s, x, y] = z0.map((v, i) => v + (z1[i] - v) * t);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${s})`, transformOrigin: `${x * 100}% ${y * 100}%` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

function Footage({ clip }: { clip: Clip }) {
  return (
    <Series>
      {clip.segs.map((s, i) => {
        const frames = Math.round(segLen(s, clip.rate) * FPS);
        return (
          <Series.Sequence key={i} durationInFrames={frames} premountFor={FPS}>
            <Camera z0={s.z0} z1={s.z1} frames={frames}>
              <Video
                src={staticFile(`footage/${clip.src}.mp4`)}
                trimBefore={Math.round(s.from * FPS)}
                trimAfter={Math.round(s.to * FPS)}
                playbackRate={clip.rate}
                muted
                style={{ width: '100%', height: '100%' }}
              />
            </Camera>
          </Series.Sequence>
        );
      })}
    </Series>
  );
}

function Narration({ cues }: { cues: Cue[] }) {
  return (
    <>
      {cues.map((c) => (
        <Sequence key={c.key} from={Math.round(c.start * FPS)} layout="none">
          <Audio src={staticFile(`voice/${c.key}.mp3`)} />
        </Sequence>
      ))}
    </>
  );
}

function Subtitles({ cues }: { cues: Cue[] }) {
  const f = useCurrentFrame();
  const t = f / FPS;
  const cue = cues.find((c) => t >= c.start && t < c.end + 0.15);
  if (!cue) return null;
  const local = (t - cue.start) * FPS;
  const opacity = interpolate(local, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 54 }}>
      <div style={{
        opacity, maxWidth: 1360, padding: '14px 26px', background: 'rgba(10,10,10,0.86)', color: C.ink,
        fontFamily: SANS, fontSize: 34, lineHeight: 1.35, textAlign: 'center', borderRadius: 6
      }}>{cue.text}</div>
    </AbsoluteFill>
  );
}

function Label({ text }: { text: string }) {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [8, 20, 3.5 * FPS, 4.2 * FPS], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(f, [8, 24], [12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ padding: 48, alignItems: 'flex-end' }}>
      <div style={{
        opacity, transform: `translateY(${y}px)`, background: C.accent, color: '#fff', fontFamily: SANS,
        fontSize: 26, fontWeight: 500, padding: '10px 18px', borderRadius: 4
      }}>{text}</div>
    </AbsoluteFill>
  );
}

// A small map that grows out of a crimson centre: the product's own picture.
function Burst({ size = 520, n = 9, delay = 0 }: { size?: number; n?: number; delay?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = size / 2;
  const nodes = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n + 0.2;
    const r = size * (i % 2 ? 0.36 : 0.44);
    const p = spring({ frame: f - delay - 6 - i * 2, fps, config: { damping: 14, stiffness: 120 } });
    const drift = Math.sin((f + i * 17) / 40) * 4;
    return { x: c + Math.cos(a) * r * p + drift, y: c + Math.sin(a) * r * p - drift, p };
  });
  const core = spring({ frame: f - delay, fps, config: { damping: 12 } });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {nodes.map((p, i) => <line key={'l' + i} x1={c} y1={c} x2={p.x} y2={p.y} stroke="#555" strokeWidth={2} opacity={p.p} />)}
      {nodes.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={9} fill={C.ground} stroke="#bbb" strokeWidth={2.5} opacity={p.p} />)}
      <circle cx={c} cy={c} r={30 * core} fill={C.accent} />
    </svg>
  );
}

function rise(f: number, start: number) {
  const t = interpolate(f, [start, start + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return { opacity: t, transform: `translateY(${(1 - t) * 40}px)` };
}

function Title() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.ground, flexDirection: 'row', alignItems: 'center', padding: '0 160px', gap: 90 }}>
      <Burst />
      <div style={{ color: C.ink, fontFamily: SERIF }}>
        <div style={{ ...rise(f, 14), fontFamily: SANS, fontSize: 34, color: C.dim, marginBottom: 18 }}>FunWiki</div>
        <div style={{ ...rise(f, 22), fontSize: 132, lineHeight: 1.02 }}>Wikipedia,</div>
        <div style={{ ...rise(f, 30), fontSize: 132, lineHeight: 1.02 }}>as a map.</div>
      </div>
    </AbsoluteFill>
  );
}

type BoxProps = { x: number; y: number; w: number; title: string; lines: string[]; show: number; hot?: boolean };
function Box({ x, y, w, title, lines, show, hot }: BoxProps) {
  const f = useCurrentFrame();
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, ...rise(f, show),
      background: hot ? C.accent : C.surface, borderRadius: 10, padding: '28px 32px', color: C.ink
    }}>
      <div style={{ fontFamily: SERIF, fontSize: 46, marginBottom: 12 }}>{title}</div>
      {lines.map((l) => <div key={l} style={{ fontFamily: SANS, fontSize: 25, lineHeight: 1.45, color: hot ? '#fff' : C.dim }}>{l}</div>)}
    </div>
  );
}

function Arrow({ x1, y1, x2, y2, show, dashed }: { x1: number; y1: number; x2: number; y2: number; show: number; dashed?: boolean }) {
  const f = useCurrentFrame();
  const t = interpolate(f, [show, show + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const len = Math.hypot(x2 - x1, y2 - y1);
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={dashed ? C.accent : '#666'} strokeWidth={4}
      strokeDasharray={dashed ? '14 12' : `${len} ${len}`} strokeDashoffset={dashed ? 0 : len * (1 - t)} opacity={dashed ? t : 1} />
  );
}

function How({ cues }: { cues: Cue[] }) {
  const f = useCurrentFrame();
  const at = (i: number) => Math.round(cues[i].start * FPS);
  const muse = f >= at(2);
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <div style={{ position: 'absolute', left: 120, top: 96, color: C.ink, fontFamily: SERIF, fontSize: 72, ...rise(f, 0) }}>How it works</div>
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        <Arrow x1={600} y1={500} x2={720} y2={500} show={at(1)} />
        <Arrow x1={1180} y1={460} x2={1290} y2={355} show={at(1) + 12} />
        <Arrow x1={1180} y1={560} x2={1290} y2={680} show={at(2)} />
        <Arrow x1={1560} y1={600} x2={1560} y2={470} show={at(3)} dashed />
      </svg>
      <Box x={120} y={380} w={480} show={at(0)} title="Browser" lines={['React + SVG map', 'its own physics, no graph library', 'hash links you can share']} />
      <Box x={720} y={380} w={460} show={at(1)} title="Vercel functions" lines={['api/ on Node', 'responses cached for an hour', 'shape-checks every Muse reply']} />
      <Box x={1290} y={230} w={520} show={at(1) + 12} title="Wikipedia APIs" lines={['summaries, opening-paragraph links,', "today's most read, picture of the day"]} />
      <Box x={1290} y={600} w={520} show={at(2)} hot={muse} title="Meta Muse Spark" lines={['summaries, learning paths, quizzes']} />
      {f >= at(3) && (
        <div style={{ position: 'absolute', left: 1580, top: 505, color: C.ink, fontFamily: SANS, fontSize: 24, ...rise(f, at(3)) }}>fallback</div>
      )}
    </AbsoluteFill>
  );
}

function Close() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.ground, alignItems: 'center', justifyContent: 'center', color: C.ink, textAlign: 'center' }}>
      <Burst size={300} n={7} />
      <div style={{ ...rise(f, 12), fontFamily: SERIF, fontSize: 120, marginTop: 30 }}>FunWiki</div>
      <div style={{ ...rise(f, 22), fontFamily: SERIF, fontSize: 52, color: C.dim }}>Read less, explore more.</div>
      <div style={{ ...rise(f, 4 * FPS), fontFamily: SANS, fontSize: 44, marginTop: 50 }}>funwiki.vercel.app</div>
      <div style={{ ...rise(f, 4 * FPS + 8), fontFamily: SANS, fontSize: 26, color: C.dim, marginTop: 18 }}>
        Built with Meta’s Muse Spark and Wikipedia’s free APIs
      </div>
    </AbsoluteFill>
  );
}

function Scene({ id }: { id: SceneId }) {
  const clip = CLIPS[id];
  const cues = CUES[id];
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      {clip && <Footage clip={clip} />}
      {id === 'title' && <Title />}
      {id === 'how' && <How cues={cues} />}
      {id === 'close' && <Close />}
      {LABELS[id] && <Label text={LABELS[id]!} />}
      {id !== 'title' && id !== 'close' && <Subtitles cues={cues} />}
      <Narration cues={cues} />
    </AbsoluteFill>
  );
}

export const Demo = () => (
  <AbsoluteFill style={{ background: C.ground }}>
    <TransitionSeries>
      {ORDER.flatMap((id, i) => {
        const seq = (
          <TransitionSeries.Sequence key={id} durationInFrames={FRAMES[id]} premountFor={FPS}>
            <Scene id={id} />
          </TransitionSeries.Sequence>
        );
        return i === 0 ? [seq] : [
          <TransitionSeries.Transition key={id + '-t'} presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />,
          seq
        ];
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
