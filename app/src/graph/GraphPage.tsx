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
import { kindLabel, type SpecIndex } from '../specs/data';
import { useCommand } from '../shell/commands';
import { Tooltip } from '../shell/Tooltip';
import { NodeLink, type GraphInfo } from './panel';
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
  isFiltered,
  isGraphNode,
  kindGroups,
  neighbourhood,
  nextTrail,
  parseGroupId,
  pluralLabel,
  relationsOf,
  traceChain,
  type Filters,
  type GraphNode,
  type Neighbourhood,
} from './model';
import { boxExit, layoutNeighbourhood, NODE_HEIGHT, NODE_WIDTH, type Placed } from './layout';

// The graph view: an ego graph centred on one record or group. Clicking a record re-centres on it
// (through onNavigate, so the host changes the address and Back walks back along the path);
// clicking a group opens or closes it.
//
// GraphView is the graph on its own: it takes the focus and an onNavigate callback and never reads
// the address, so it can sit in any pane. The focus page (app/src/views/FocusPage.tsx) hosts it in
// the Graph and Split views, keeps its settings across pages, and shows what it connects in the
// inspector.

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
  if (relation === 'follows') return 'pattern';
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

/** What the person set on the graph: depth, filters, trace mode, and the groups they opened or closed. */
export interface GraphSettings {
  depth: number;
  filters: Filters;
  trace: boolean;
  openGroups: ReadonlyMap<string, boolean>;
}
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = { depth: 1, filters: NO_FILTERS, trace: false, openGroups: new Map() };

export interface GraphViewProps {
  index: SpecIndex;
  /** A record ID, or a group as `<parent-id>/<kind>`. */
  focus: string;
  /** Called with a record or group ID when the person moves the centre there. */
  onNavigate: (id: string) => void;
  /** The address a node's link points to, for opening in a new tab. */
  hrefFor: (id: string) => string;
  /** The settings, when the host keeps them (so they survive moving between pages and views). */
  settings?: GraphSettings;
  onSettingsChange?: (settings: GraphSettings) => void;
  /** Called with the drawn graph, so the host's inspector can list what it connects. */
  onGraph?: (info: GraphInfo) => void;
}

/** How a node is named in the trail and lists: its ID, or a group's parent and plural kind. */
const shortName = (index: SpecIndex, id: string) => {
  const g = parseGroupId(id);
  return g && !index.byId.has(id) ? `${g.parent} / ${pluralLabel(index, g.kind)}` : id;
};

export function GraphView({ index, focus, onNavigate, hrefFor, settings: hosted, onSettingsChange, onGraph }: GraphViewProps) {
  const [own, setOwn] = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const settings = hosted ?? own;
  const { depth, filters, trace, openGroups } = settings;
  const latest = useRef(settings);
  latest.current = settings;
  const update = useCallback((patch: Partial<GraphSettings>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    if (onSettingsChange) onSettingsChange(next); else setOwn(next);
  }, [onSettingsChange]);
  const setDepth = (d: number) => update({ depth: d });
  const setFilters = (f: Filters) => update({ filters: f });
  const setTrace = (t: boolean) => update({ trace: t });
  const [trail, setTrail] = useState<string[]>(readTrail);

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
  useEffect(() => { onGraph?.({ graph, tracing }); }, [graph, tracing, onGraph]);

  const toggleGroup = useCallback((id: string, nowOpen: boolean) => {
    update({ openGroups: new Map(latest.current.openGroups).set(id, !nowOpen) });
  }, [update]);

  const clearFilters = useCallback(() => update({ filters: NO_FILTERS, trace: false }), [update]);
  const onPageKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && (isFiltered(filters) || trace)) { e.preventDefault(); clearFilters(); }
  };
  const valid = isGraphNode(index, focus);
  useCommand('graphDepthUp', () => update({ depth: 2 }), valid && !tracing);
  useCommand('graphDepthDown', () => update({ depth: 1 }), valid && !tracing);
  useCommand('graphTrace', () => update({ trace: !latest.current.trace }), valid && canTrace(index, focus));

  if (!valid) {
    return (
      <div className="placeholder graph-missing">
        <p>There's no record or group <code>{focus}</code>.</p>
      </div>
    );
  }
  const groups = graph.nodes.filter((n) => n.group).length;

  return (
    <section className="graph-page" aria-label="Graph" onKeyDown={onPageKey}>
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
              <Tooltip key={d} label={d === 1 ? 'Less depth' : 'More depth'} command={d === 1 ? 'graphDepthDown' : 'graphDepthUp'}>
                <button type="button" aria-pressed={depth === d} disabled={tracing} onClick={() => setDepth(d)}>{d}</button>
              </Tooltip>
            ))}
          </div>
          {canTrace(index, focus) && (
            <label className="graph-trace-toggle">
              <Tooltip label="Trace mode on or off" command="graphTrace">
                <input type="checkbox" checked={trace} onChange={(e) => setTrace(e.target.checked)} />
              </Tooltip>
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
      </div>
    </section>
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

  useCommand('graphFit', () => fit(300), !!placed);
  useCommand('graphToggleGroup', () => {
    const id = active.current;
    const node = id ? placed?.graph.nodes.find((n) => n.id === id) : undefined;
    if (node?.group && id) { refocus.current = id; onToggle(id, node.group.open); }
  }, !!placed);

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

