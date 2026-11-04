import React from 'react';

const W = 800;
const H = 520;
const CX = 400;

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

export default function Graph({ nodes, edges, selected, onSelect, onExpand }) {
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const { view, handlers, zoom, reset } = usePanZoom(svgRef);
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  // Lighting every edge of the centre node adds no information, so skip it.
  const focus = hover || (byId.get(selected)?.kind === 'center' ? null : selected);

  return (
    <div className="graph-wrap">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="graph"
        role="group"
        aria-label="Knowledge map. Tab to a topic, Enter to read it, E to expand it."
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
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) return null;
          const lit = focus && (e.from === focus || e.to === focus);
          return <line key={e.from + '\u0000' + e.to} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={lit ? 'edge lit' : 'edge'} />;
        })}
        {nodes.map((n) => {
          const center = n.kind === 'center';
          const r = center ? 24 : 9;
          // Labels point away from the node's parent (map centre for the first ring).
          const ax = n.px ?? CX;
          const side = center ? 0 : n.x > ax + 15 ? 1 : n.x < ax - 15 ? -1 : 0;
          const label = n.id.length > 24 ? n.id.slice(0, 23) + '…' : n.id;
          const cls = 'node' + (center ? ' center' : '') + (selected === n.id ? ' selected' : '') + (hover === n.id ? ' hover' : '');
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              className={cls}
              tabIndex={0}
              role="button"
              aria-label={`${n.id}${center ? ' (current topic)' : ''}`}
              onClick={() => onSelect(n.id)}
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
              {selected === n.id && <circle r={r + 8} className="ring" />}
              <circle r={r} filter={center || selected === n.id ? 'url(#glow)' : undefined} />
              <text
                x={side * (r + 6)}
                y={side ? 4 : r + 16}
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
      </div>
    </div>
  );
}
