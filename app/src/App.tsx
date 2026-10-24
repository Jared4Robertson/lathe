import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { layoutModel, type ModelEdgeData, type ModelNodeData } from './layout';
import type { DiagramSummary, Model } from './types';
import { navigate, useLocation } from './router';
import { checksPath, formatPath, parseSpecRoute, useSpec } from './specs/data';
import { SpecView } from './specs/SpecPages';
import { onLatheEvent } from './events';
import { LatheLogo } from './LatheLogo';
import { Icon } from './components/icons';
import { CommandsProvider, useAnnounce, useCommand, useShortcut } from './shell/commands';
import { Nav } from './shell/Nav';
import { isBool, usePref } from './shell/prefs';
import { useNarrow } from './shell/useNarrow';
import { FocusPage } from './views/FocusPage';
import { graphRedirect, isFocusRoute, withView } from './views/address';
type ModelNode = Node<ModelNodeData>;
type ModelEdge = Edge<ModelEdgeData>;

const RELATION_LABELS: Record<string, string> = { is_a: 'is a' };

function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Left} className="handle" />
      <Handle type="source" position={Position.Right} className="handle" />
    </>
  );
}

function ContextNode({ data }: NodeProps<ModelNode>) {
  return <div className="context-node"><span>{data.label}</span></div>;
}

function AggregateNode({ data }: NodeProps<ModelNode>) {
  return (
    <div className={`aggregate-node status-${data.status}`}>
      <Handles />
      <strong>{data.label}</strong>
      <small>{data.subtitle}</small>
    </div>
  );
}

function LeafNode({ data }: NodeProps<ModelNode>) {
  return (
    <div className={`leaf-node kind-${data.kind} status-${data.status}`}>
      <Handles />
      <strong>{data.label}{data.status === 'open' ? ' ?' : ''}</strong>
      <small>{data.subtitle}</small>
    </div>
  );
}

// Draws the route ELK computed, with the relation as a label on its longest segment.
function ModelEdgeView({ id, data, markerEnd }: EdgeProps<ModelEdge>) {
  const points = data?.points ?? [];
  if (points.length < 2) return null;
  const path = `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
  let best = 0;
  let bestLength = -1;
  for (let i = 0; i < points.length - 1; i++) {
    const length = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (length > bestLength) { best = i; bestLength = length; }
  }
  const x = (points[best].x + points[best + 1].x) / 2;
  const y = (points[best].y + points[best + 1].y) / 2;
  const link = data!.link;
  const label = `${RELATION_LABELS[link.relation] ?? link.relation}${data!.uncertain ? ' ?' : ''}`;
  // A tree reads without "includes" on every branch.
  const showLabel = link.relation !== 'includes';
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={data!.uncertain ? 'uncertain' : ''} />
      {showLabel && <EdgeLabelRenderer>
        <div className="edge-label" style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}>{label}</div>
      </EdgeLabelRenderer>}
    </>
  );
}

const nodeTypes = { context: ContextNode, aggregate: AggregateNode, leaf: LeafNode };
const edgeTypes = { model: ModelEdgeView };

const diagramPath = (slug: string) => `/diagrams/${slug}`;
const slugFromPath = (path: string) => path.match(/^\/diagrams\/([a-z0-9-]+)/)?.[1] ?? null;

export default function App() {
  return (
    <CommandsProvider>
      <Shell />
    </CommandsProvider>
  );
}

const NAV_KEY = 'lathe:nav-collapsed';

/** The app shell: the nav, the page for the address, and the commands that work everywhere. */
function Shell() {
  const { path, search } = useLocation();
  const specRoute = parseSpecRoute(path);
  const isGraphPath = path === '/graph' || path.startsWith('/graph/');
  const slug = specRoute ? null : slugFromPath(path);
  const spec = useSpec();
  const announce = useAnnounce();
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const loadDiagrams = useCallback(async () => {
    try {
      const response = await fetch('/api/diagrams');
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? response.statusText);
      setDiagrams(body);
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    loadDiagrams();
    return onLatheEvent('model:changed', loadDiagrams);
  }, [loadDiagrams]);

  // Old addresses: /graph/<id> is now the same thing in the Graph view; /specs/<p>/<d>/graph too.
  const redirectTo = specRoute?.page === 'redirect' ? specRoute.to : isGraphPath && spec.index ? graphRedirect(spec.index, path) : null;
  useEffect(() => { if (redirectTo) navigate(redirectTo, true); }, [redirectTo]);

  // With neither a diagram nor a spec page in the address, open the first diagram.
  useEffect(() => {
    if (!specRoute && !slug && !isGraphPath && diagrams.length > 0) navigate(diagramPath(diagrams[0].slug), true);
  }, [specRoute, slug, isGraphPath, diagrams]);

  // The nav: collapsed to a rail (remembered), or a drawer on a narrow screen.
  const narrow = useNarrow();
  const [collapsed, setCollapsed] = usePref<boolean>(NAV_KEY, false, isBool);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setDrawerOpen(false); }, [path, narrow]);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setTimeout(() => menuButton.current?.focus(), 0); }, []);
  // An opened drawer takes focus (the quick find); closing it gives focus back to the menu button.
  useEffect(() => { if (narrow && drawerOpen) setTimeout(() => findRef.current?.focus(), 0); }, [narrow, drawerOpen]);
  const showNav = useCallback(() => {
    if (narrow) setDrawerOpen(true);
    else if (collapsed) setCollapsed(false);
  }, [narrow, collapsed, setCollapsed]);
  const navShortcut = useShortcut('toggleNav');

  useCommand('toggleNav', () => {
    if (narrow) { if (drawerOpen) closeDrawer(); else setDrawerOpen(true); announce(drawerOpen ? 'Navigation closed' : 'Navigation opened'); return; }
    setCollapsed(!collapsed);
    announce(collapsed ? 'Navigation expanded' : 'Navigation collapsed');
  });
  useCommand('quickOpen', () => { showNav(); setTimeout(() => findRef.current?.focus(), 0); });
  useCommand('focusNav', () => {
    showNav();
    setTimeout(() => (navRef.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? findRef.current)?.focus(), 0);
  });
  useCommand('goBack', () => window.history.back());
  useCommand('goForward', () => window.history.forward());
  useCommand('openChecks', () => navigate(checksPath));
  useCommand('goChecks', () => navigate(checksPath));
  useCommand('goFormat', () => navigate(formatPath));
  useCommand('goDiagrams', () => navigate(diagrams[0] ? diagramPath(diagrams[0].slug) : '/'));
  useCommand('goHome', () => navigate('/specs'));
  useCommand('goToDefinition', () => {
    const link = (document.activeElement as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    const href = link?.getAttribute('href');
    if (href && href.startsWith('/')) navigate(href);
    else announce('Focus a link first, then press F12 to open its record.');
  });
  useCommand('nextProblem', () => stepProblem(1, announce));
  useCommand('previousProblem', () => stepProblem(-1, announce));
  useCommand('focusSearch', () => {
    let el = document.activeElement as HTMLElement | null;
    while (el && el !== document.body) {
      const box = el.querySelector?.<HTMLInputElement>('input[type="search"]');
      if (box) { box.focus(); return; }
      el = el.parentElement;
    }
    const inPage = document.querySelector<HTMLInputElement>('#main input[type="search"]');
    if (inPage) inPage.focus();
    else { showNav(); setTimeout(() => findRef.current?.focus(), 0); }
  });

  const current = diagrams.find((d) => d.slug === slug);
  const focusRoute = isFocusRoute(specRoute) ? specRoute : null;
  const graphHref = focusRoute ? withView(path, 'graph') : '/graph';
  const newDiagram = <NewDiagram onCreated={async (created) => { await loadDiagrams(); navigate(diagramPath(created.slug)); }} />;

  let page;
  if (redirectTo || (isGraphPath && !spec.index)) {
    page = <main className="placeholder" id="main"><p>{spec.error ? `Couldn't load the specs: ${spec.error}` : 'Opening…'}</p></main>;
  } else if (isGraphPath) {
    page = <main className="placeholder" id="main"><p>No products yet. Add a <code>product.md</code> under <code>specs/</code>.</p></main>;
  } else if (focusRoute) {
    page = <FocusPage spec={spec} route={focusRoute} search={search} />;
  } else if (specRoute) {
    page = <SpecView spec={spec} route={specRoute} />;
  } else if (current) {
    page = <DiagramView key={current.slug} diagram={current} />;
  } else {
    page = (
      <main className="placeholder" id="main">
        <p>{diagrams.length > 0 && slug ? `There's no diagram called "${slug}".` : 'Loading diagrams…'}</p>
      </main>
    );
  }

  return (
    <div className={`app${collapsed && !narrow ? ' nav-collapsed' : ''}${narrow ? ' is-narrow' : ''}`}>
      <a href="#main" className="skip-link">Skip to the page</a>
      {narrow && (
        <div className="topbar">
          <button
            ref={menuButton}
            type="button"
            className="icon-button"
            aria-label="Open the navigation"
            aria-expanded={drawerOpen}
            aria-controls="nav"
            title={`Open the navigation${navShortcut ? ` (${navShortcut})` : ''}`}
            onClick={() => setDrawerOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <span className="brand"><LatheLogo size={22} /> Lathe</span>
        </div>
      )}
      {narrow && drawerOpen && <div className="drawer-backdrop" onMouseDown={closeDrawer} />}
      {(!narrow || drawerOpen) && (
        <Nav
          ref={navRef}
          spec={spec}
          path={path}
          diagrams={diagrams}
          diagramError={listError}
          newDiagram={newDiagram}
          graphHref={graphHref}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed(!collapsed)}
          drawer={narrow}
          drawerOpen={drawerOpen}
          onCloseDrawer={closeDrawer}
          findRef={findRef}
        />
      )}
      {page}
    </div>
  );
}

/** F8 and Shift+F8: move focus to the next or previous problem on the page, and say what it is. */
function stepProblem(step: 1 | -1, announce: (text: string) => void) {
  const items = [...document.querySelectorAll<HTMLElement>('#main li.problem')];
  if (items.length === 0) { announce('No problems on this page.'); return; }
  const at = items.findIndex((el) => el === document.activeElement || el.contains(document.activeElement));
  const next = at < 0 ? (step === 1 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
  const el = items[next];
  el.tabIndex = -1;
  el.classList.add('is-current-problem');
  items.forEach((other) => { if (other !== el) other.classList.remove('is-current-problem'); });
  el.focus();
  el.scrollIntoView?.({ block: 'nearest' });
  announce(`Problem ${next + 1} of ${items.length}: ${el.textContent?.trim() ?? ''}`);
}


function NewDiagram({ onCreated }: { onCreated: (d: DiagramSummary) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return <button className="new-diagram" onClick={() => setOpen(true)}>+ New diagram</button>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Enter a title first.'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/diagrams', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? response.statusText);
      setOpen(false); setTitle(''); setDescription(''); setError(null);
      onCreated(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="new-diagram-form" onSubmit={submit}>
      <label htmlFor="new-title">Title</label>
      <input id="new-title" value={title} autoFocus onChange={(e) => { setTitle(e.target.value); setError(null); }} placeholder="Making software" />
      <label htmlFor="new-description">Description <span>(optional)</span></label>
      <textarea id="new-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create diagram'}</button>
        <button type="button" className="secondary" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
      </div>
    </form>
  );
}

function DiagramView({ diagram }: { diagram: DiagramSummary }) {
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<{ nodes: ModelNode[]; edges: ModelEdge[] }>({ nodes: [], edges: [] });
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/diagrams/${diagram.slug}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? response.statusText);
      setModel(body);
      setGraph(await layoutModel(body));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [diagram.slug]);

  useEffect(() => {
    load();
    return onLatheEvent('model:changed', load);
  }, [load]);

  // Highlight the selected term, its links and the terms at their other ends.
  const { nodes, edges } = useMemo(() => {
    if (!selected) return { nodes: graph.nodes, edges: graph.edges.map((e) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed } })) };
    const touches = (e: ModelEdge) => e.data!.link.source === selected || e.data!.link.target === selected;
    const neighbours = new Set([selected]);
    for (const l of model?.links ?? []) if (l.source === selected || l.target === selected) { neighbours.add(l.source); neighbours.add(l.target); }
    return {
      nodes: graph.nodes.map((n) => ({ ...n, className: n.type === 'context' || neighbours.has(n.data.term) ? (n.data.term === selected ? 'selected-term' : '') : 'dimmed' })),
      edges: graph.edges.map((e) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed }, className: touches(e) ? 'highlighted' : 'dimmed' })),
    };
  }, [graph, model, selected]);

  const term = model?.terms.find((t) => t.name === selected);
  const links = model?.links.filter((l) => l.source === selected || l.target === selected) ?? [];
  const empty = model !== null && model.terms.length === 0;

  return (
    <main className="diagram" id="main">
      <header>
        <div>
          <p className="eyebrow">Diagram · model/{diagram.slug}/*.csv via DuckDB</p>
          <h1>{diagram.title}</h1>
          {diagram.description && <p className="description">{diagram.description}</p>}
        </div>
        {model && (
          <p className={`checks ${model.checks.ok ? 'ok' : 'failed'}`} title={model.checks.message}>
            {model.checks.ok ? 'All checks passed' : 'Checks failed'}
          </p>
        )}
      </header>
      {error && <p className="error">Couldn't load the diagram: {error}</p>}
      {model && !model.checks.ok && <p className="error">{model.checks.message}</p>}
      <div className="workspace">
        <div className="canvas">
          {empty ? (
            <div className="empty">
              <h2>This diagram is empty</h2>
              <p>Add terms to <code>model/{diagram.slug}/terms.csv</code> and links to <code>model/{diagram.slug}/links.csv</code>. The diagram redraws as soon as you save.</p>
            </div>
          ) : graph.nodes.length > 0 && (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              onNodeClick={(_, n) => n.data.term && setSelected(n.data.term === selected ? null : n.data.term)}
              onPaneClick={() => setSelected(null)}
              fitView
              minZoom={0.2}
            >
              <Background gap={24} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
        </div>
        <aside>
          {term ? (
            <>
              <p className="eyebrow">{term.kind.replace('_', ' ')} · {term.status}</p>
              <h2>{term.name}</h2>
              <p>{term.definition}</p>
              <h3>Links</h3>
              <ul>
                {links.map((l, i) => (
                  <li key={i} className={`status-${l.status}`}>
                    <span>{l.source} <em>{RELATION_LABELS[l.relation] ?? l.relation}</em> {l.target}{l.status === 'open' ? ' ?' : ''}</span>
                    {(l.cardinality || l.note) && <small>{[l.cardinality, l.note].filter(Boolean).join(' · ')}</small>}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2>Select a term</h2>
              <p>Click any box to see its definition and links, and to highlight what it connects to.</p>
              <p className="legend"><span className="swatch agg" /> aggregate <span className="swatch evt" /> domain event <span className="dash" /> open or unclear ("?")</p>
              <p className="hint">Edit this diagram's CSV files and the view reloads.</p>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
