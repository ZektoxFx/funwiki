import React from 'react';
import Graph from './Graph.jsx';
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
      {meta ? `Meta ${r.source.slice(5)}` : 'Wikipedia fallback'}
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
  const { nodes, edges, loading, explore, expand } = useWikiGraph();
  const linkTitles = React.useMemo(() => nodes.filter((n) => n.kind === 'link').map((n) => n.id), [nodes]);
  const centerId = nodes.find((n) => n.kind === 'center')?.id;
  const shown = React.useRef(null); // topic we put in the URL, so our own hash writes are ignored

  async function doSearch(e) {
    e?.preventDefault();
    if (!q.trim()) return;
    setError(null);
    try {
      const r = await searchWiki(q.trim());
      setResults(r);
      if (r[0]) openArticle(r[0].title);
      else setError(`No Wikipedia articles found for “${q.trim()}”. Try another spelling.`);
    } catch {
      setError('Search failed — is the API running? Start it with `npm run dev`.');
    }
  }

  async function openArticle(title) {
    setError(null);
    setSelected(title);
    shown.current = title;
    topicToUrl(title);
    resetAi();
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
      setError('AI summary failed — check the API and try again.');
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
      setError('Learning path failed — check the API and try again.');
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
      setError('Quiz failed — Muse Spark gave an unusable reply. Try again.');
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
    const start = topicFromUrl() || 'Black Holes';
    setQ(start);
    openArticle(start);
    searchWiki(start).then(setResults).catch(() => {});
    fetch('/api/health').then((r) => r.json()).then((h) => setMuse(h.meta)).catch(() => {});
    // Browser back/forward: reopen whatever topic the URL now names.
    const onHash = () => {
      const t = topicFromUrl();
      if (t && t !== shown.current) { setQ(t); openArticle(t); }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          FunWiki
        </div>
        <form onSubmit={doSearch} className="search" role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any topic…" aria-label="Search Wikipedia" />
          <button type="submit" className="primary">Explore</button>
        </form>
        <div className={'muse' + (muse?.keyConfigured ? ' on' : '')} title={muse ? `${muse.model} via ${muse.base}` : 'Checking Meta AI…'}>
          <span className="dot" aria-hidden="true" />
          {muse ? (muse.keyConfigured ? `Meta ${muse.model}` : 'Meta AI offline') : 'Meta AI…'}
        </div>
      </header>

      {!!results.length && (
        <nav className="chips" aria-label="Search results">
          {results.map((r) => (
            <button key={r.title} onClick={() => openArticle(r.title)} className={'chip' + (centerId === r.title ? ' active' : '')}>
              {r.title}
            </button>
          ))}
        </nav>
      )}

      {error && <div className="error enter" role="alert">{error}<button className="ghost" onClick={() => setError(null)} aria-label="Dismiss">×</button></div>}

      <main className="layout">
        <section className="map" aria-busy={loading}>
          {nodes.length ? (
            <Graph key={centerId} nodes={nodes} edges={edges} selected={selected} onSelect={onNodeClick} onExpand={expand} />
          ) : (
            !loading && <div className="status">Search a topic to grow your knowledge map.</div>
          )}
          {loading && <div className="status overlay"><span className="spinner" aria-hidden="true" />Building map…</div>}
          <div className="hint">
            Click to read · double-click or <kbd>E</kbd> to grow · drag topics to move them · drag space to pan · scroll to zoom
            {selected && <button className="chip" onClick={() => expand(selected)}>Expand “{selected}”</button>}
          </div>
        </section>

        <aside className="panel" aria-live="polite">
          {!panel ? (
            <div className="status">Pick a topic to start.</div>
          ) : (
            <>
              {panel.thumbnail && <img className="hero" src={panel.thumbnail} alt="" />}
              <div className="panel-body">
                <h2>{panel.title}</h2>
                <p className="extract">{panel.extract?.slice(0, 600)}</p>
                <div className="row">
                  {panel.url && <a className="chip" href={panel.url} target="_blank" rel="noreferrer">Full article ↗</a>}
                  <button onClick={copyLink} className="chip">{copied ? 'Copied!' : 'Copy share link'}</button>
                  {panel.title !== centerId && <button onClick={() => openArticle(panel.title)} className="chip">Center map here</button>}
                </div>

                <div className="tabs" role="tablist">
                  {TABS.map((t) => (
                    <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={'tab' + (tab === t.id ? ' active' : '')}>{t.label}</button>
                  ))}
                </div>

                {tab === 'summary' && (
                  <div className="ai-box">
                    <div className="row">
                      {LEVELS.map((l) => (
                        <button key={l.id} onClick={() => { setLevel(l.id); setAi(null); }} className={'chip' + (level === l.id ? ' active' : '')}>{l.label}</button>
                      ))}
                      <button onClick={runAi} disabled={aiLoading} className="primary">{aiLoading ? 'Thinking…' : 'Ask Muse'}</button>
                    </div>
                    {ai && <p className="ai-text enter">{ai.text}</p>}
                    <Source r={ai} />
                  </div>
                )}

                {tab === 'path' && (
                  <div className="ai-box">
                    <button onClick={runPath} disabled={pathLoading} className="primary">{pathLoading ? 'Planning…' : path ? 'Rebuild path' : 'Build my learning path'}</button>
                    {path && (
                      <ol className="trail">
                        <li className="enter"><strong>{path.title}</strong><small>Start here</small></li>
                        {path.steps.map((s, i) => (
                          <li key={i} className="enter" style={{ '--i': i + 1 }}>
                            <button className="linklike" onClick={() => openArticle(s.title)}>{s.title}</button>
                            <small>{s.why}</small>
                          </li>
                        ))}
                      </ol>
                    )}
                    <Source r={path} />
                  </div>
                )}

                {tab === 'quiz' && (
                  <div className="ai-box">
                    <button onClick={runQuiz} disabled={quizLoading} className="primary">{quizLoading ? 'Writing…' : quiz ? 'New quiz' : 'Test me!'}</button>
                    {quiz?.needsKey && <p className="ai-text enter">{quiz.note}</p>}
                    {quiz?.questions?.map((qq, i) => (
                      <fieldset key={i} className="q enter" style={{ '--i': i }}>
                        <legend><strong>Q{i + 1}.</strong> {qq.q}</legend>
                        {qq.options.map((opt, j) => {
                          const done = answers[i] !== undefined;
                          const state = !done ? '' : j === qq.answer ? ' right' : answers[i] === j ? ' wrong' : '';
                          return (
                            <button key={j} disabled={done} onClick={() => setAnswers((a) => ({ ...a, [i]: j }))} className={'opt' + state}>
                              {opt}
                            </button>
                          );
                        })}
                      </fieldset>
                    ))}
                    {!!answered && !!quiz?.questions?.length && <p className="score">Score: {score}/{quiz.questions.length}</p>}
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
