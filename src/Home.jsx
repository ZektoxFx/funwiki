import React from 'react';
import { fetchToday, fetchSummary, fetchLinks } from './wiki.js';
import './home.css';

const A = '/assets/';
const RANDOM = [
  'Octopus', 'Human brain', 'Jazz', 'Black hole', 'Albert Einstein', 'Mount Vesuvius', 'Encyclopédie',
  'Mars', 'Coral reef', 'Roman Empire', 'Photosynthesis', 'Chess', 'Mount Everest', 'Honey bee',
  'Aurora', 'Samurai', 'Great Wall of China', 'Quantum computing', 'Dinosaur', 'Origami'
];

// Credits for the downloaded pictures (scripts/assets.mjs --credits). The picture of the day is credited live.
const CREDITS = [
  ['An Eruption of Vesuvius', 'Johan Christian Dahl, 1824', 'The Met, CC0', 'https://www.metmuseum.org/art/collection/search/438159'],
  ['Einstein, 1921', 'Ferdinand Schmutzer', 'public domain', 'https://commons.wikimedia.org/wiki/File:Einstein_1921_by_F_Schmutzer_-_restoration.jpg'],
  ['Black hole, Messier 87', 'Event Horizon Telescope', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Black_hole_-_Messier_87_crop_max_res.jpg'],
  ['Encyclopédie, plate 1-133', 'Diderot et d’Alembert', 'public domain', 'https://commons.wikimedia.org/wiki/File:Encyclopedie_volume_1-133.png'],
  ['Black hole in NGC 300 X-1 (film, trimmed)', 'ESO/L. Calçada', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Artist%E2%80%99s_impression_of_the_black_hole_inside_NGC_300_X-1_(ESO_1004c).webm'],
  ['Octopus vulgaris', 'Comingio Merculiano, 1896', 'public domain', 'https://commons.wikimedia.org/wiki/File:Octopus_vulgaris_Merculiano.jpg'],
  ['Drawing of the brain', 'after Vesalius, Wellcome Collection', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Drawing_of_the_brain,_by_Vesalius._Wellcome_M0011753.jpg'],
  ['Louis Armstrong, 1953', 'World-Telegram staff photographer', 'public domain', 'https://commons.wikimedia.org/wiki/File:Louis_Armstrong_restored.jpg']
];

const iso = (d) => d.toISOString().slice(0, 10);
const label = (isoDay) => {
  const d = new Date(isoDay + 'T12:00:00Z');
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }),
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  };
};

// Adds .in to every .reveal block the first time it scrolls into view.
function useReveal() {
  React.useEffect(() => {
    const els = document.querySelectorAll('.home .reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -12% 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  });
}

// Rising triptych: the three pictures climb into place as the pinned stage scrolls by.
function useTriptych(ref) {
  React.useEffect(() => {
    const wrap = ref.current;
    if (!wrap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const [l, c, r] = wrap.querySelectorAll('.pic');
    let raf = 0;
    const ease = (t) => 1 - (1 - t) ** 3;
    const place = () => {
      raf = 0;
      const box = wrap.getBoundingClientRect();
      const H = window.innerHeight;
      const p = Math.min(Math.max(-box.top / Math.max(box.height - H, 1), 0), 1);
      const phone = window.innerWidth <= 760;
      const endY = H * (phone ? 0.12 : 0.08);
      const startY = H - c.offsetHeight * 0.25;
      const s0 = phone ? 0.85 : 620 / 760;
      c.style.transform = `translate(-50%, ${startY + (endY - startY) * ease(p)}px) scale(${s0 + (1 - s0) * ease(p)})`;
      const off = phone ? 0.75 * window.innerWidth - 40 : 570; // phone: outer pictures show as 40px slivers
      const q = ease(Math.min(p * 1.15, 1));
      const oy = H + 60 + (endY + (phone ? 40 : 55) - H - 60) * q;
      l.style.transform = `translate(calc(-50% - ${off}px), ${oy}px)`;
      r.style.transform = `translate(calc(-50% + ${off}px), ${oy + (1 - q) * 40}px)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(place); };
    place();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, [ref]);
}

// The footer wordmark: an SVG whose viewBox is fitted to the word, so it runs margin to margin on one line.
function Wordmark() {
  const ref = React.useRef(null);
  const [vb, setVb] = React.useState('0 0 1000 220');
  React.useEffect(() => {
    let live = true;
    (document.fonts?.ready || Promise.resolve()).then(() => {
      if (!live || !ref.current) return;
      const b = ref.current.getBBox();
      setVb(`${b.x} ${b.y + b.height * 0.12} ${b.width} ${b.height * 0.8}`);
    });
    return () => { live = false; };
  }, []);
  return (
    <svg className="mark" viewBox={vb} role="img" aria-label="FunWiki">
      <text ref={ref} x="0" y="200" fontSize="240">FunWiki</text>
    </svg>
  );
}

// The live thing: type a topic, its real map forms on the light half.
function TryIt({ onOpen }) {
  const [topic, setTopic] = React.useState('Octopus');
  const [state, setState] = React.useState({ loading: true });
  React.useEffect(() => {
    const t = topic.trim();
    if (!t) { setState({ empty: true }); return; }
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    const timer = setTimeout(async () => {
      try {
        const [sum, links] = await Promise.all([fetchSummary(t), fetchLinks(t, 12)]);
        if (live) setState({ title: sum.title, lead: (sum.extract || '').split(/(?<=\.)\s/)[0], links: links.links || [] });
      } catch {
        if (live) setState({ missing: t });
      }
    }, 450);
    return () => { live = false; clearTimeout(timer); };
  }, [topic]);

  const W = 500, H = 380, cx = 250, cy = 190;
  const n = state.links?.length || 0;
  const pts = (state.links || []).map((t, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(n, 1);
    const x = cx + 175 * Math.cos(a), y = cy + 140 * Math.sin(a);
    return { t: t.length > 22 ? t.slice(0, 21) + '…' : t, x, y, side: Math.cos(a) > 0.2 ? 1 : Math.cos(a) < -0.2 ? -1 : 0, below: Math.sin(a) > 0 };
  });

  return (
    <section id="try" className="try" aria-labelledby="try-h">
      <div className="try-in">
        <label htmlFor="try-topic">Topic</label>
        <input id="try-topic" className="topic" value={topic} onChange={(e) => setTopic(e.target.value)} autoComplete="off" spellCheck="false" />
        <p className="lead" aria-live="polite">{state.lead || (state.missing ? `Wikipedia has no article called “${state.missing}”.` : ' ')}</p>
        <h2 id="try-h" className="split">Type a topic</h2>
      </div>
      <div className="try-out">
        <div className={'fragment' + (state.loading ? ' loading' : '')} data-ui>
          {state.title ? (
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of ${state.title}: ${(state.links || []).join(', ')}`}>
              {pts.map((p) => <line key={'e' + p.t} x1={cx} y1={cy} x2={p.x} y2={p.y} className="f-edge" />)}
              {pts.map((p) => (
                <g key={p.t}>
                  <circle cx={p.x} cy={p.y} r="4.5" className="f-node" />
                  <text x={p.x + p.side * 9} y={p.side ? p.y + 4 : p.below ? p.y + 18 : p.y - 10} textAnchor={p.side > 0 ? 'start' : p.side < 0 ? 'end' : 'middle'}>{p.t}</text>
                </g>
              ))}
              <circle cx={cx} cy={cy} r="15" className="f-center" />
              <text x={cx} y={cy + 34} textAnchor="middle" className="f-title">{state.title}</text>
            </svg>
          ) : (
            <p className="f-empty">{state.missing ? 'Try another spelling.' : state.empty ? 'Type a topic on the left.' : 'Reading the article…'}</p>
          )}
          <div className="f-foot">
            <span>{n ? `${n} links from the opening paragraph` : 'Links appear here'}</span>
            {state.title && <button onClick={() => onOpen(state.title)}>Open the full map</button>}
          </div>
        </div>
        <p className="split" aria-hidden="true">see its map</p>
      </div>
    </section>
  );
}

export default function Home({ onOpen, onSearch, muse, error }) {
  const [text, setText] = React.useState('');
  const days = React.useMemo(() => [0, 1, 2, 3].map((k) => iso(new Date(Date.now() - k * 864e5))), []);
  const [day, setDay] = React.useState(days[0]);
  const [feeds, setFeeds] = React.useState({});
  const gallery = React.useRef(null);
  useReveal();
  useTriptych(gallery);

  React.useEffect(() => {
    if (feeds[day]) return;
    fetchToday(day)
      .then((f) => setFeeds((s) => ({ ...s, [day]: f })))
      .catch(() => setFeeds((s) => ({ ...s, [day]: { failed: true } })));
  }, [day, feeds]);

  const first = feeds[days[0]];
  const potd = first?.image;
  const feed = feeds[day];
  const random = () => onOpen(RANDOM[Math.floor(Math.random() * RANDOM.length)]);

  return (
    <div className="home">
      <main className="page">
        <header className="masthead">
          <div className="mosaic">
            <div className="cell-v"><img src={A + 'an-eruption-of-vesuvius.jpg'} width="1400" height="942" alt="An eruption of Mount Vesuvius, painted by J. C. Dahl in 1824" /></div>
            <div className="tile-r" />
            <div className="cell-e"><img src={A + 'einstein-1921-by-f-schmutzer-restoration.jpg'} width="1400" height="1838" alt="Albert Einstein in 1921" /></div>
            <div className="tile-p" />
            <div className="cell-m"><img src={A + 'black-hole-messier-87-crop-max-res.jpg'} width="1600" height="1600" alt="The first image of a black hole, in the galaxy Messier 87" /></div>
            <div className="tile-s" />
            <div className="cell-c"><img src={A + 'encyclopedie-volume-1-133.png'} width="1000" height="1354" alt="An anatomy plate from Diderot's Encyclopédie" /></div>
            <div className="cell-x">
              <video src={A + 'artist-s-impression-of-the-black-hole.webm'} poster={A + 'artist-s-impression-of-the-black-hole-poster.jpg'} muted loop autoPlay playsInline aria-label="Artist's impression of a black hole pulling gas from a star" />
            </div>
            <div className="cell-d">{potd?.thumbnail && <img src={potd.thumbnail} alt={`Wikipedia's picture of the day: ${potd.title}`} />}</div>
            <div className="tile-t" />
          </div>
          <nav className="bar" aria-label="Main">
            <div className="bar-left">
              <a className="wordmark" href="#/">FunWiki</a>
              <div className="sections">
                <a href="#today">Today</a>
                <a href="#try">Try it</a>
                <a href="#how">How it works</a>
              </div>
            </div>
            <button className="btn plain bar-action" onClick={() => onOpen(first?.featured || 'Encyclopédie')}>Today’s featured article</button>
          </nav>
        </header>

        <section className="lede" aria-labelledby="title">
          <div className="lede-side">
            <p className="standfirst">Type a topic and its article opens as a map you can walk, with Meta’s Muse Spark as your guide.</p>
            <form className="find" role="search" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSearch(text.trim()); }}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Octopus, Jazz, Mars…" aria-label="Search Wikipedia" />
              <button type="submit" className="btn">Map it</button>
            </form>
            {error && <p className="find-error" role="alert">{error}</p>}
          </div>
          <h1 id="title" className="title">
            <span className="line"><span>Wikipedia,</span></span>
            <span className="line"><span>as a map.</span></span>
          </h1>
        </section>

        <section id="today" className="block" aria-labelledby="today-h">
          <div className="today-head reveal">
            <h2 id="today-h"><span className="soft">Today’s most read,</span><span>each one a map.</span></h2>
            <button className="btn" onClick={random}>Random topic</button>
          </div>
          <div className="today-body">
            <div className="days" role="tablist" aria-label="Day">
              {days.map((d) => {
                const read = feeds[d]?.readOn || iso(new Date(new Date(d + 'T12:00:00Z').getTime() - 864e5));
                const l = label(read);
                return (
                  <button key={d} role="tab" aria-selected={day === d} className="day" onClick={() => setDay(d)}>
                    <strong>{l.weekday}</strong><small>{l.date}</small>
                  </button>
                );
              })}
            </div>
            <ol className="bands" role="tabpanel" aria-busy={!feed}>
              {!feed && <li className="note">Asking Wikipedia…</li>}
              {feed?.failed && <li className="note">Wikipedia’s daily list could not be reached. Try another day.</li>}
              {feed?.mostread?.map((a) => (
                <li key={a.title}>
                  <button className="band" onClick={() => onOpen(a.title)}>
                    <span className="views">{a.views.toLocaleString('en-GB')}<small>reads</small></span>
                    <span className="what"><strong>{a.title}</strong>{a.description && <small>{a.description}</small>}</span>
                    {a.thumbnail ? <img src={a.thumbnail} alt="" width="48" height="48" loading="lazy" /> : <span />}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <TryIt onOpen={onOpen} />

        <section id="how" className="block" aria-labelledby="how-h">
          <div className="how reveal">
            <div className="stage"><h2 id="how-h" className="line">First, pick any topic.</h2><p>Search for it, or start from what the world is reading today.</p></div>
            <div className="stage"><h3 className="line">Then its links become a map.</h3><p>The links in the article’s opening paragraph form the first ring, in reading order. Double-click any of them and that branch grows.</p></div>
            <div className="stage"><h3 className="line">Muse reads it with you.</h3><p>Meta’s Muse Spark writes a summary at three depths and a five-step path, easiest first, using only the article’s own text.</p></div>
            <div className="stage"><h3 className="line">Last, it tests you.</h3><p>Three questions from the article, each marked right or wrong as you answer.</p></div>
          </div>
        </section>

        <section className="gallery" aria-labelledby="gal-h">
          <div className="g-head reveal">
            <h2 id="gal-h">Start with a rabbit hole</h2>
            <p>An octopus, the human brain or Louis Armstrong’s jazz.</p>
          </div>
          <div className="stage-wrap" ref={gallery}>
          <div className="stage">
            <button className="pic l" onClick={() => onOpen('Human brain')}>
              <img src={A + 'drawing-of-the-brain-by-vesalius.jpg'} width="1400" height="1885" alt="A drawing of the human brain after Vesalius" loading="lazy" /><span>Human brain</span>
            </button>
            <button className="pic c" onClick={() => onOpen('Octopus')}>
              <img src={A + 'octopus-vulgaris-merculiano.jpg'} width="1400" height="1556" alt="A common octopus, drawn by Comingio Merculiano in 1896" loading="lazy" /><span>Octopus</span>
            </button>
            <button className="pic r" onClick={() => onOpen('Jazz')}>
              <img src={A + 'louis-armstrong-restored.jpg'} width="1400" height="1091" alt="Louis Armstrong playing the trumpet in 1953" loading="lazy" /><span>Jazz</span>
            </button>
          </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="cols">
          <div className="col">
            <strong>FunWiki</strong>
            <span>Wikipedia, as a map.</span>
            <span>Built for the Meta AI Developer Hackathon.</span>
          </div>
          <div className="col">
            <strong>Explore</strong>
            <a href="#today">Today</a>
            <a href="#try">Try it</a>
            <a href="#how">How it works</a>
            <button onClick={random}>Random topic</button>
          </div>
          <div className="col">
            <strong>Powered by</strong>
            <span>Meta {muse?.model || 'Muse Spark'}, {muse ? (muse.keyConfigured ? 'connected' : 'offline right now') : 'checking'}</span>
            <span>Wikipedia and Wikimedia Commons</span>
          </div>
          <div className="col credits">
            <strong>Pictures</strong>
            {CREDITS.map(([t, by, lic, href]) => (
              <span key={t}><a href={href} target="_blank" rel="noreferrer">{t}</a>, {by}, {lic}</span>
            ))}
            {potd && <span><a href={potd.page} target="_blank" rel="noreferrer">{potd.title}</a>{potd.artist ? `, ${potd.artist}` : ''}{potd.license ? `, ${potd.license}` : ''} (picture of the day)</span>}
          </div>
        </div>
        <div />
        <div>
          <Wordmark />
          <p className="legal">Article text from Wikipedia under CC BY-SA 4.0. FunWiki is not affiliated with the Wikimedia Foundation or Meta.</p>
        </div>
      </footer>
    </div>
  );
}
