import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
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
import { Link, navigate, usePath } from './router';
import { parseSpecRoute, useSpec } from './specs/data';
import { SpecMenu, SpecView } from './specs/SpecPages';
import { onLatheEvent } from './events';
import { GraphMenu, parseGraphPath } from './graph/route';

const GraphPage = lazy(() => import('./graph/GraphPage'));

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
  const path = usePath();
  const specRoute = parseSpecRoute(path);
  const slug = specRoute ? null : slugFromPath(path);
  const graphFocus = parseGraphPath(path);
  const spec = useSpec();
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

  // With neither a diagram nor a spec page in the address, open the first diagram.
  useEffect(() => {
    if (!specRoute && !slug && graphFocus === undefined && diagrams.length > 0) navigate(diagramPath(diagrams[0].slug), true);
  }, [specRoute, slug, graphFocus, diagrams]);

  const current = diagrams.find((d) => d.slug === slug);

  return (
    <div className="app">
      <nav className="menu" aria-label="Main">
        <p className="brand">Lathe</p>
        <p className="eyebrow">Diagrams</p>
        <ul>
          {diagrams.map((d) => (
            <li key={d.slug}>
              <Link to={diagramPath(d.slug)} aria-current={d.slug === slug ? 'page' : undefined}>
                {d.title}
              </Link>
            </li>
          ))}
        </ul>
        {listError && <p className="error">{listError}</p>}
        <NewDiagram onCreated={async (created) => { await loadDiagrams(); navigate(diagramPath(created.slug)); }} />
        <SpecMenu spec={spec} path={path} />
        <GraphMenu path={path} />
      </nav>
      {graphFocus !== undefined ? (
        <Suspense fallback={<main className="placeholder"><p>Loading the graph…</p></main>}>
          <GraphPage spec={spec} focus={graphFocus} />
        </Suspense>
      ) : specRoute ? (
        <SpecView spec={spec} route={specRoute} />
      ) : current ? (
        <DiagramView key={current.slug} diagram={current} />
      ) : (
        <main className="placeholder">
          <p>{diagrams.length > 0 && slug ? `There's no diagram called "${slug}".` : 'Loading diagrams…'}</p>
        </main>
      )}
    </div>
  );
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
    <main className="diagram">
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
