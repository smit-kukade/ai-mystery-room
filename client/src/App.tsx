import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { MysterySummary, PlayerCase, Result } from '@mystery/shared';

type Err = { error: { message: string } };
type CurrentUser = { id: string; name: string; email: string };
let csrfToken = '';
let bootstrapPromise: Promise<{ user: CurrentUser | null; csrfToken: string }> | undefined;
const AuthContext = createContext<{ user: CurrentUser | null; setUser: (user: CurrentUser | null) => void; ready: boolean }>({ user: null, setUser: () => undefined, ready: false });

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(method !== 'GET' && method !== 'HEAD' ? { 'X-CSRF-Token': csrfToken } : {}), ...init?.headers },
  });
  const body = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw new Error((body as Err).error?.message ?? 'A network error occurred.');
  if (body && typeof body.csrfToken === 'string') csrfToken = body.csrfToken;
  return body;
}

function useAuth() { return useContext(AuthContext); }

const topics = ['Murder Mystery', 'Cybercrime', 'Theft', 'Missing Person', 'General Mystery'];

function Header() {
  const { user, setUser } = useAuth();
  async function logout() { try { await api('/auth/logout', { method: 'POST' }); setUser(null); window.location.assign('/login'); } catch { /* retain visible state if logout fails */ } }
  return <header className="topbar"><Link className="brand" to="/" aria-label="AI Mystery Room home"><span className="brand-icon">&#x2726;</span> AI MYSTERY ROOM</Link><nav className="topbar-nav" aria-label="Main navigation">{user && <><Link className="new-link" to="/">Create Mystery <span>&#x2197;</span></Link><Link className="new-link" to="/mysteries">My Mysteries</Link><span className="new-link">{user.name}</span><button type="button" className="new-link auth-logout" onClick={logout}>Sign out</button></>}{!user && <><Link className="new-link" to="/login">Sign in</Link><Link className="new-link" to="/register">Create account</Link></>}</nav></header>;
}



function Footer() {
  return <footer>AI Mystery Room is fictional entertainment. All cases and evidence are simulated.</footer>;
}

function Shell({ children }: { children: ReactNode }) {
  return <><Header/><main className="case-main">{children}</main><Footer/></>;
}

function formatCaseDate(value?: string) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function MysteriesPage() {
  const [saved, setSaved] = useState<MysterySummary[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api<{ cases: MysterySummary[] }>('/cases').then(({ cases }) => {
      if (current) setSaved(cases);
    }).catch(e => {
      if (current) setError(e instanceof Error ? e.message : 'Could not retrieve saved mysteries.');
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [retry]);

  const activeCount = saved.filter(item => item.status !== 'solved').length;
  const completedCount = saved.length - activeCount;
  const shown = saved.filter(item => filter === 'all' || (filter === 'active' ? item.status !== 'solved' : item.status === 'solved'));

  return <><Header/><main className="home mystery-history">
    <div className="eyebrow"><i/> YOUR CASE ARCHIVE</div>
    <h1>My <em>Mysteries.</em></h1>
    <p className="lead">Return to an investigation and pick up where you left off.</p>
    <p className="shared-history">Your saved investigations are private to your account.</p>
    <div className="history-toolbar"><div className="history-filters" role="group" aria-label="Filter mysteries by status">
      <button type="button" className={filter === 'all' ? 'selected' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All <span>{saved.length}</span></button>
      <button type="button" className={filter === 'active' ? 'selected' : ''} aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>Active <span>{activeCount}</span></button>
      <button type="button" className={filter === 'completed' ? 'selected' : ''} aria-pressed={filter === 'completed'} onClick={() => setFilter('completed')}>Completed <span>{completedCount}</span></button>
    </div><Link className="primary history-create" to="/">Create Mystery <span>→</span></Link></div>
    {loading && <p className="loading" role="status">Retrieving saved mysteries…</p>}
    {!loading && error && <div className="history-message" role="alert"><p>{error}</p><button className="cancel" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    {!loading && !error && saved.length === 0 && <div className="history-message"><h2>No saved mysteries yet.</h2><p>Create your first case and it will appear here.</p><Link className="primary" to="/">Create Mystery <span>→</span></Link></div>}
    {!loading && !error && saved.length > 0 && shown.length === 0 && <div className="history-message"><h2>{filter === 'active' ? 'No active investigations.' : 'No mysteries completed yet.'}</h2><p>{filter === 'active' ? 'All saved cases have been completed.' : 'Your completed cases will be collected here.'}</p></div>}
    {!loading && !error && shown.length > 0 && <div className="history-list">{shown.map(item => <article className="panel history-card" key={item.id}>
      <div className="history-card-top"><span className="section-kicker">{item.topic}</span><span className={`status-badge ${item.status === 'solved' ? 'completed' : ''}`}>{item.status === 'solved' ? 'Completed' : 'Active'}</span></div>
      <h2>{item.title}</h2><p>{item.synopsis || item.premise || 'No scenario summary is available.'}</p>
      <div className="history-card-bottom"><time dateTime={item.createdAt}>{formatCaseDate(item.createdAt)}</time><Link className="primary" to={`/case/${item.id}`}>{item.status === 'solved' ? 'Review case' : 'Open investigation'} <span>→</span></Link></div>
    </article>)}</div>}
  </main><Footer/></>;
}

function Home() {
  const navigate = useNavigate();
  const [premise, setPremise] = useState('');
  const [topic, setTopic] = useState('General Mystery');
  const [customTopic, setCustomTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [theme, setTheme] = useState('');
  const [setting, setSetting] = useState('');
  const [prefs, setPrefs] = useState(['chat', 'image', 'cctv', 'document', 'testimony']);
  const [customize, setCustomize] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resolvedTopic = topic === 'custom' ? customTopic.trim() : topic;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (topic === 'custom' && !resolvedTopic) {
      setError('Enter a topic for your case.');
      return;
    }
    setBusy(true);
    try {
      const response = await api<{ case: PlayerCase }>('/cases', {
        method: 'POST',
        body: JSON.stringify({ premise, topic: resolvedTopic, difficulty, theme: theme || undefined, setting: setting || undefined, evidencePreferences: prefs }),
      });
      navigate(`/case/${response.case.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create this mystery.');
    } finally {
      setBusy(false);
    }
  }

  return <><Header/><main className="home">
    <div className="eyebrow"><i/> A CASE IS WAITING TO BE SOLVED</div>
    <h1>Every clue<br/><em>has a story.</em></h1>
    <p className="lead">Give us a premise. We’ll build the case. You find out what really happened.</p>
    <form className="create-card" onSubmit={submit}>
      <label htmlFor="topic">Mystery topic</label>
      <select id="topic" value={topic} onChange={event => setTopic(event.target.value)}>
        {topics.map(value => <option key={value} value={value}>{value}</option>)}
        <option value="custom">Enter a custom topic…</option>
      </select>
      {topic === 'custom' && <div className="custom-topic-field">
        <label htmlFor="custom-topic">Your topic</label>
        <input id="custom-topic" value={customTopic} onChange={event => setCustomTopic(event.target.value)} minLength={1} maxLength={80} required placeholder="e.g. A vanished botanist in a glasshouse"/>
      </div>}
      <label htmlFor="premise" className="scenario-label">Your scenario</label>
      <textarea id="premise" value={premise} onChange={event => setPremise(event.target.value)} minLength={30} maxLength={1000} placeholder="A priceless violin disappeared during intermission at a sold-out concert…" required/>
      <div className="counter">{premise.length} / 1,000</div>
      <div className="form-row">
        <div><label htmlFor="difficulty">Difficulty</label><select id="difficulty" value={difficulty} onChange={event => setDifficulty(event.target.value)}><option value="easy">Easy — follow the trail</option><option value="medium">Medium — connect the clues</option><option value="hard">Hard — look closer</option></select></div>
        <div><label htmlFor="theme">Case theme</label><select id="theme" value={theme} onChange={event => setTheme(event.target.value)}><option value="">Surprise me</option>{['locked-room', 'theft', 'disappearance', 'sabotage', 'workplace', 'campus', 'historical', 'sci-fi'].map(value => <option key={value}>{value}</option>)}</select></div>
      </div>
      <label className="setting-label" htmlFor="setting">Setting <span>OPTIONAL</span></label>
      <input id="setting" maxLength={160} value={setting} onChange={event => setSetting(event.target.value)} placeholder="e.g. a remote mountain observatory"/>
      <button type="button" className="custom-toggle" onClick={() => setCustomize(!customize)} aria-expanded={customize}>＋ Customize case <span>{customize ? '−' : '+'}</span></button>
      {customize && <fieldset><legend>Evidence you’d like to see</legend><div className="checks">{[['chat', 'Messages'], ['image', 'Scene images'], ['cctv', 'CCTV logs'], ['document', 'Documents'], ['testimony', 'Witness accounts']].map(([value, label]) => <label key={value}><input type="checkbox" checked={prefs.includes(value)} onChange={event => setPrefs(event.target.checked ? [...prefs, value] : prefs.filter(item => item !== value))}/>{label}</label>)}</div></fieldset>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy || premise.trim().length < 30 || prefs.length === 0 || (topic === 'custom' && !resolvedTopic)}>{busy ? 'Building your case…' : 'Create mystery'} <span>{busy ? '…' : '→'}</span></button>
      <p className="disclaimer">Entirely fictional. No real people or events.</p>
    </form>
    <section className="steps"><h2>A good mystery takes three things.</h2><div><article><b>01 / THE CASE</b><p>Start with a premise. A new mystery takes shape around it.</p></article><article><b>02 / THE CLUES</b><p>Read the statements, inspect the details, build your theory.</p></article><article><b>03 / YOUR CALL</b><p>Name your suspect. Then see if the evidence agrees.</p></article></div></section>
  </main><Footer/></>;
}

function CasePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [caseFile, setCaseFile] = useState<PlayerCase | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [evidence, setEvidence] = useState<PlayerCase['evidence'][number] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ case: PlayerCase }>(`/cases/${id}`).then(({ case: loaded }) => {
      setCaseFile(loaded);
    }).catch(e => setError(e.message));
  }, [id]);

  async function accuse() {
    if (!caseFile || !selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await api<{ result: Result }>(`/cases/${id}/accusation`, { method: 'POST', body: JSON.stringify({ suspectId: selected, reasoning: reasoning || undefined }) });
      sessionStorage.setItem(`result:${id}`, JSON.stringify(response.result));
      navigate(`/case/${id}/result`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit accusation.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (error && !caseFile) return <Shell><div className="notice"><h1>Case unavailable</h1><p>{error}</p><Link className="primary link-button" to="/">Start another mystery →</Link></div></Shell>;
  if (!caseFile) return <Shell><p className="loading">Retrieving your case…</p></Shell>;
  const c = caseFile;

  return <Shell><div className="case-head">
    <div className="case-head-meta"><div className="eyebrow"><i/> CASE FILE <span> / {c.difficulty.toUpperCase()}</span></div><span className={`status-badge ${c.status === 'solved' ? 'completed' : ''}`}>{c.status === 'solved' ? 'Completed' : 'Active'}</span></div>
    <div className="section-kicker">{c.topic} / INVESTIGATION</div>
    <h1>{c.title}</h1><p className="lead">{c.synopsis}</p>
    <p className="case-location">{c.incident.location} · {new Date(c.incident.occurredAt).toLocaleString()}</p>
  </div>
  <div className="case-grid"><div>
    {c.premise && <section className="panel"><div className="section-kicker">ORIGINAL SCENARIO</div><p className="case-premise">{c.premise}</p></section>}
    <section className="panel"><div className="section-kicker">THE INCIDENT</div><h2>{c.incident.description}</h2></section>
    <section className="panel"><div className="section-kicker">TIMELINE</div><div className="timeline">{c.timeline.map(event => <article key={event.id}><time>{new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><p>{event.description}</p></article>)}</div></section>
    <section className="panel"><div className="section-kicker">EVIDENCE / {c.evidence.length} ITEMS</div><div className="evidence-list">{c.evidence.map(item => <button key={item.id} className="evidence" onClick={() => setEvidence(item)}><span className="evidence-type">{item.type.toUpperCase()}</span><span><b>{item.title}</b><small>{item.summary}</small></span><span className="arrow">↗</span></button>)}</div></section>
  </div><aside className="panel suspects"><div className="section-kicker">PERSONS OF INTEREST / {c.suspects.length}</div>
    {c.suspects.map(suspect => <label className={`suspect ${selected === suspect.id ? 'chosen' : ''}`} key={suspect.id}><input type="radio" name="suspect" value={suspect.id} checked={selected === suspect.id} onChange={() => setSelected(suspect.id)}/><div><h3>{suspect.name}<small>{suspect.age} · {suspect.role}</small></h3><p>{suspect.relationshipToIncident}</p><div className="profile"><b>MOTIVE</b><p>{suspect.motive}</p><b>ALIBI</b><p>{suspect.alibi}</p></div></div></label>)}
    <label className="reason-label" htmlFor="reasoning">Your theory <span>OPTIONAL</span></label><textarea id="reasoning" maxLength={500} value={reasoning} onChange={event => setReasoning(event.target.value)} placeholder="What do the clues tell you?"/>
    {c.result ? <div className="case-recorded"><p>Your accusation is recorded. Case status: <strong>{c.status === 'solved' ? 'Completed' : 'Active'}</strong>.</p><Link className="primary" to={`/case/${id}/result`}>Review the result <span>→</span></Link></div> : <button className="primary" disabled={!selected || busy} onClick={() => setConfirming(true)}>{busy ? 'Checking the evidence…' : 'Accuse this suspect'} <span>→</span></button>}
    {error && <p role="alert" className="error">{error}</p>}
  </aside></div>
  {confirming && <div className="confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h3 id="confirm-title">Ready to make your call?</h3><p>Once submitted, this case records your accusation. Take one last look at the evidence if you need to.</p><button className="primary" disabled={busy} onClick={accuse}>{busy ? 'Checking the evidence…' : 'Confirm accusation'}</button><button className="cancel" disabled={busy} onClick={() => setConfirming(false)}>Go back</button></div>}
  {evidence && <div className="overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEvidence(null); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="evidence-title"><button className="close" aria-label="Close evidence" onClick={() => setEvidence(null)}>×</button><div className="section-kicker">SIMULATED EVIDENCE / {evidence.type.toUpperCase()}</div><h2 id="evidence-title">{evidence.title}</h2>{evidence.eventTime && <time>{new Date(evidence.eventTime).toLocaleString()}</time>}<p className="evidence-detail">{evidence.detail}</p>{evidence.type === 'image' && <p className="simulated">▧ Simulated image evidence · text artifact</p>}<button className="cancel" onClick={() => setEvidence(null)}>Close</button></section></div>}
  </Shell>;
}

function ResultPage() {
  const { id = '' } = useParams();
  const [result, setResult] = useState<Result | null>(null);
  const [caseFile, setCaseFile] = useState<PlayerCase | null>(null);
  const [error, setError] = useState('');
  const [evidenceId, setEvidenceId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<{ case: PlayerCase }>(`/cases/${id}`), Promise.resolve(sessionStorage.getItem(`result:${id}`))]).then(([loaded, stored]) => {
      setCaseFile(loaded.case);
      if (loaded.case.result) setResult(loaded.case.result);
      else if (stored) setResult(JSON.parse(stored));
      else setError('Submit an accusation to see your result.');
    }).catch(e => setError(e.message));
  }, [id]);

  if (!result || !caseFile) return <Shell><div className="notice"><h1>{error || 'Reopening the case…'}</h1>{error && <Link to={`/case/${id}`} className="primary link-button">Review the case →</Link>}</div></Shell>;
  const c = caseFile;
  const chosen = c.suspects.find(suspect => suspect.id === result.selectedSuspectId);
  const evidence = c.evidence.find(item => item.id === evidenceId);

  return <Shell><div className={`result-hero ${result.correct ? 'correct' : 'incorrect'}`}><div className="eyebrow">CASE STATUS / <span className={`status-badge ${c.status === 'solved' ? 'completed' : ''}`}>{c.status === 'solved' ? 'Completed' : 'Active'}</span> / {result.correct ? 'CORRECT ACCUSATION' : 'INCORRECT ACCUSATION'}</div><h1>{result.correct ? 'You read the room.' : 'The clues had another story.'}</h1><p>{result.correct ? `Your accusation of ${result.culprit.name} was right.` : `You accused ${chosen?.name ?? 'a suspect'}. The culprit was ${result.culprit.name}.`}</p></div>
    <section className="panel solution"><div className="section-kicker">THE RECONSTRUCTION</div><h2>{result.culprit.name} was responsible.</h2><p>{result.explanation}</p><h3>Evidence that matters</h3><div className="evidence-list">{result.supportingEvidenceIds.map(id => { const item = c.evidence.find(entry => entry.id === id); return item ? <button className="evidence" key={id} onClick={() => setEvidenceId(id)}><span className="evidence-type">{item.type.toUpperCase()}</span><span><b>{item.title}</b><small>{item.summary}</small></span><span className="arrow">↗</span></button> : null; })}</div><h3>What about the other lead?</h3><p>{result.alternativeExplanation}</p><div className="actions"><Link className="primary link-button" to="/">Play another mystery →</Link><Link className="cancel link-button" to={`/case/${id}`}>Review case</Link></div></section>
    {evidence && <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) setEvidenceId(null); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="result-evidence-title"><button className="close" aria-label="Close evidence" onClick={() => setEvidenceId(null)}>×</button><div className="section-kicker">{evidence.type.toUpperCase()}</div><h2 id="result-evidence-title">{evidence.title}</h2><p className="evidence-detail">{evidence.detail}</p><button className="cancel" onClick={() => setEvidenceId(null)}>Close</button></section></div>}
  </Shell>;
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, setUser, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!ready) return <Shell><p className="loading" role="status">Restoring your session…</p></Shell>;
  if (user) return <Navigate to="/" replace/>;
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await api<{ user: CurrentUser; csrfToken: string }>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify({ ...(mode === 'register' ? { name } : {}), email, password }) });
      csrfToken = response.csrfToken; setUser(response.user);
      const target = (location.state as { from?: string } | null)?.from ?? '/'; navigate(target, { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not authenticate.'); }
    finally { setBusy(false); }
  }
  return <><Header/><main className="home auth-page"><div className="eyebrow"><i/> PRIVATE CASE ARCHIVE</div><h1>{mode === 'register' ? <>Create your <em>account.</em></> : <>Welcome <em>back.</em></>}</h1><p className="lead">{mode === 'register' ? 'Your investigations will be saved privately to your account.' : 'Sign in to continue your investigations.'}</p><form className="create-card auth-card" onSubmit={submit}>{mode === 'register' && <><label htmlFor="auth-name">Name</label><input id="auth-name" autoComplete="name" maxLength={80} value={name} onChange={event => setName(event.target.value)} required/></>}<label htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required/><label htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 12 : 1} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required/>{mode === 'register' && <p className="disclaimer">Use at least 12 characters.</p>}{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'} <span>→</span></button><p className="disclaimer">{mode === 'register' ? <>Already registered? <Link to="/login">Sign in</Link></> : <>New here? <Link to="/register">Create an account</Link></>}</p></form></main><Footer/></>;
}

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Shell><p className="loading" role="status">Restoring your session…</p></Shell>;
  return user ? <>{children}</> : <Navigate to="/login" replace state={{ from: location.pathname + location.search }}/>;
}

function RoutedApp() {
  return <Routes><Route path="/login" element={<AuthPage mode="login"/>}/><Route path="/register" element={<AuthPage mode="register"/>}/><Route path="/" element={<Protected><Home/></Protected>}/><Route path="/mysteries" element={<Protected><MysteriesPage/></Protected>}/><Route path="/case/:id" element={<Protected><CasePage/></Protected>}/><Route path="/case/:id/result" element={<Protected><ResultPage/></Protected>}/><Route path="*" element={<Shell><div className="notice"><h1>Room not found</h1><Link className="primary link-button" to="/">Return to the lobby →</Link></div></Shell>}/></Routes>;
}

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { bootstrapPromise ??= api<{ user: CurrentUser | null; csrfToken: string }>('/auth/me'); bootstrapPromise.then(result => { csrfToken = result.csrfToken; setUser(result.user); }).catch(() => undefined).finally(() => setReady(true)); }, []);
  return <AuthContext.Provider value={{ user, setUser, ready }}><RoutedApp/></AuthContext.Provider>;
}
