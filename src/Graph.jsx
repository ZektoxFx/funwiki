import React from 'react';

const W = 800;
const H = 520;
const CENTER = { x: 400, y: 260 };
const ALPHA_MIN = 0.06; // never fully cools: the layout keeps holding its shape while it drifts

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Pan (drag background) + zoom (wheel) by moving the SVG viewBox.
function usePanZoom(svgRef) {
  const [view, setView] = React.useState({ x: 0, y: 0, w: W, h: H });
  const drag = React.useRef(null);

  const unitsPerPx = (v) => {
    const r = svgRef.current.getBoundingClientRect();
    return Math.max(v.w / r.width, v.h / r.height);
  };

  React.useEffect(() => {
    const svg = svgRef.current;
    function onWheel(e) {
      e.preventDefault();
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
    return () => svg.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line
  }, []);

  const handlers = {
    onPointerDown(e) {
      if (e.target.closest('.node')) return;
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

  const zoom = (k) => setView((v) => ({ x: v.x + (v.w * (1 - k)) / 2, y: v.y + (v.h * (1 - k)) / 2, w: v.w * k, h: v.h * k }));
  const reset = () => setView({ x: 0, y: 0, w: W, h: H });
  return { view, handlers, zoom, reset };
}

// Live force layout: nodes repel, edges act as springs, everything is pulled
// gently to the middle, and a slow per-node drift keeps the map alive.
// shortcut: O(n²) repulsion, fine for the ~150 nodes a session reaches; switch to d3-force (Barnes–Hut) if maps get much bigger.
function useForceLayout(nodes, edges, parentOf) {
  const sim = React.useRef(new Map());
  const alpha = React.useRef(1);
  const [, setFrame] = React.useState(0);
  const loop = React.useRef(null);

  const kick = React.useCallback((a = 1) => {
    alpha.current = Math.max(alpha.current, a);
    if (!loop.current) loop.current = requestAnimationFrame(loop.step);
  }, []);

  // Add new nodes at their parent's position so expanded branches burst out of it.
  const m = sim.current;
  for (const n of nodes) {
    if (m.has(n.id)) continue;
    const p = m.get(parentOf.get(n.id));
    m.set(n.id, {
      x: p ? p.x + (Math.random() - 0.5) * 30 : n.x,
      y: p ? p.y + (Math.random() - 0.5) * 30 : n.y,
      vx: 0, vy: 0,
      fixed: n.kind === 'center',
      seed: Math.random() * 1000
    });
  }

  React.useEffect(() => {
    const drift = !reducedMotion();
    loop.step = (now) => {
      const a = alpha.current;
      const list = nodes.map((n) => [n, m.get(n.id)]).filter(([, s]) => s);

      for (let i = 0; i < list.length; i++) {
        const A = list[i][1];
        for (let j = i + 1; j < list.length; j++) {
          const B = list[j][1];
          let dx = A.x - B.x, dy = A.y - B.y;
          const d2 = Math.max(dx * dx + dy * dy, 64);
          const d = Math.sqrt(d2);
          const f = (4200 * a) / d2;
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
        const f = ((d - len) / d) * 0.05 * a;
        A.vx += dx * f; A.vy += dy * f;
        B.vx -= dx * f; B.vy -= dy * f;
      }
      for (const [, s] of list) {
        if (s.fixed) { s.vx = s.vy = 0; continue; }
        s.vx += (CENTER.x - s.x) * 0.003 * a;
        s.vy += (CENTER.y - s.y) * 0.003 * a;
        if (drift) {
          s.vx += Math.sin(now / 1400 + s.seed) * 0.018;
          s.vy += Math.cos(now / 1900 + s.seed * 1.7) * 0.018;
        }
        s.vx *= 0.82; s.vy *= 0.82;
        s.x += s.vx; s.y += s.vy;
      }

      alpha.current = Math.max(a * 0.985, ALPHA_MIN);
      setFrame((f) => f + 1);
      // With reduced motion, stop once the layout has settled.
      loop.current = drift || alpha.current > ALPHA_MIN ? requestAnimationFrame(loop.step) : null;
    };
    kick(1);
    return () => { cancelAnimationFrame(loop.current); loop.current = null; };
    // eslint-disable-next-line
  }, [nodes, edges]);

  return { pos: m, kick };
}

export default function Graph({ nodes, edges, selected, onSelect, onExpand }) {
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
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

  const { pos, kick } = useForceLayout(nodes, edges, parentOf);

  // Node dragging: pin while held, release back into the simulation on drop.
  const drag = React.useRef(null);
  const toSvg = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const nodeDrag = (id) => ({
    onPointerDown(e) {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id, x0: e.clientX, y0: e.clientY, moved: false };
    },
    onPointerMove(e) {
      const d = drag.current;
      if (!d || d.id !== id) return;
      if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
      d.moved = true;
      const s = pos.get(id);
      const p = toSvg(e);
      Object.assign(s, { x: p.x, y: p.y, vx: 0, vy: 0, held: true, fixed: true });
      kick(0.4);
    },
    onPointerUp() {
      const d = drag.current;
      if (d?.moved) {
        const s = pos.get(id);
        s.held = false;
        s.fixed = nodes.find((n) => n.id === id)?.kind === 'center';
        kick(0.3);
        // The click that follows this release must be ignored; clear right after it.
        setTimeout(() => { drag.current = null; }, 0);
      } else {
        drag.current = null;
      }
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
        <defs>
          <radialGradient id="g-center" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#c4b5ff" />
            <stop offset="100%" stopColor="#5b5bf6" />
          </radialGradient>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {edges.map((e) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const lit = focus && (e.from === focus || e.to === focus);
          return <line key={e.from + '\u0000' + e.to} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={'edge d' + Math.min(depth(e.to), 3) + (lit ? ' lit' : '')} />;
        })}
        {nodes.map((n) => {
          const s = pos.get(n.id);
          if (!s) return null;
          const center = n.kind === 'center';
          const dep = Math.min(depth(n.id), 3);
          const r = center ? 24 : 6 + Math.min(degree.get(n.id) || 1, 9) * 0.9;
          // Labels point away from the node's parent.
          const parent = pos.get(parentOf.get(n.id)) || CENTER;
          const side = center ? 0 : s.x > parent.x + 12 ? 1 : s.x < parent.x - 12 ? -1 : 0;
          const label = n.id.length > 24 ? n.id.slice(0, 23) + '…' : n.id;
          const near = hover === n.id || selected === n.id || neighbours.has(n.id);
          const cls = 'node d' + dep + (center ? ' center' : '') + (selected === n.id ? ' selected' : '')
            + (hover === n.id ? ' hover' : '') + (near ? ' near' : '') + (s.held ? ' held' : '');
          return (
            <g
              key={n.id}
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
              onPointerEnter={() => setHover(n.id)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(n.id)}
              onBlur={() => setHover(null)}
            >
              <circle r={r + 10} className="hit" />
              {selected === n.id && <circle r={r + 8} className="ring" />}
              <circle r={r} filter={center || selected === n.id ? 'url(#glow)' : undefined} />
              <text
                x={side * (r + 6)}
                y={side ? 4 : r + 15}
                textAnchor={side > 0 ? 'start' : side < 0 ? 'end' : 'middle'}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="map-tools" aria-label="Map controls">
        <button className="icon" onClick={() => zoom(1 / 1.25)} aria-label="Zoom in">+</button>
        <button className="icon" onClick={() => zoom(1.25)} aria-label="Zoom out">−</button>
        <button className="icon" onClick={reset} aria-label="Reset view">⟲</button>
        <button
          className="icon"
          aria-label="Shake layout"
          title="Shake layout"
          onClick={() => {
            for (const s of pos.values()) if (!s.fixed) { s.vx += (Math.random() - 0.5) * 24; s.vy += (Math.random() - 0.5) * 24; }
            kick(1);
          }}
        >✺</button>
      </div>
    </div>
  );
}
