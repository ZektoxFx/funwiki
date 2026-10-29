import React from 'react';
import Graph from './Graph.jsx';
import { searchWiki, fetchSummary, fetchLinks, aiSummarize, aiPath, aiQuiz, topicFromUrl, topicToUrl, useWikiGraph } from './wiki.js';

const LEVELS = [
  { id: 'eli5', label: 'Explain simply' },
  { id: 'bullets', label: '5 bullets' },
  { id: 'deep', label: 'Deep dive' }
];

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'path', label: 'Learning path' },
  { id: 'quiz', label: 'Quiz' }
];

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
  const { nodes, edges, loading, explore, expand } = useWikiGraph();
  const linkTitles = React.useMemo(() => nodes.filter((n) => n.kind === 'link').map((n) => n.id), [nodes]);

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
      setError('Search failed — is the proxy running? Start it with `node server/proxy.mjs`.');
    }
  }

  async function openArticle(title) {
    setError(null);
    setSelected(title);
    topicToUrl(title);
    resetAi();
    try {
      const summary = await explore(title);
      setPanel(summary);
    } catch {
      setError(`Could not load “${title}”. Check your connection and the proxy.`);
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
      setError('AI summary failed — check the proxy and try again.');
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
      setError('Learning path failed — check the proxy and try again.');
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
      setError('Quiz failed — check the proxy and try again.');
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
    // eslint-disable-next-line
  }, []);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">FunWiki</div>
        <form onSubmit={doSearch} className="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Wikipedia…" aria-label="Search Wikipedia" />
          <button type="submit">Explore</button>
        </form>
      </header>
      {!!results.length && (
        <div className="chips">
          {results.map((r) => (
            <button key={r.title} onClick={() => openArticle(r.title)} className={selected === r.title ? 'chip active' : 'chip'}>
              {r.title}
            </button>
          ))}
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
      <main className="layout">
        <section className="map-card">
          {loading ? <div className="status">Building map…</div> : nodes.length ? (
            <Graph nodes={nodes} edges={edges} selected={selected} onSelect={onNodeClick} onExpand={expand} />
          ) : (
            <div className="status">Search a topic to grow your knowledge map.</div>
          )}
          <div className="hint">
            Click a node to read it. Double-click a side node to grow it.{' '}
            <button onClick={() => selected && expand(selected)}>Expand “{selected || '…'}”</button>
          </div>
        </section>
        <aside className="side">
          {!panel ? (
            <div className="status">Pick a topic to start.</div>
          ) : (
            <>
              <h2>{panel.title}</h2>
              {panel.thumbnail && <img src={panel.thumbnail} alt="" width={220} />}
              <p>{panel.extract?.slice(0, 600)}</p>
              <div className="ai-row">
                {panel.url && <a href={panel.url} target="_blank" rel="noreferrer">Full article →</a>}
                <button onClick={copyLink} className="chip">{copied ? 'Copied!' : 'Copy share link'}</button>
              </div>
              <div className="tabs">
                {TABS.map((t) => (
                  <button key={t.id} onClick={() => setTab(t.id)} className={tab === t.id ? 'chip active' : 'chip'}>{t.label}</button>
                ))}
              </div>

              {tab === 'summary' && (
                <div className="ai-box">
                  <div className="ai-row">
                    {LEVELS.map((l) => (
                      <button key={l.id} onClick={() => setLevel(l.id)} className={level === l.id ? 'chip active' : 'chip'}>{l.label}</button>
                    ))}
                    <button onClick={runAi} disabled={aiLoading}>{aiLoading ? 'Thinking…' : 'AI summary'}</button>
                  </div>
                  {ai && <p className="ai-text">{ai.text}</p>}
                  {ai && <small>{ai.source}{ai.cached ? ' · cached' : ''}{ai.note ? ` · ${ai.note}` : ''}</small>}
                </div>
              )}

              {tab === 'path' && (
                <div className="ai-box">
                  <button onClick={runPath} disabled={pathLoading}>{pathLoading ? 'Planning…' : path ? 'Rebuild path' : 'Build my learning path'}</button>
                  {path && (
                    <ol className="trail">
                      <li><strong>{path.title}</strong> — start here</li>
                      {path.steps.map((s, i) => (
                        <li key={i}>
                          <button className="linklike" onClick={() => openArticle(s.title)}>{s.title}</button>
                          <div><small>{s.why}</small></div>
                        </li>
                      ))}
                    </ol>
                  )}
                  {path && <small>{path.source}{path.cached ? ' · cached' : ''}{path.note ? ` · ${path.note}` : ''}</small>}
                </div>
              )}

              {tab === 'quiz' && (
                <div className="ai-box">
                  <button onClick={runQuiz} disabled={quizLoading}>{quizLoading ? 'Writing…' : quiz ? 'New quiz' : 'Test me!'}</button>
                  {quiz?.needsKey && <p className="ai-text">{quiz.note}</p>}
                  {quiz?.questions?.map((qq, i) => (
                    <div key={i} className="q">
                      <p><strong>Q{i + 1}.</strong> {qq.q}</p>
                      {qq.options.map((opt, j) => {
                        const picked = answers[i] === j;
                        const right = answers[i] !== undefined && j === qq.answer;
                        return (
                          <button
                            key={j}
                            disabled={answers[i] !== undefined}
                            onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}
                            className={'chip opt' + (picked ? (picked && j === qq.answer ? ' right' : ' wrong') : '') + (right && !picked ? ' right' : '')}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {!!answered && !!quiz?.questions?.length && <p>Score: {score}/{quiz.questions.length}</p>}
                </div>
              )}
            </>
          )}
        </aside>
      </main>
    </div>
  );
}


