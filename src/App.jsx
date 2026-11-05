import React from 'react';
import Graph from './Graph.jsx';
import Home from './Home.jsx';
import { searchWiki, fetchSummary, fetchLinks, aiSummarize, aiPath, aiQuiz, topicFromUrl, topicToUrl, useWikiGraph } from './wiki.js';

const LEVELS = [
  { id: 'eli5', label: 'Simple' },
  { id: 'bullets', label: '5 bullets' },
  { id: 'deep', label: 'Deep dive' }
];

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'path', label: 'Learning path' },
  { id: 'quiz', label: 'Quiz' }
];

function Source({ r }) {
  if (!r) return null;
  const meta = r.source?.startsWith('meta:');
  return (
    <p className={'source' + (meta ? ' meta' : '')}>
      {meta ? `Written by Meta ${r.source.slice(5)}` : 'From the Wikipedia text (Muse unavailable)'}
      {r.cached ? ' · cached' : ''}
      {r.note ? ` · ${r.note}` : ''}
    </p>
  );
}

export default function App() {
  const [q, setQ] = React.useState('Black Holes');
  const [results, setResults] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [panel, setPanel] = React.useState(null);
  const [tab, setTab] = React.useState('summary');
  const [level, setLevel] = React.useState('eli5');
  const [ai, setAi] = React.useState(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [path, setPath] = React.useState(null);
  const [pathLoading, setPathLoading] = React.useState(false);
  const [quiz, setQuiz] = React.useState(null);
  const [quizLoading, setQuizLoading] = React.useState(false);
  const [answers, setAnswers] = React.useState({});
  const [error, setError] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const [muse, setMuse] = React.useState(null);
  const [home, setHome] = React.useState(() => !topicFromUrl()); // no topic in the URL = front page
  const [trail, setTrail] = React.useState([]); // topics opened this session, newest first
  const [menu, setMenu] = React.useState(false); // phone: the sidebar as a sheet
  const visit = (t) => setTrail((v) => [t, ...v.filter((x) => x !== t)].slice(0, 8));
  const { nodes, edges, loading, explore, expand } = useWikiGraph();
  const linkTitles = React.useMemo(() => nodes.filter((n) => n.kind === 'link').map((n) => n.id), [nodes]);
  const centerId = nodes.find((n) => n.kind === 'center')?.id;
  const pathSet = React.useMemo(() => new Set(path?.steps?.map((st) => st.title) || []), [path]);
  const shown = React.useRef(null); // topic we put in the URL, so our own hash writes are ignored

  async function doSearch(e, text = q) {
    e?.preventDefault();
    if (!text.trim()) return;
    setError(null);
    try {
      const r = await searchWiki(text.trim());
      setResults(r);
      if (r[0]) openArticle(r[0].title);
      else setError(`No Wikipedia articles found for “${text.trim()}”. Try another spelling.`);
    } catch {
      setError('Search failed. Is the API running? Start it with npm run dev.');
    }
  }

  async function openArticle(title, startTab) {
    setError(null);
    setHome(false);
    if (startTab) setTab(startTab);
    setSelected(title);
    shown.current = title;
    topicToUrl(title);
    resetAi();
    visit(title);
    setMenu(false);
    try {
      const summary = await explore(title);
      setPanel(summary);
    } catch {
      setError(`Could not load “${title}”. Check your connection and the API.`);
    }
  }

  function resetAi() {
    setAi(null);
    setPath(null);
    setQuiz(null);
    setAnswers({});
  }

  async function onNodeClick(title) {
    setError(null);
    setSelected(title);
    shown.current = title;
    topicToUrl(title);
    resetAi();
    try {
      const s = await fetchSummary(title);
      setPanel(s);
    } catch {
      await expand(title);
    }
  }

  async function runAi() {
    if (!panel) return;
    setAiLoading(true);
    try {
      setAi(await aiSummarize(panel.title, panel.extract || '', level));
    } catch {
      setError('The summary failed. Check the API and try again.');
    } finally {
      setAiLoading(false);
    }
  }

  async function runPath() {
    if (!panel) return;
    setPathLoading(true);
    try {
      const links = linkTitles.length ? linkTitles : (await fetchLinks(panel.title)).links;
      setPath(await aiPath(panel.title, links));
    } catch {
      setError('The learning path failed. Check the API and try again.');
    } finally {
      setPathLoading(false);
    }
  }

  async function runQuiz() {
    if (!panel) return;
    setQuizLoading(true);
    try {
      setQuiz(await aiQuiz(panel.title, panel.extract || ''));
      setAnswers({});
    } catch {
      setError('The quiz failed: Muse Spark gave an unusable reply. Try again.');
    } finally {
      setQuizLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
      () => setError('Could not copy the link.')
    );
  }

  const score = quiz?.questions?.length
    ? quiz.questions.filter((qq, i) => answers[i] === qq.answer).length
    : 0;
  const answered = Object.keys(answers).length;

  React.useEffect(() => {
    const start = topicFromUrl();
    if (start) {
      setQ(start);
      openArticle(start);
      searchWiki(start).then(setResults).catch(() => {});
    }
    fetch('/api/health').then((r) => r.json()).then((h) => setMuse(h.meta)).catch(() => {});
    // Browser back/forward: reopen whatever topic the URL now names.
    const onHash = () => {
      const t = topicFromUrl();
      if (!t) { shown.current = null; setError(null); setHome(true); return; }
      if (t !== shown.current) { setQ(t); openArticle(t); }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line
  }, []);

  if (home) {
    return (
      <Home
        muse={muse}
        error={error}
        // Opening from the front page starts on Summary unless a feature tile asks for its own tab.
        onSearch={(text) => { setQ(text); setTab('summary'); doSearch(null, text); }}
        onOpen={(title, startTab = 'summary') => {
          setQ(title);
          openArticle(title, startTab);
          searchWiki(title).then(setResults).catch(() => {});
        }}
      />
    );
  }

  const isCenter = panel && panel.title === centerId;
  const short = (t) => (t.length > 22 ? t.slice(0, 21) + '…' : t);
  const subline = panel && [panel.description, isCenter ? `${linkTitles.length} links in its opening paragraph` : centerId && `linked from ${centerId}`].filter(Boolean).join(' · ');

  return (
    <div className="shell">
      <header className="top">
        <div className="brand-cell">
          <a className="brand" href="#/" aria-label="FunWiki front page">
            {/* The mark: one article node with two links, in the page's crimson. */}
            <svg className="mark-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d="M12 12 4.5 6.5M12 12l7 5" stroke="#efefef" strokeWidth="1.5" />
              <circle cx="4.5" cy="6.5" r="2.5" fill="#efefef" /><circle cx="19" cy="17" r="2.5" fill="#efefef" />
              <circle cx="12" cy="12" r="5" fill="#b11226" />
            </svg>
            FunWiki
          </a>
        </div>
        <form onSubmit={doSearch} className="search" role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Wikipedia" aria-label="Search Wikipedia" />
          <button type="submit" className="btn-quiet">Map it</button>
        </form>
        <div className="status-cell" title={muse ? `${muse.model} via ${muse.base}` : undefined}>
          <span>Muse Spark</span>
          <span className={'pill ' + (muse?.keyConfigured ? 'pos' : 'off')}>{muse ? (muse.keyConfigured ? 'Connected' : 'Offline') : 'Checking'}</span>
        </div>
        <button className="menu-btn" aria-expanded={menu} aria-controls="side" onClick={() => setMenu((m) => !m)}>{menu ? 'Close' : 'Menu'}</button>
      </header>

      <nav id="side" className={'side' + (menu ? ' open' : '')} aria-label="Topics">
        <a className="nav-item" href="#/">Front page</a>
        {!!trail.length && (
          <>
            <p className="group">Your trail</p>
            {trail.map((t) => (
              <button key={t} className={'nav-item' + (t === centerId ? ' active' : '')} aria-current={t === centerId ? 'page' : undefined} onClick={() => openArticle(t)}>{t}</button>
            ))}
          </>
        )}
        {!!results.length && (
          <>
            <p className="group">Search results</p>
            {results.filter((r) => !trail.includes(r.title)).map((r) => (
              <button key={r.title} className="nav-item" onClick={() => openArticle(r.title)}>{r.title}</button>
            ))}
          </>
        )}
      </nav>

      {/* Grid: 1440 - 220 sidebar - 1 rule = 1219 canvas; - 2 x 29 padding = 1161 = 753 map + 24 gap + 384 rail. */}
      <main className="canvas">
        <div className="title-row">
          <div>
            <p className="crumbs">
              <a href="#/">Front page</a>
              {panel && !isCenter && centerId && <> / <button className="crumb" onClick={() => onNodeClick(centerId)}>{centerId}</button></>}
              {' /'}
            </p>
            <h1>{panel?.title || selected || 'Loading'}</h1>
            {subline && <p className="finding">{subline}</p>}
            {error && <p className="notice" role="alert">{error} <button className="btn-text" onClick={() => setError(null)}>Dismiss</button></p>}
          </div>
          <div className="title-actions">
            {selected && selected !== centerId && <button className="btn-text" onClick={() => expand(selected)}>Grow its branch</button>}
            {panel?.url && <a className="btn-text" href={panel.url} target="_blank" rel="noreferrer">Read on Wikipedia</a>}
            <button className="btn-text" onClick={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
            {panel && !isCenter && <button className="btn-primary" onClick={() => openArticle(panel.title)}>Map “{short(panel.title)}”</button>}
          </div>
        </div>

        <section className="map-card" aria-label={`Map of ${centerId || 'the topic'}`} aria-busy={loading}>
          <div className="card-head">
            <h2>Links from the opening paragraph</h2>
            <p className="legend">
              <span><i className="sw sw-center" />This article</span>
              <span><i className="sw sw-sel" />Selected</span>
              {pathSet.size > 0 && <span><i className="sw sw-path" />Muse’s path</span>}
            </p>
          </div>
          <div className="map-body">
            {nodes.length ? (
              <Graph key={centerId} nodes={nodes} edges={edges} selected={selected} onSelect={onNodeClick} onExpand={expand} path={pathSet} />
            ) : (
              !loading && <p className="empty">Search for a topic to map it.</p>
            )}
            {loading && <p className="loading-note">Mapping {selected || 'the article'}…</p>}
          </div>
        </section>

        <aside className="rail" aria-live="polite">
          {!panel ? (
            <div className="skeleton" aria-label="Loading the article"><span className="bar w60" /><span className="bar" /><span className="bar" /><span className="bar w80" /></div>
          ) : (
            <>
              {panel.thumbnail && <img className="thumb" src={panel.thumbnail} alt={`Lead image of the article ${panel.title}`} />}
              <div className="rail-body">
                <p className="extract">{panel.extract?.slice(0, 520)}{panel.extract?.length > 520 ? '…' : ''}</p>

                <div className="tabs" role="tablist">
                  {TABS.map((t) => (
                    <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={'tab' + (tab === t.id ? ' active' : '')}>{t.label}</button>
                  ))}
                </div>

                {tab === 'summary' && (
                  <div className="ai-box">
                    <div className="row">
                      <div className="seg" role="group" aria-label="Depth">
                        {LEVELS.map((l) => (
                          <button key={l.id} aria-pressed={level === l.id} onClick={() => { setLevel(l.id); setAi(null); }} className={'seg-btn' + (level === l.id ? ' on' : '')}>{l.label}</button>
                        ))}
                      </div>
                      <button onClick={runAi} disabled={aiLoading} className="btn-primary">{aiLoading ? 'Reading…' : 'Ask Muse'}</button>
                    </div>
                    {ai && <p className="ai-text">{ai.text}</p>}
                    <Source r={ai} />
                  </div>
                )}

                {tab === 'path' && (
                  <div className="ai-box">
                    <button onClick={runPath} disabled={pathLoading} className="btn-primary">{pathLoading ? 'Planning…' : path ? 'Plan again' : 'Plan a path'}</button>
                    {path && (
                      <ol className="steps">
                        <li><strong>{path.title}</strong><small>You are here</small></li>
                        {path.steps.map((st, i) => (
                          <li key={i}>
                            <button className="linklike" onClick={() => onNodeClick(st.title)}>{st.title}</button>
                            <small>{st.why}</small>
                          </li>
                        ))}
                      </ol>
                    )}
                    <Source r={path} />
                  </div>
                )}

                {tab === 'quiz' && (
                  <div className="ai-box">
                    <button onClick={runQuiz} disabled={quizLoading} className="btn-primary">{quizLoading ? 'Writing…' : quiz ? 'New questions' : 'Test me'}</button>
                    {quiz?.needsKey && <p className="ai-text">{quiz.note}</p>}
                    {quiz?.questions?.map((qq, i) => (
                      <fieldset key={i} className="q">
                        <legend>{qq.q}</legend>
                        {qq.options.map((opt, j) => {
                          const done = answers[i] !== undefined;
                          const state = !done ? '' : j === qq.answer ? ' right' : answers[i] === j ? ' wrong' : '';
                          return (
                            <button key={j} disabled={done} onClick={() => setAnswers((a) => ({ ...a, [i]: j }))} className={'opt' + state}>{opt}</button>
                          );
                        })}
                      </fieldset>
                    ))}
                    {!!answered && !!quiz?.questions?.length && <p className="score">{score} of {quiz.questions.length} right</p>}
                    {!quiz?.needsKey && <Source r={quiz} />}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
