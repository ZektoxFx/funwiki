import React from 'react';

export default function Graph({ nodes, edges, selected, onSelect, onExpand }) {
  return (
    <svg viewBox="0 0 800 520" className="graph" role="img" aria-label="Knowledge map">
      {edges.map((e, i) => {
        const a = nodes.find((n) => n.id === e.from);
        const b = nodes.find((n) => n.id === e.to);
        if (!a || !b) return null;
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="edge" />;
      })}
      {nodes.map((n) => (
        <g
          key={n.id}
          transform={`translate(${n.x},${n.y})`}
          onClick={() => onSelect(n.id)}
          onDoubleClick={() => onExpand && onExpand(n.id)}
          className={n.kind === 'center' ? 'node center' : 'node' + (selected === n.id ? ' selected' : '')}
          style={{ cursor: 'pointer' }}
        >
          <circle r={n.kind === 'center' ? 26 : 16} />
          <text y={n.kind === 'center' ? 44 : 32}>{n.id.length > 22 ? n.id.slice(0, 21) + '…' : n.id}</text>
        </g>
      ))}
    </svg>
  );
}
