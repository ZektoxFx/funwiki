import React from 'react';

// Portal layout in the spirit of wikipedia.org: featured topics orbit the logo
// where Wikipedia lists its languages. `kind` is the small line under each title.
const FEATURED = [
  { title: 'Black hole', kind: 'Space' },
  { title: 'Albert Einstein', kind: 'Physics' },
  { title: 'Ancient Egypt', kind: 'History' },
  { title: 'Octopus', kind: 'Animals' },
  { title: 'Pizza', kind: 'Food' },
  { title: 'Artificial intelligence', kind: 'Technology' },
  { title: 'Leonardo da Vinci', kind: 'Art' },
  { title: 'Volcano', kind: 'Earth' },
  { title: 'Human brain', kind: 'Biology' },
  { title: 'Jazz', kind: 'Music' }
];

const SURPRISE = [
  'Mars', 'Coral reef', 'Roman Empire', 'Photosynthesis', 'Chess', 'Mount Everest', 'Honey bee',
  'Aurora', 'Samurai', 'Great Wall of China', 'Quantum computing', 'Dinosaur', 'Origami', 'Tsunami',
  'Bioluminescence', 'Silk Road', 'Penguin', 'Saturn', 'Vikings', 'DNA'
];

// Each feature opens a demo topic on the tab that shows it off.
const FEATURES = [
  { name: 'Living map', blurb: 'Topics as a moving mind map', topic: 'Black hole', tab: 'summary', icon: 'map' },
  { name: 'Ask Muse', blurb: 'Summaries in three depths', topic: 'Albert Einstein', tab: 'summary', icon: 'spark' },
  { name: 'Learning paths', blurb: 'Five steps, easiest first', topic: 'Volcano', tab: 'path', icon: 'path' },
  { name: 'Quizzes', blurb: 'Test yourself in three questions', topic: 'Octopus', tab: 'quiz', icon: 'quiz' },
  { name: 'Share links', blurb: 'Every topic has its own URL', topic: 'Pizza', tab: 'summary', icon: 'link' },
  { name: 'Keyboard friendly', blurb: 'Tab, Enter and E to explore', topic: 'Jazz', tab: 'summary', icon: 'keys' }
];

const ICONS = {
  map: <><circle cx="12" cy="12" r="3" /><circle cx="4" cy="5" r="2" /><circle cx="20" cy="6" r="2" /><circle cx="18" cy="19" r="2" /><path d="M10 10 5.5 6.3M14.6 10.8l3.6-3.3M13.9 14.3l2.8 3.3" /></>,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
  path: <><circle cx="5" cy="18" r="2" /><circle cx="19" cy="6" r="2" /><path d="M7 18h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6" /></>,
  quiz: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.5 2.5L16 9.5" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  keys: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></>
};

function Icon({ name }) {
  return (
    <svg className="feature-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

// Our stand-in for the globe: a glowing core with two counter-rotating constellations.
function Orb() {
  const ring = (n, r, phase = 0) => Array.from({ length: n }, (_, i) => {
    const a = phase + (i * 2 * Math.PI) / n;
    return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
  });
  const inner = ring(6, 58);
  const outer = ring(9, 88, 0.35);
  return (
    <svg className="orb" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id="home-core" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#c4b5ff" />
          <stop offset="60%" stopColor="#7c6cff" />
          <stop offset="100%" stopColor="#0866ff" />
        </radialGradient>
        <radialGradient id="home-halo">
          <stop offset="30%" stopColor="#7c6cff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#7c6cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#home-halo)" />
      <circle cx="100" cy="100" r="88" className="orb-track" />
      <g className="orbit">
        {outer.map(([x, y], i) => {
          const [nx, ny] = outer[(i + 1) % outer.length];
          return <line key={i} x1={x} y1={y} x2={nx} y2={ny} className="orb-edge" />;
        })}
        {outer.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 3 : 4.5} className="orb-node outer" />)}
      </g>
      <g className="orbit inner">
        {inner.map(([x, y], i) => <line key={i} x1="100" y1="100" x2={x} y2={y} className="orb-edge" />)}
        {inner.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" className="orb-node" />)}
      </g>
      <circle cx="100" cy="100" r="30" fill="url(#home-core)" />
    </svg>
  );
}

export default function Home({ onOpen, onSearch, muse, error }) {
  const [text, setText] = React.useState('');
  const item = (t, i) => (
    <li key={t.title} className="enter" style={{ '--i': i }}>
      <button className="portal-item" onClick={() => onOpen(t.title)}>
        <strong>{t.title}</strong>
        <span>{t.kind}</span>
      </button>
    </li>
  );

  return (
    <main className="home">
      <header className="home-head">
        <h1 className="wordmark">FunWiki</h1>
        <p className="tagline">The free encyclopedia, as a map</p>
      </header>

      <nav className="portal" aria-label="Featured topics">
        <ul className="portal-col left">{FEATURED.slice(0, 5).map(item)}</ul>
        <Orb />
        <ul className="portal-col right">{FEATURED.slice(5).map((t, i) => item(t, i + 5))}</ul>
      </nav>

      <form
        className="home-search"
        role="search"
        onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSearch(text.trim()); }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search any topic…" aria-label="Search Wikipedia" autoFocus />
        <button type="submit" className="primary" aria-label="Explore">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        </button>
      </form>
      {error && <div className="error enter home-error" role="alert">{error}</div>}

      <div className="surprise-row">
        <button className="surprise" onClick={() => onOpen(SURPRISE[Math.floor(Math.random() * SURPRISE.length)])}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
          Surprise me with a topic
        </button>
      </div>

      <footer className="home-foot">
        <div className="about">
          <p className="about-line">
            <span className="logo" aria-hidden="true" />
            <span>
              FunWiki turns Wikipedia's free articles into maps you can explore.
              Article text comes from <a href="https://www.wikipedia.org/" target="_blank" rel="noreferrer">Wikipedia</a>, shared under CC BY-SA.
            </span>
          </p>
          <div className="meta-card">
            <p className="meta-title">
              <span className={'dot' + (muse?.keyConfigured ? ' on' : '')} aria-hidden="true" />
              Powered by Meta {muse?.model || 'Muse Spark'}
            </p>
            <p>
              Summaries, learning paths and quizzes are written by Meta's Muse Spark, using only the article's own text.
              {muse && !muse.keyConfigured && ' It is offline right now, so you get Wikipedia fallbacks.'}
            </p>
          </div>
        </div>
        <ul className="features">
          {FEATURES.map((f) => (
            <li key={f.name}>
              <button className="feature" onClick={() => onOpen(f.topic, f.tab)}>
                <Icon name={f.icon} />
                <span>
                  <strong>{f.name}</strong>
                  <small>{f.blurb}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </footer>
    </main>
  );
}
