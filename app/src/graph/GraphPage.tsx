import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { Link, navigate } from '../router';
import { kindLabel, problemOrder, recordPath, type SpecIndex, type SpecState } from '../specs/data';
import {
  FILE_KIND,
  NO_FILTERS,
  PARENT,
  TRACE_RELATIONS,
  canTrace,
  gapsFor,
  graphRelationLabel,
  isFiltered,
  kindGroups,
  neighbourhood,
  nextTrail,
  relationsOf,
  summary,
  traceChain,
  type Filters,
  type GraphNode,
  type Neighbourhood,
} from './model';
import { boxExit, layoutNeighbourhood, NODE_HEIGHT, NODE_WIDTH, type Placed } from './layout';
import { GRAPH_ROOT, graphPath } from './route';

// The graph view at /graph/<id>: an ego graph centred on one record. Clicking a node re-centres
// on it and changes the address, so Back walks back along the path.

interface NodeData extends Record<string, unknown> {
  node: GraphNode;
  kindLabel: string;
  errors: number;
  warnings: number;
  gaps: string[];
  isFocus: boolean;
}
interface EdgeData extends Record<string, unknown> {
  relation: string;
  points: [{ x: number; y: number }, { x: number; y: number }];
  showLabel: boolean;
}
type FlowNode = Node<NodeData>;
type FlowEdge = Edge<EdgeData>;

/** CSS family for an edge's relation, so related relations share a line style. */
export function relationStyle(relation: string): string {
  if (relation === PARENT) return 'structure';
  if (['satisfies', 'proves', 'fulfills'].includes(relation)) return 'trace';
  if (['uses', 'implements', 'depends_on'].includes(relation)) return 'design';
  if (relation === 'names') return 'file';
  return 'other';
}

function GraphNodeView({ data }: NodeProps<FlowNode>) {
  const { node } = data;
  return (
    <div
      className={`graph-node stage-${node.stage || 'structural'} kind-${node.kind}${data.isFocus ? ' is-focus' : ''}`}
      title={`${node.title} (${node.id})`}
    >
      <Handle type="target" position={Position.Top} className="graph-handle" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} className="graph-handle" isConnectable={false} />
      <small>{data.kindLabel}{node.kind !== FILE_KIND && <> · {node.id}</>}</small>
      <strong>{node.title}</strong>
      {(data.errors > 0 || data.warnings > 0 || data.gaps.length > 0) && (
        <span className="graph-marks">
          {data.errors > 0 && <span className="graph-mark error" title={`${data.errors} error${data.errors > 1 ? 's' : ''}`} aria-label="has errors">!</span>}
          {data.errors === 0 && data.warnings > 0 && <span className="graph-mark warning" title={`${data.warnings} warning${data.warnings > 1 ? 's' : ''}`} aria-label="has warnings">!</span>}
          {data.gaps.length > 0 && <span className="graph-mark gap" title={data.gaps.map((g) => (g === 'satisfies' ? 'not satisfied' : 'not proved')).join(', ')} aria-label="has coverage gaps">gap</span>}
        </span>
      )}
    </div>
  );
}

function GraphEdgeView({ id, data, markerEnd }: EdgeProps<FlowEdge>) {
  if (!data) return null;
  const [a, b] = data.points;
  const path = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={`graph-edge rel-${relationStyle(data.relation)}${data.showLabel || data.relation === PARENT ? '' : ' distant'}`} />
      {data.showLabel && data.relation !== PARENT && (
        <EdgeLabelRenderer>
          <div className="edge-label graph-edge-label" style={{ transform: `translate(-50%, -50%) translate(${(a.x + b.x) / 2}px, ${(a.y + b.y) / 2}px)` }}>
            {graphRelationLabel(data.relation)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { record: GraphNodeView };
const edgeTypes = { link: GraphEdgeView };

const TRAIL_KEY = 'lathe:graph-trail';
function readTrail(): string[] {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(TRAIL_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}
function writeTrail(trail: string[]) {
  try { window.sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail)); } catch { /* storage unavailable */ }
}

/** The page: waits for the workspace, opens the first product for /graph, then shows the graph. */
export default function GraphPage({ spec, focus }: { spec: SpecState; focus: string | null }) {
  const { index } = spec;
  const first = index?.products[0]?.id;
  useEffect(() => {
    if (focus === null && first) navigate(graphPath(first), true);
  }, [focus, first]);
  if (!index) {
    return <main className="placeholder"><p>{spec.error ? `Couldn't load the specs: ${spec.error}` : 'Loading specs…'}</p></main>;
  }
  if (focus === null) {
    return <main className="placeholder"><p>{first ? 'Opening the graph…' : <>No products yet. Add a <code>product.md</code> under <code>specs/</code>.</>}</p></main>;
  }
  return <GraphView index={index} focus={focus} />;
}

export function GraphView({ index, focus }: { index: SpecIndex; focus: string }) {
  const [depth, setDepth] = useState(1);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [trace, setTrace] = useState(false);
  const [trail, setTrail] = useState<string[]>(readTrail);

  useEffect(() => {
    if (!index.byId.has(focus)) return;
    setTrail((t) => {
      const next = nextTrail(t, focus);
      writeTrail(next);
      return next;
    });
  }, [index, focus]);

  const tracing = trace && canTrace(index, focus);
  const graph = useMemo(
    () => (tracing ? traceChain(index, focus, filters) : neighbourhood(index, focus, depth, filters)),
    [index, focus, depth, filters, tracing],
  );

  const clearFilters = useCallback(() => { setFilters(NO_FILTERS); setTrace(false); }, []);
  const onPageKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && (isFiltered(filters) || trace)) { e.preventDefault(); clearFilters(); }
  };

  if (!index.byId.has(focus)) {
    return (
      <main className="placeholder">
        <p>There's no record with the ID <code>{focus}</code>. <Link to={GRAPH_ROOT}>Open the graph</Link>.</p>
      </main>
    );
  }
  const record = index.byId.get(focus)!;

  return (
    <main className="graph-page" onKeyDown={onPageKey}>
      <header className="graph-header">
        <nav className="graph-trail" aria-label="Records visited">
          <ol>
            {trail.filter((id) => index.byId.has(id)).map((id) => (
              <li key={id}>
                {id === focus
                  ? <span aria-current="page"><code>{id}</code></span>
                  : <Link to={graphPath(id)} title={index.byId.get(id)!.title}><code>{id}</code></Link>}
              </li>
            ))}
          </ol>
        </nav>
        <div className="graph-toolbar">
          <div className="graph-depth" role="group" aria-label="Depth">
            <span>Depth</span>
            {[1, 2].map((d) => (
              <button key={d} type="button" aria-pressed={depth === d} disabled={tracing} onClick={() => setDepth(d)}>{d}</button>
            ))}
          </div>
          {canTrace(index, focus) && (
            <label className="graph-trace-toggle">
              <input type="checkbox" checked={trace} onChange={(e) => setTrace(e.target.checked)} />
              Trace mode
            </label>
          )}
          <FilterControls index={index} filters={filters} setFilters={setFilters} />
          <span className="graph-count">{graph.nodes.length} records · {graph.edges.length} links</span>
        </div>
      </header>
      <div className="graph-workspace">
        <div className="graph-canvas">
          <ReactFlowProvider>
            <GraphCanvas index={index} graph={graph} />
          </ReactFlowProvider>
        </div>
        <SidePanel index={index} graph={graph} tracing={tracing} recordId={record.id} />
      </div>
    </main>
  );
}

function FilterControls({ index, filters, setFilters }: { index: SpecIndex; filters: Filters; setFilters: (f: Filters) => void }) {
  const hidden = filters.hiddenKinds.size + filters.hiddenRelations.size;
  const toggle = (set: ReadonlySet<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  };
  const relations = relationsOf(index);
  return (
    <details className="graph-filters">
      <summary>Filters{hidden > 0 && <span className="section-count">{hidden} hidden</span>}</summary>
      <div className="graph-filter-body">
        {kindGroups(index).map((g) => g.kinds.length > 0 && (
          <fieldset key={g.stage || 'structural'}>
            <legend>{g.title}</legend>
            {g.kinds.map((k) => (
              <label key={k.kind}>
                <input
                  type="checkbox"
                  checked={!filters.hiddenKinds.has(k.kind)}
                  onChange={() => setFilters({ ...filters, hiddenKinds: toggle(filters.hiddenKinds, k.kind) })}
                />
                {k.label}
              </label>
            ))}
          </fieldset>
        ))}
        <fieldset>
          <legend>Relations</legend>
          {relations.map((r) => (
            <label key={r}>
              <input
                type="checkbox"
                checked={!filters.hiddenRelations.has(r)}
                onChange={() => setFilters({ ...filters, hiddenRelations: toggle(filters.hiddenRelations, r) })}
              />
              <span className={`graph-line rel-${relationStyle(r)}`} aria-hidden="true" />
              {graphRelationLabel(r)}
            </label>
          ))}
        </fieldset>
        <div className="graph-filter-actions">
          <button type="button" onClick={() => setFilters({ ...filters, hiddenRelations: new Set(relations.filter((r) => !TRACE_RELATIONS.has(r))) })}>
            Only satisfies, proves and fulfills
          </button>
          <button type="button" className="secondary" onClick={() => setFilters(NO_FILTERS)} disabled={hidden === 0}>Clear filters</button>
        </div>
        <p className="hint">Escape clears every filter.</p>
      </div>
    </details>
  );
}

/** Nodes in reading order for the keyboard: row by row for tiers top to bottom, column by column for a trace, ring by ring for the radial fallback. */
function keyboardOrder(graph: Neighbourhood, placed: Placed) {
  const at = (id: string) => placed.positions.get(id) ?? { x: 0, y: 0 };
  const angle = (id: string) => {
    const p = at(id);
    const a = Math.atan2(p.x + NODE_WIDTH / 2, -(p.y + NODE_HEIGHT / 2));
    return a < 0 ? a + 2 * Math.PI : a;
  };
  const compare =
    placed.layout === 'radial'
      ? (a: GraphNode, b: GraphNode) => a.distance - b.distance || angle(a.id) - angle(b.id)
      : graph.mode === 'trace'
        ? (a: GraphNode, b: GraphNode) => at(a.id).x - at(b.id).x || at(a.id).y - at(b.id).y
        : (a: GraphNode, b: GraphNode) => at(a.id).y - at(b.id).y || at(a.id).x - at(b.id).x;
  return [...graph.nodes].sort(compare).map((n) => n.id);
}

/** The viewport that fits every box in the canvas, centred, never zoomed in past 1. */
export function fitPositions(positions: Map<string, { x: number; y: number }>, width: number, height: number, padding = 40) {
  const all = [...positions.values()];
  const minX = Math.min(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxX = Math.max(...all.map((p) => p.x + NODE_WIDTH));
  const maxY = Math.max(...all.map((p) => p.y + NODE_HEIGHT));
  const zoom = Math.max(0.1, Math.min(1, (width - 2 * padding) / (maxX - minX), (height - 2 * padding) / (maxY - minY)));
  return { x: width / 2 - ((minX + maxX) / 2) * zoom, y: height / 2 - ((minY + maxY) / 2) * zoom, zoom };
}

function GraphCanvas({ index, graph }: { index: SpecIndex; graph: Neighbourhood }) {
  const [placed, setPlaced] = useState<(Placed & { graph: Neighbourhood }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const active = useRef<string | null>(null);
  const refocus = useRef(false);
  const { setViewport } = useReactFlow();

  useEffect(() => {
    let live = true;
    layoutNeighbourhood(graph).then(
      (result) => { if (live) { setPlaced({ ...result, graph }); setError(null); } },
      (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); },
    );
    return () => { live = false; };
  }, [graph]);

  const order = useMemo(() => (placed ? keyboardOrder(placed.graph, placed) : []), [placed]);

  const { nodes, edges } = useMemo(() => {
    if (!placed) return { nodes: [] as FlowNode[], edges: [] as FlowEdge[] };
    const { graph: g, positions } = placed;
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    const nodes: FlowNode[] = order.map((id) => {
      const node = byId.get(id)!;
      const problems = node.kind === FILE_KIND ? [] : index.problemsFor.get(id) ?? [];
      const errors = problems.filter((p) => p.severity === 'error').length;
      return {
        id,
        type: 'record',
        position: positions.get(id) ?? { x: 0, y: 0 },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        draggable: false,
        connectable: false,
        selectable: false,
        ariaLabel: `${node.kind === FILE_KIND ? 'File' : kindLabel(index, node.kind)} ${node.id === g.focus ? '(centre) ' : ''}${node.title}`,
        data: {
          node,
          kindLabel: node.kind === FILE_KIND ? 'File' : kindLabel(index, node.kind),
          errors,
          warnings: problems.length - errors,
          gaps: node.kind === FILE_KIND ? [] : gapsFor(index, id),
          isFocus: id === g.focus,
        },
      };
    });
    const centre = (id: string) => {
      const p = positions.get(id) ?? { x: 0, y: 0 };
      return { x: p.x + NODE_WIDTH / 2, y: p.y + NODE_HEIGHT / 2 };
    };
    const edges: FlowEdge[] = g.edges.map((e) => {
      const s = centre(e.source);
      const t = centre(e.target);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'link',
        markerEnd: { type: MarkerType.ArrowClosed },
        focusable: false,
        selectable: false,
        data: {
          relation: e.relation,
          points: [boxExit(s.x, s.y, t.x, t.y), boxExit(t.x, t.y, s.x, s.y)],
          showLabel: e.source === g.focus || e.target === g.focus,
        },
      };
    });
    return { nodes, edges };
  }, [placed, order, index]);

  const domNode = (id: string) =>
    [...(wrapper.current?.querySelectorAll<HTMLElement>('.react-flow__node') ?? [])].find((el) => el.dataset.id === id) ?? null;

  // Fit the new picture, and after a keyboard re-centre put focus on the new centre.
  useEffect(() => {
    if (!placed) return;
    const box = wrapper.current?.getBoundingClientRect();
    if (box && box.width > 0 && box.height > 0) setViewport(fitPositions(placed.positions, box.width, box.height), { duration: 300 });
    if (refocus.current) {
      refocus.current = false;
      domNode(placed.graph.focus)?.focus();
      active.current = placed.graph.focus;
    }
  }, [placed, setViewport]);

  const recentre = (id: string) => {
    if (id.startsWith('file:') || id === placed?.graph.focus) return;
    navigate(graphPath(id));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (order.length === 0) return;
    const current = active.current && order.includes(active.current) ? order.indexOf(active.current) : -1;
    const move = (step: number) => {
      e.preventDefault();
      const next = order[(current + step + order.length) % order.length];
      active.current = next;
      domNode(next)?.focus();
    };
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(current < 0 ? 0 : -1);
    else if (e.key === 'Enter' && active.current) {
      e.preventDefault();
      refocus.current = true;
      recentre(active.current);
    }
  };

  if (error) return <p className="error">Couldn't draw the graph: {error}</p>;
  return (
    <div
      ref={wrapper}
      className="graph-flow"
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        const id = (e.target as HTMLElement).closest?.('.react-flow__node')?.getAttribute('data-id');
        if (id) active.current = id;
      }}
    >
      {!placed && <p className="hint graph-loading">Laying out the graph…</p>}
      {placed?.layout === 'radial' && placed.cycle && (
        <p className="graph-notice" role="status">
          Drawn around the centre instead of in tiers: {placed.cycle.join(' → ')} → {placed.cycle[0]} link in a circle within one tier.
        </p>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        onNodeClick={(_, n) => recentre(n.id)}
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function SidePanel({ index, graph, tracing, recordId }: { index: SpecIndex; graph: Neighbourhood; tracing: boolean; recordId: string }) {
  const record = index.byId.get(recordId)!;
  const problems = [...(index.problemsFor.get(recordId) ?? [])].sort(problemOrder);
  const gaps = gapsFor(index, recordId);
  const text = summary(record.body);
  const near = graph.nodes.filter((n) => n.distance === 1);
  const relationTo = (id: string) =>
    graph.edges
      .filter((e) => (e.source === recordId && e.target === id) || (e.target === recordId && e.source === id))
      .map((e) => {
        if (e.relation === PARENT) return e.source === recordId ? 'child' : 'parent';
        return e.source === recordId ? graphRelationLabel(e.relation) : `${graphRelationLabel(e.relation)} this`;
      })
      .join(', ');
  const files = graph.nodes.filter((n) => n.kind === FILE_KIND);
  return (
    <aside className="graph-side" aria-label="Focused record">
      <p className="eyebrow">{kindLabel(index, record.kind)}</p>
      <h1>{record.title}</h1>
      <p className="record-id"><code>{record.id}</code></p>
      {text ? <p className="graph-summary">{text}</p> : <p className="hint">No body text.</p>}
      <p><Link to={recordPath(record.id)} className="graph-open">Open page</Link></p>
      <h2>Problems <span className="section-count">{problems.length}</span></h2>
      {problems.length === 0 ? <p className="hint">No problems.</p> : (
        <ul className="graph-problems">
          {problems.map((p, i) => <li key={i} className={`problem ${p.severity}`}><span className="severity">{p.severity}</span> {p.message}</li>)}
        </ul>
      )}
      {(record.kind === 'requirement' || record.kind === 'domain_rule') && (
        <>
          <h2>Coverage gaps <span className="section-count">{gaps.length}</span></h2>
          {gaps.length === 0 ? <p className="hint">Satisfied and proved.</p> : (
            <ul className="graph-gaps">
              {gaps.map((g) => <li key={g}>{g === 'satisfies' ? 'No component satisfies it.' : 'No test proves it.'}</li>)}
            </ul>
          )}
        </>
      )}
      <h2>{tracing ? 'Traceability chain' : 'Connected records'} <span className="section-count">{near.length}</span></h2>
      {near.length === 0 ? <p className="hint">{tracing ? 'Nothing fulfills, satisfies or proves it yet.' : 'Nothing connected (check the filters).'}</p> : (
        <ul className="plain graph-near">
          {near.map((n) => (
            <li key={n.id}>
              <Link to={graphPath(n.id)}><code>{n.id}</code> {n.title}</Link>
              <small className="meta"> {relationTo(n.id)}</small>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <>
          <h2>Files <span className="section-count">{files.length}</span></h2>
          <ul className="plain">{files.map((f) => <li key={f.id}><code>{f.title}</code></li>)}</ul>
        </>
      )}
      <Legend />
    </aside>
  );
}

function Legend() {
  return (
    <section className="graph-legend" aria-label="Legend">
      <h2>Legend</h2>
      <ul className="plain">
        <li><span className="graph-swatch stage-define" /> Define (aggregate, rule, use case, requirement)</li>
        <li><span className="graph-swatch stage-design" /> Design (flow, view, endpoint, component, test)</li>
        <li><span className="graph-swatch stage-structural" /> Structural (product, domain, question)</li>
        <li><span className="graph-swatch stage-file" /> File named by a component or test</li>
        <li><span className="graph-line rel-structure" /> parent / child (the tree)</li>
        <li><span className="graph-line rel-trace" /> satisfies, proves, fulfills</li>
        <li><span className="graph-line rel-design" /> uses, implements, depends on</li>
        <li><span className="graph-line rel-other" /> other links</li>
        <li><span className="graph-mark error">!</span> has errors <span className="graph-mark gap">gap</span> not satisfied or not proved</li>
      </ul>
      <p className="hint">Tiers run top to bottom: product, domain, aggregates and use cases, rules and requirements, design records, tests. A trace runs left to right from the rule to the files that build and test it.</p>
      <p className="hint">Click a box, or press Enter on it, to centre the graph there. Arrow keys or Tab move between boxes.</p>
    </section>
  );
}
