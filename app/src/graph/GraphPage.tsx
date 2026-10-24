import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
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
  groupLabel,
  groupMarks,
  groupMembers,
  isFiltered,
  isGraphNode,
  kindGroups,
  neighbourhood,
  nextTrail,
  parseGroupId,
  pluralLabel,
  relationsOf,
  summary,
  traceChain,
  type Filters,
  type GraphNode,
  type Neighbourhood,
} from './model';
import { boxExit, layoutNeighbourhood, NODE_HEIGHT, NODE_WIDTH, type Placed } from './layout';
import { GRAPH_ROOT, graphPath } from './route';

// The graph view at /graph/<id> (or /graph/<parent-id>/<kind> for a group): an ego graph
// centred on one record or group. Clicking a record re-centres on it and changes the address, so
// Back walks back along the path; clicking a group opens or closes it.
//
// GraphView is the graph on its own: it takes the focus and an onNavigate callback and never reads
// the address, so it can sit in any pane. GraphPage is the /graph page around it.

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

function Marks({ data }: { data: NodeData }) {
  if (data.errors === 0 && data.warnings === 0 && data.gaps.length === 0) return null;
  const within = data.node.group ? ' among its members' : '';
  return (
    <span className="graph-marks">
      {data.errors > 0 && <span className="graph-mark error" title={`${data.errors} error${data.errors > 1 ? 's' : ''}${within}`} aria-label="has errors">!</span>}
      {data.errors === 0 && data.warnings > 0 && <span className="graph-mark warning" title={`${data.warnings} warning${data.warnings > 1 ? 's' : ''}${within}`} aria-label="has warnings">!</span>}
      {data.gaps.length > 0 && <span className="graph-mark gap" title={data.gaps.map((g) => (g === 'satisfies' ? 'not satisfied' : 'not proved')).join(', ') + within} aria-label="has coverage gaps">gap</span>}
    </span>
  );
}

function GraphNodeView({ data }: NodeProps<FlowNode>) {
  const { node } = data;
  return (
    <div
      className={`graph-node stage-${node.stage || 'structural'} kind-${node.kind}${data.isFocus ? ' is-focus' : ''}`}
      title={`${node.title} (${node.id})`}
    >
      <Handle type="target" position={Position.Left} className="graph-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="graph-handle" isConnectable={false} />
      <small>{data.kindLabel}{node.kind !== FILE_KIND && <> · {node.id}</>}</small>
      <strong>{node.title}</strong>
      <Marks data={data} />
    </div>
  );
}

/** A group: a folder of one kind of child, showing its count, open or folded. */
function GroupNodeView({ data }: NodeProps<FlowNode>) {
  const { node } = data;
  const open = node.group!.open;
  return (
    <div
      className={`graph-node stage-group kind-${node.kind}${open ? ' is-open' : ' is-folded'}${data.isFocus ? ' is-focus' : ''}`}
      title={`${node.title} in ${node.group!.parent} (${open ? 'open' : 'folded'})`}
      data-open={open}
    >
      <Handle type="target" position={Position.Left} className="graph-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="graph-handle" isConnectable={false} />
      <small><span className="graph-group-caret" aria-hidden="true">{open ? '▾' : '▸'}</span> Group · {node.group!.parent}</small>
      <strong>{node.title}</strong>
      <Marks data={data} />
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

const nodeTypes = { record: GraphNodeView, folder: GroupNodeView };
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
  const onNavigate = useCallback((id: string) => navigate(graphPath(id)), []);
  if (!index) {
    return <main className="placeholder"><p>{spec.error ? `Couldn't load the specs: ${spec.error}` : 'Loading specs…'}</p></main>;
  }
  if (focus === null) {
    return <main className="placeholder"><p>{first ? 'Opening the graph…' : <>No products yet. Add a <code>product.md</code> under <code>specs/</code>.</>}</p></main>;
  }
  return <GraphView index={index} focus={focus} onNavigate={onNavigate} />;
}

export interface GraphViewProps {
  index: SpecIndex;
  /** A record ID, or a group as `<parent-id>/<kind>`. */
  focus: string;
  /** Called with a record or group ID when the person moves the centre there. */
  onNavigate: (id: string) => void;
  /** The address a node's link points to, for opening in a new tab. Defaults to its /graph address. */
  hrefFor?: (id: string) => string;
}

/** A link to another centre: a real address for new tabs, onNavigate on a plain click. */
function NodeLink({ id, onNavigate, hrefFor, children, title }: { id: string; onNavigate: (id: string) => void; hrefFor: (id: string) => string; children: ReactNode; title?: string }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(id);
  };
  return <a href={hrefFor(id)} onClick={onClick} title={title}>{children}</a>;
}

/** How a node is named in the trail and lists: its ID, or a group's parent and plural kind. */
const shortName = (index: SpecIndex, id: string) => {
  const g = parseGroupId(id);
  return g && !index.byId.has(id) ? `${g.parent} / ${pluralLabel(index, g.kind)}` : id;
};

export function GraphView({ index, focus, onNavigate, hrefFor = graphPath }: GraphViewProps) {
  const [depth, setDepth] = useState(1);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [trace, setTrace] = useState(false);
  const [trail, setTrail] = useState<string[]>(readTrail);
  // Groups the person opened (true) or closed (false), remembered while walking the graph.
  const [openGroups, setOpenGroups] = useState<ReadonlyMap<string, boolean>>(new Map());

  useEffect(() => {
    if (!isGraphNode(index, focus)) return;
    setTrail((t) => {
      const next = nextTrail(t, focus);
      writeTrail(next);
      return next;
    });
  }, [index, focus]);

  const tracing = trace && canTrace(index, focus);
  const graph = useMemo(
    () => (tracing ? traceChain(index, focus, filters) : neighbourhood(index, focus, depth, filters, openGroups)),
    [index, focus, depth, filters, tracing, openGroups],
  );

  const toggleGroup = useCallback((id: string, nowOpen: boolean) => {
    setOpenGroups((m) => new Map(m).set(id, !nowOpen));
  }, []);

  const clearFilters = useCallback(() => { setFilters(NO_FILTERS); setTrace(false); }, []);
  const onPageKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && (isFiltered(filters) || trace)) { e.preventDefault(); clearFilters(); }
  };

  if (!isGraphNode(index, focus)) {
    return (
      <main className="placeholder">
        <p>There's no record or group <code>{focus}</code>. <Link to={GRAPH_ROOT}>Open the graph</Link>.</p>
      </main>
    );
  }
  const groups = graph.nodes.filter((n) => n.group).length;

  return (
    <main className="graph-page" onKeyDown={onPageKey}>
      <header className="graph-header">
        <nav className="graph-trail" aria-label="Records visited">
          <ol>
            {trail.filter((id) => isGraphNode(index, id)).map((id) => (
              <li key={id}>
                {id === focus
                  ? <span aria-current="page"><code>{shortName(index, id)}</code></span>
                  : <NodeLink id={id} onNavigate={onNavigate} hrefFor={hrefFor} title={index.byId.get(id)?.title ?? groupLabel(index, id)}><code>{shortName(index, id)}</code></NodeLink>}
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
          <span className="graph-count">
            {graph.nodes.length - groups} records{groups > 0 && <> · {groups} group{groups > 1 ? 's' : ''}</>} · {graph.edges.length} links
          </span>
        </div>
      </header>
      <div className="graph-workspace">
        <div className="graph-canvas">
          <ReactFlowProvider>
            <GraphCanvas index={index} graph={graph} onNavigate={onNavigate} onToggle={toggleGroup} />
          </ReactFlowProvider>
        </div>
        {index.byId.has(focus)
          ? <SidePanel index={index} graph={graph} tracing={tracing} recordId={focus} onNavigate={onNavigate} hrefFor={hrefFor} />
          : <GroupPanel index={index} groupId={focus} onNavigate={onNavigate} hrefFor={hrefFor} />}
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

/** Nodes in reading order for the keyboard: column by column (tiers and traces both read left to right), ring by ring for the radial fallback. */
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
      : (a: GraphNode, b: GraphNode) => at(a.id).x - at(b.id).x || at(a.id).y - at(b.id).y;
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

function GraphCanvas({ index, graph, onNavigate, onToggle }: {
  index: SpecIndex;
  graph: Neighbourhood;
  onNavigate: (id: string) => void;
  onToggle: (id: string, nowOpen: boolean) => void;
}) {
  const [placed, setPlaced] = useState<(Placed & { graph: Neighbourhood }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const active = useRef<string | null>(null);
  /** After a keyboard action, the node to put keyboard focus on once the new picture is drawn. */
  const refocus = useRef<string | null>(null);
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
      const isFocus = id === g.focus;
      const base = {
        id,
        position: positions.get(id) ?? { x: 0, y: 0 },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        draggable: false,
        connectable: false,
        selectable: false,
      };
      if (node.group) {
        const marks = groupMarks(index, id);
        return {
          ...base,
          type: 'folder',
          ariaLabel: `Group ${node.title} in ${node.group.parent}, ${node.group.open ? 'open' : 'folded'}${isFocus ? ' (centre)' : ''}`,
          data: { node, kindLabel: 'Group', ...marks, isFocus },
        };
      }
      const problems = node.kind === FILE_KIND ? [] : index.problemsFor.get(id) ?? [];
      const errors = problems.filter((p) => p.severity === 'error').length;
      return {
        ...base,
        type: 'record',
        ariaLabel: `${node.kind === FILE_KIND ? 'File' : kindLabel(index, node.kind)} ${isFocus ? '(centre) ' : ''}${node.title}`,
        data: {
          node,
          kindLabel: node.kind === FILE_KIND ? 'File' : kindLabel(index, node.kind),
          errors,
          warnings: problems.length - errors,
          gaps: node.kind === FILE_KIND ? [] : gapsFor(index, id),
          isFocus,
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

  const fit = useCallback((duration: number) => {
    const box = wrapper.current?.getBoundingClientRect();
    if (placed && box && box.width > 0 && box.height > 0) setViewport(fitPositions(placed.positions, box.width, box.height), { duration });
  }, [placed, setViewport]);

  // Fit the new picture, and after a keyboard action put focus back on the right node.
  useEffect(() => {
    if (!placed) return;
    fit(300);
    if (refocus.current) {
      const id = placed.graph.nodes.some((n) => n.id === refocus.current) ? refocus.current : placed.graph.focus;
      refocus.current = null;
      domNode(id)?.focus();
      active.current = id;
    }
  }, [placed, fit]);

  // Fit again whenever the container changes size (a split pane, full screen, a window resize).
  useEffect(() => {
    const el = wrapper.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = '';
    const observer = new ResizeObserver(() => {
      const box = el.getBoundingClientRect();
      const size = `${Math.round(box.width)}x${Math.round(box.height)}`;
      if (size === last) return;
      last = size;
      fit(0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);

  /** A click or Enter on a node: a group opens or closes, a record becomes the centre. */
  const activate = (id: string, fromKeyboard: boolean) => {
    if (!placed || id.startsWith('file:') || id === placed.graph.focus) return;
    const node = placed.graph.nodes.find((n) => n.id === id);
    if (fromKeyboard) refocus.current = id;
    if (node?.group) onToggle(id, node.group.open);
    else onNavigate(id);
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
      activate(active.current, true);
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
        onNodeClick={(_, n) => activate(n.id, false)}
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

interface PanelLinks {
  onNavigate: (id: string) => void;
  hrefFor: (id: string) => string;
}

function SidePanel({ index, graph, tracing, recordId, onNavigate, hrefFor }: { index: SpecIndex; graph: Neighbourhood; tracing: boolean; recordId: string } & PanelLinks) {
  const record = index.byId.get(recordId)!;
  const problems = [...(index.problemsFor.get(recordId) ?? [])].sort(problemOrder);
  const gaps = gapsFor(index, recordId);
  const text = summary(record.body);
  const near = graph.nodes.filter((n) => n.distance === 1);
  const relationTo = (id: string) => {
    const group = parseGroupId(id);
    if (group && !index.byId.has(id)) return group.parent === recordId ? 'child group' : 'its group';
    if (record.parent === id) return 'parent';
    if (index.byId.get(id)?.parent === recordId) return 'child';
    return graph.edges
      .filter((e) => e.relation !== PARENT && ((e.source === recordId && e.target === id) || (e.target === recordId && e.source === id)))
      .map((e) => (e.source === recordId ? graphRelationLabel(e.relation) : `${graphRelationLabel(e.relation)} this`))
      .join(', ');
  };
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
              <NodeLink id={n.id} onNavigate={onNavigate} hrefFor={hrefFor}>{n.group ? <>{n.title}</> : <><code>{n.id}</code> {n.title}</>}</NodeLink>
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

/** The side panel when a group is the centre: its parent, a summary of its members' problems and gaps, and every member. */
function GroupPanel({ index, groupId, onNavigate, hrefFor }: { index: SpecIndex; groupId: string } & PanelLinks) {
  const { parent, kind } = parseGroupId(groupId)!;
  const parentRecord = index.byId.get(parent)!;
  const members = groupMembers(index, groupId);
  const marks = groupMarks(index, groupId);
  return (
    <aside className="graph-side" aria-label="Focused group">
      <p className="eyebrow">Group</p>
      <h1>{groupLabel(index, groupId)}</h1>
      <p className="record-id">
        {pluralLabel(index, kind)} of <NodeLink id={parent} onNavigate={onNavigate} hrefFor={hrefFor}><code>{parent}</code> {parentRecord.title}</NodeLink>
      </p>
      <p><Link to={recordPath(parent)} className="graph-open">Open parent page</Link></p>
      <h2>Problems and gaps among its members</h2>
      {marks.errors + marks.warnings === 0 && marks.gaps.length === 0 ? <p className="hint">None.</p> : (
        <ul className="graph-problems">
          {marks.errors > 0 && <li className="problem error">{marks.errors} error{marks.errors > 1 ? 's' : ''}</li>}
          {marks.warnings > 0 && <li className="problem warning">{marks.warnings} warning{marks.warnings > 1 ? 's' : ''}</li>}
          {marks.gaps.map((g) => <li key={g} className="graph-gaps">{g === 'satisfies' ? 'Some are not satisfied.' : 'Some are not proved.'}</li>)}
        </ul>
      )}
      <h2>Members <span className="section-count">{members.length}</span></h2>
      <ul className="plain graph-near">
        {members.map((m) => (
          <li key={m.id}><NodeLink id={m.id} onNavigate={onNavigate} hrefFor={hrefFor}><code>{m.id}</code> {m.title}</NodeLink></li>
        ))}
      </ul>
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
        <li><span className="graph-swatch stage-group" /> Group of one kind of child, with its count (▸ folded, ▾ open)</li>
        <li><span className="graph-swatch stage-file" /> File named by a component or test</li>
        <li><span className="graph-line rel-structure" /> parent / child (the tree, through groups)</li>
        <li><span className="graph-line rel-trace" /> satisfies, proves, fulfills</li>
        <li><span className="graph-line rel-design" /> uses, implements, depends on</li>
        <li><span className="graph-line rel-other" /> other links</li>
        <li><span className="graph-mark error">!</span> has errors <span className="graph-mark gap">gap</span> not satisfied or not proved (on a group: among its members)</li>
      </ul>
      <p className="hint">Tiers run left to right: product, domain, aggregates and use cases, rules and requirements, design records, tests. A record with several kinds of child, or many of one kind, reaches them through a group in its own column. A trace also runs left to right, from the rule to the files that build and test it.</p>
      <p className="hint">Click a record, or press Enter on it, to centre the graph there. Click a group, or press Enter on it, to open or close it; centre on a group from the side panel. Arrow keys or Tab move between boxes.</p>
    </section>
  );
}
