import React from 'react';

const W = 800;
const H = 520;
const CENTER = { x: 400, y: 260 };
const ALPHA_MIN = 0.06; // never fully cools: the layout keeps holding its shape while it drifts
const FRAME = 1000 / 60; // physics constants are tuned per 60 Hz frame; k scales them to real time

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// easeOutQuint ≈ cubic-bezier(0.22, 1, 0.36, 1), the strong UI ease-out used across the app.
const easeOut = (t) => 1 - (1 - t) ** 5;

// Pan (drag background) + zoom (wheel) by moving the SVG viewBox. Buttons glide; wheel/drag stay direct.
function usePanZoom(svgRef) {
  const HOME = { x: 0, y: 0, w: W, h: H };
  const [view, setView] = React.useState(HOME);
  const viewRef = React.useRef(view);
  viewRef.current = view;
  const drag = React.useRef(null);
  const tween = React.useRef({ raf: null, to: null });

  const stopGlide = () => { cancelAnimationFrame(tween.current.raf); tween.current = { raf: null, to: null }; };
  const glide = (to) => {
    stopGlide();
    if (reducedMotion()) return setView(to);
    const from = viewRef.current;
    const t0 = performance.now();
    const step = (now) => {
      const e = easeOut(Math.min((now - t0) / 220, 1));
      setView({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e });
      tween.current.raf = e < 1 ? requestAnimationFrame(step) : null;
    };
    tween.current = { raf: requestAnimationFrame(step), to };
  };

  const unitsPerPx = (v) => {
    const r = svgRef.current.getBoundingClientRect();
    return Math.max(v.w / r.width, v.h / r.height);
  };

  React.useEffect(() => {
    const svg = svgRef.current;
    function onWheel(e) {
      e.preventDefault();
      stopGlide();
      const r = svg.getBoundingClientRect();
      setView((v) => {
        const k = Math.min(Math.max(e.deltaY > 0 ? 1.12 : 1 / 1.12, 0.25 / (v.w / W)), 3 / (v.w / W));
        const s = unitsPerPx(v);
        const px = v.x + (e.clientX - r.left - (r.width - v.w / s) / 2) * s;
        const py = v.y + (e.clientY - r.top - (r.height - v.h / s) / 2) * s;
        return { x: px - (px - v.x) * k, y: py - (py - v.y) * k, w: v.w * k, h: v.h * k };
      });
    }
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => { svg.removeEventListener('wheel', onWheel); stopGlide(); };
    // eslint-disable-next-line
  }, []);

  const handlers = {
    onPointerDown(e) {
      if (e.target.closest('.node')) return;
      stopGlide();
      drag.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove(e) {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      drag.current = { x: e.clientX, y: e.clientY };
      setView((v) => {
        const s = unitsPerPx(v);
        return { ...v, x: v.x - dx * s, y: v.y - dy * s };
      });
    },
    onPointerUp() { drag.current = null; }
  };

  // Repeated clicks build on the glide's target, not on a half-finished frame.
  const zoom = (k) => {
    const v = tween.current.to || viewRef.current;
    glide({ x: v.x + (v.w * (1 - k)) / 2, y: v.y + (v.h * (1 - k)) / 2, w: v.w * k, h: v.h * k });
  };
  const reset = () => glide(HOME);
  return { view, handlers, zoom, reset };
}

// Live force layout: nodes repel, edges act as springs, everything is pulled
// gently to the middle, and a slow per-node drift keeps the map alive.
// Positions are written straight to the DOM each frame; React only renders on structural changes.
// shortcut: O(n²) repulsion, fine for the ~150 nodes a session reaches; switch to d3-force (Barnes–Hut) if maps get much bigger.
function useForceLayout(nodes, edges, parentOf, calmTarget) {
  const sim = React.useRef(new Map());
  const els = React.useRef({ nodes: new Map(), edges: new Map() });
  const alpha = React.useRef(1);
  const loop = React.useRef({ raf: null, last: 0, calm: 1 });
  const parentRef = React.useRef(parentOf);
  parentRef.current = parentOf;
  const reduce = React.useMemo(reducedMotion, []);

  // New nodes start at their parent so expanded branches burst out of it; each gets a stagger slot.
  const m = sim.current;
  let born = 0;
  for (const n of nodes) {
    if (m.has(n.id)) continue;
    const p = m.get(parentOf.get(n.id));
    m.set(n.id, {
      x: p ? p.x + (Math.random() - 0.5) * 30 : n.x,
      y: p ? p.y + (Math.random() - 0.5) * 30 : n.y,
      vx: 0, vy: 0,
      fixed: n.kind === 'center',
      seed: Math.random() * 1000,
      delay: Math.min(born++ * 30, 360)
    });
  }

  const tick = (k, now, drift) => {
    const a = alpha.current;
    const list = [];
    for (const n of nodes) { const s = m.get(n.id); if (s) list.push(s); }

    for (let i = 0; i < list.length; i++) {
      const A = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const B = list[j];
        let dx = A.x - B.x, dy = A.y - B.y;
        const d2 = Math.max(dx * dx + dy * dy, 64);
        const d = Math.sqrt(d2);
        const f = (4200 * a * k) / d2;
        dx /= d; dy /= d;
        A.vx += dx * f; A.vy += dy * f;
        B.vx -= dx * f; B.vy -= dy * f;
      }
    }
    for (const e of edges) {
      const A = m.get(e.from), B = m.get(e.to);
      if (!A || !B) continue;
      const dx = B.x - A.x, dy = B.y - A.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const len = A.fixed || B.fixed ? 185 : 95;
      const f = ((d - len) / d) * 0.05 * a * k;
      A.vx += dx * f; A.vy += dy * f;
      B.vx -= dx * f; B.vy -= dy * f;
    }
    const damp = 0.82 ** k;
    for (const s of list) {
      if (s.fixed) { s.vx = s.vy = 0; continue; }
      s.vx += (CENTER.x - s.x) * 0.003 * a * k;
      s.vy += (CENTER.y - s.y) * 0.003 * a * k;
      if (drift) {
        s.vx += Math.sin(now / 1400 + s.seed) * 0.018 * drift * k;
        s.vy += Math.cos(now / 1900 + s.seed * 1.7) * 0.018 * drift * k;
      }
      s.vx *= damp; s.vy *= damp;
      // Speed cap: a slow first frame (k up to 3) on stacked new nodes used to fling them off-screen.
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 24) { s.vx *= 24 / sp; s.vy *= 24 / sp; }
      s.x += s.vx * k; s.y += s.vy * k;
    }
    alpha.current = Math.max(a * 0.97 ** k, ALPHA_MIN);
  };

  const paint = () => {
    for (const [id, el] of els.current.nodes) {
      const s = m.get(id);
      if (!s) continue;
      el.g.setAttribute('transform', `translate(${s.x},${s.y})`);
      // Labels point away from the node's parent; only touch the text when its side flips.
      if (s.fixed && !s.held) continue;
      const p = m.get(parentRef.current.get(id)) || CENTER;
      const side = s.x > p.x + 12 ? 1 : s.x < p.x - 12 ? -1 : 0;
      if (side !== s.side && el.text) {
        s.side = side;
        el.text.setAttribute('x', side * (s.r + 6));
        el.text.setAttribute('y', side ? 4 : s.r + 15);
        el.text.setAttribute('text-anchor', side > 0 ? 'start' : side < 0 ? 'end' : 'middle');
      }
    }
    for (const { el, from, to } of els.current.edges.values()) {
      const a = m.get(from), b = m.get(to);
      if (!a || !b) continue;
      el.setAttribute('x1', a.x); el.setAttribute('y1', a.y);
      el.setAttribute('x2', b.x); el.setAttribute('y2', b.y);
    }
  };

  // Reduced motion: no visible simulation. Solve the layout instantly and show the result.
  const settle = () => {
    for (let i = 0; i < 300; i++) tick(1, 0, 0);
    paint();
  };

  const kick = (a = 1) => {
    alpha.current = Math.max(alpha.current, a);
    if (reduce) settle();
  };

  // Layout effect so reduced motion paints the solved layout in the very first frame.
  React.useLayoutEffect(() => {
    if (reduce) { alpha.current = 1; settle(); return; }
    const L = loop.current;
    L.last = 0;
    const run = (now) => {
      // Clamp so a background tab coming back doesn't fling everything in one step.
      const k = L.last ? Math.min((now - L.last) / FRAME, 3) : 1;
      L.last = now;
      // Ease the drift down while the user is reading a node, back up when they leave (~400ms).
      L.calm += (calmTarget.current - L.calm) * (1 - Math.exp(-k / 9));
      tick(k, now, L.calm);
      paint();
      L.raf = requestAnimationFrame(run);
    };
    alpha.current = 1;
    L.raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(L.raf);
    // eslint-disable-next-line
  }, [nodes, edges]);

  const refNode = (id) => (g) => {
    if (g) els.current.nodes.set(id, { g, text: g.querySelector('text') });
    else els.current.nodes.delete(id);
  };
  const refEdge = (e) => (el) => {
    const key = e.from + '\u0000' + e.to;
    if (el) els.current.edges.set(key, { el, from: e.from, to: e.to });
    else els.current.edges.delete(key);
  };

  return { pos: m, kick, paint, reduce, refNode, refEdge, els };
}

export default function Graph({ nodes, edges, selected, onSelect, onExpand, path }) {
  const onPath = path || new Set(); // titles on Muse's learning path, drawn as the crimson trail
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const calm = React.useRef(1);
  calm.current = hover ? 0 : 1;
  const { view, handlers, zoom, reset } = usePanZoom(svgRef);

  const { parentOf, degree, depth } = React.useMemo(() => {
    const parentOf = new Map();
    const degree = new Map();
    for (const e of edges) {
      if (!parentOf.has(e.to)) parentOf.set(e.to, e.from);
      degree.set(e.from, (degree.get(e.from) || 0) + 1);
      degree.set(e.to, (degree.get(e.to) || 0) + 1);
    }
    const depth = (id, seen = 0) => (parentOf.has(id) && seen < 20 ? 1 + depth(parentOf.get(id), seen + 1) : 0);
    return { parentOf, degree, depth };
  }, [edges]);

  const { pos, kick, paint, reduce, refNode, refEdge, els } = useForceLayout(nodes, edges, parentOf, calm);

  // Node dragging: pin while held, release back into the simulation with the pointer's momentum.
  const drag = React.useRef(null);
  const toSvg = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const setHeld = (id, on) => els.current.nodes.get(id)?.g.classList.toggle('held', on);
  const nodeDrag = (id) => ({
    onPointerDown(e) {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id, x0: e.clientX, y0: e.clientY, moved: false, trail: [] };
    },
    onPointerMove(e) {
      const d = drag.current;
      if (!d || d.id !== id) return;
      if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
      if (!d.moved) setHeld(id, true);
      d.moved = true;
      const s = pos.get(id);
      const p = toSvg(e);
      d.trail.push({ t: performance.now(), x: p.x, y: p.y });
      if (d.trail.length > 6) d.trail.shift();
      Object.assign(s, { x: p.x, y: p.y, vx: 0, vy: 0, held: true, fixed: true });
      if (reduce) paint(); else kick(0.4);
    },
    onPointerUp() {
      const d = drag.current;
      if (!d?.moved) { drag.current = null; return; }
      const s = pos.get(id);
      s.held = false;
      s.fixed = nodes.find((n) => n.id === id)?.kind === 'center';
      setHeld(id, false);
      // Carry the last ~50ms of pointer velocity into the node so a flick throws it.
      const last = d.trail[d.trail.length - 1];
      const first = d.trail.find((p) => last.t - p.t <= 50) || last;
      const dt = last.t - first.t;
      if (!s.fixed && dt > 0 && !reduce) {
        const cap = 40;
        s.vx = Math.max(-cap, Math.min(cap, ((last.x - first.x) / dt) * FRAME * 0.6));
        s.vy = Math.max(-cap, Math.min(cap, ((last.y - first.y) / dt) * FRAME * 0.6));
      }
      kick(0.3);
      // The click that follows this release must be ignored; clear right after it.
      setTimeout(() => { drag.current = null; }, 0);
    }
  });

  const neighbours = React.useMemo(() => {
    const focus = hover || selected;
    const set = new Set();
    for (const e of edges) {
      if (e.from === focus) set.add(e.to);
      if (e.to === focus) set.add(e.from);
    }
    return set;
  }, [edges, hover, selected]);

  // Lighting every edge of the centre node adds no information, so skip it.
  const focus = hover || (nodes.find((n) => n.id === selected)?.kind === 'center' ? null : selected);

  return (
    <div className="graph-wrap">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="graph"
        role="group"
        aria-label="Knowledge map. Tab to a topic, Enter to read it, E to expand it. Drag topics to rearrange."
        {...handlers}
      >
        {edges.map((e) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const lit = focus && (e.from === focus || e.to === focus);
          const trail = onPath.has(e.to) && (onPath.has(e.from) || nodes.find((n) => n.id === e.from)?.kind === 'center');
          return <line key={e.from + '\u0000' + e.to} ref={refEdge(e)} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={'edge d' + Math.min(depth(e.to), 3) + (lit ? ' lit' : '') + (trail ? ' trail' : '')} />;
        })}
        {nodes.map((n) => {
          const s = pos.get(n.id);
          if (!s) return null;
          const center = n.kind === 'center';
          const dep = Math.min(depth(n.id), 3);
          const r = center ? 24 : 6 + Math.min(degree.get(n.id) || 1, 9) * 0.9;
          s.r = r;
          const parent = pos.get(parentOf.get(n.id)) || CENTER;
          const side = center ? 0 : s.x > parent.x + 12 ? 1 : s.x < parent.x - 12 ? -1 : 0;
          s.side = side;
          const label = n.id.length > 24 ? n.id.slice(0, 23) + '…' : n.id;
          const near = hover === n.id || selected === n.id || neighbours.has(n.id);
          const cls = 'node d' + dep + (center ? ' center' : '') + (selected === n.id ? ' selected' : '')
            + (hover === n.id ? ' hover' : '') + (near ? ' near' : '') + (s.held ? ' held' : '') + (onPath.has(n.id) ? ' on-path' : '');
          return (
            <g
              key={n.id}
              ref={refNode(n.id)}
              transform={`translate(${s.x},${s.y})`}
              className={cls}
              tabIndex={0}
              role="button"
              aria-label={`${n.id}${center ? ' (current topic)' : ''}`}
              {...nodeDrag(n.id)}
              onClick={() => { if (!drag.current?.moved) onSelect(n.id); }}
              onDoubleClick={() => onExpand?.(n.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.id); }
                if (e.key === 'e' || e.key === 'E') onExpand?.(n.id);
              }}
              // Touch taps fire pointerenter too; only a real mouse hover should light links.
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(n.id); }}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(n.id)}
              onBlur={() => setHover(null)}
            >
              <g className="node-body" style={{ animationDelay: `${s.delay}ms` }}>
                <circle r={r + 10} className="hit" />
                {selected === n.id && <circle r={r + 8} className="ring" />}
                <circle r={r} />
                <text
                  x={side * (r + 6)}
                  y={side ? 4 : r + 15}
                  textAnchor={side > 0 ? 'start' : side < 0 ? 'end' : 'middle'}
                >
                  {label}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      <div className="map-tools" aria-label="Map controls">
        <button className="icon" onClick={() => zoom(1 / 1.25)} aria-label="Zoom in" title="Zoom in">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
        </button>
        <button className="icon" onClick={() => zoom(1.25)} aria-label="Zoom out" title="Zoom out">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8h10" /></svg>
        </button>
        <button className="icon" onClick={reset} aria-label="Reset view" title="Reset view">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a5 5 0 1 0 1.5-3.5M3 2.5V5h2.5" /></svg>
        </button>
        <button
          className="icon"
          aria-label="Shake layout"
          title="Shake layout"
          onClick={() => {
            if (!reduce) for (const s of pos.values()) if (!s.fixed) { s.vx += (Math.random() - 0.5) * 24; s.vy += (Math.random() - 0.5) * 24; }
            kick(1);
          }}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="1.5" /><circle cx="3" cy="4" r="1" /><circle cx="13" cy="5" r="1" /><circle cx="4" cy="12.5" r="1" /><circle cx="12.5" cy="12" r="1" /></svg>
        </button>
      </div>
    </div>
  );
}
