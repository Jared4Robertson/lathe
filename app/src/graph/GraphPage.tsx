import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
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
import { Icon } from '../components/icons';
import { NodeLink, type GraphInfo } from './panel';
import { TapCard, useTapToOpen } from './touch';
import {
  FILE_KIND,
  NO_FILTERS,
  PARENT,
  TRACE_RELATIONS,
  canTrace,
  gapsFor,
  graphRelationLabel,
  groupName,
  groupMarks,
  isFiltered,
  isGraphNode,
  kindGroups,
  neighborhood,
  nextTrail,
  parseGroupId,
  relationsOf,
  traceChain,
  type Filters,
  type GraphNode,
  type Neighborhood,
} from './model';
import { layoutNeighborhood, NODE_HEIGHT, NODE_WIDTH, type Placed } from './layout';
import { anchorLayout, fadeSets, frameFocus } from './camera';
import { edgeMove, readMotion, transitionProgress, tweenEdge, type EdgeEnds, type EdgeFrame, type EdgePhase } from './motion';

// The graph view: an ego graph centered on one record or group. Clicking a record or a group
// re-centers on it (through onNavigate, so the host changes the address and Back walks back along
// the path); a group's chevron opens or closes it in place.
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
  /** A group's open-or-fold action, from its chevron (records have none). */
  onToggle?: () => void;
}
interface EdgeData extends Record<string, unknown> {
  relation: string;
  /** The centers of the two boxes it joins, in the picture now drawn. */
  ends: EdgeEnds;
  /** Whether it was in the last picture, is new, or is leaving (fading out until the move ends). */
  phase: EdgePhase;
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
      <small>Group · {node.group!.parent}</small>
      <strong>{node.title}</strong>
      <Marks data={data} />
      {/* Clicking the group goes to it; its chevron opens or folds it in place. The center group is always open. */}
      {data.onToggle && (
        <button
          type="button"
          className="graph-group-chevron nodrag nopan"
          aria-expanded={open}
          aria-label={`${open ? 'Fold' : 'Open'} ${node.title} in place`}
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); data.onToggle!(); }}
        >
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
        </button>
      )}
    </div>
  );
}

/** The ID prefix of a record fading out of the picture. */
const LEAVING = 'leaving:';

const NO_ENDS: EdgeEnds = { source: { x: 0, y: 0 }, target: { x: 0, y: 0 } };
const sameEnds = (a: EdgeEnds, b: EdgeEnds) =>
  a.source.x === b.source.x && a.source.y === b.source.y && a.target.x === b.target.x && a.target.y === b.target.y;

const linePath = ([a, b]: [{ x: number; y: number }, { x: number; y: number }]) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
const labelTransform = ([a, b]: [{ x: number; y: number }, { x: number; y: number }]) =>
  `translate(-50%, -50%) translate(${(a.x + b.x) / 2}px, ${(a.y + b.y) / 2}px)`;

/** What an edge draws on: its group, its line and its label, found when it paints a frame. */
interface EdgeParts {
  /** The edge's group, the line and the label, as drawn now. */
  group: SVGGElement | null;
  label: HTMLDivElement | null;
  /** The node boxes it joins, whose transition it follows. */
  nodes: () => (Element | null)[];
}

/** Writes one frame straight to the edge's elements, so it shows in the same frame as the nodes' move (a React render would come a frame late). */
function paintEdge(parts: EdgeParts, frame: EdgeFrame) {
  if (parts.group) {
    parts.group.style.opacity = String(frame.opacity);
    parts.group.querySelector('path.react-flow__edge-path')?.setAttribute('d', linePath(frame.points));
  }
  if (parts.label) {
    parts.label.style.opacity = String(frame.opacity);
    parts.label.style.transform = labelTransform(frame.points);
  }
}

/**
 * Where an edge is drawn, frame by frame. When its boxes move (the graph re-centers) it tweens from
 * where it was drawn to where it goes, with the shared motion (LA-PAT-APP-CODE-R12): the same
 * duration and easing as the nodes' transform transition, and on the nodes' own transition clock,
 * so its ends stay on the boxes. A new edge fades in and a leaving one fades out over the same
 * time. Under reduced motion it jumps.
 */
function useEdgeFrame(ends: EdgeEnds, phase: EdgePhase, parts: EdgeParts): EdgeFrame {
  const [frame, setFrame] = useState<EdgeFrame>(() => {
    const { from } = edgeMove(phase, ends, null);
    return tweenEdge(from, from, 1);
  });
  const drawn = useRef<EdgeFrame | null>(null);
  const key = `${ends.source.x} ${ends.source.y} ${ends.target.x} ${ends.target.y} ${phase}`;
  useLayoutEffect(() => {
    const { from, to } = edgeMove(phase, ends, drawn.current);
    const motion = readMotion();
    const settle = (f: EdgeFrame) => { drawn.current = f; setFrame(f); };
    if (motion.duration === 0 || (sameEnds(from.ends, to.ends) && from.opacity === to.opacity)) {
      settle(tweenEdge(to, to, 1));
      return;
    }
    drawn.current = tweenEdge(from, from, 1);
    const start = performance.now();
    let raf = 0;
    let synced = false;
    const step = () => {
      // Follow the nodes' own transition when one of them is moving; once it has ended, so has the move.
      const clock = transitionProgress(parts.nodes(), motion.duration);
      if (clock !== null) synced = true;
      const t = clock ?? (synced ? 1 : Math.min(1, Math.max(0, (performance.now() - start) / motion.duration)));
      const f = tweenEdge(from, to, t, motion.ease);
      drawn.current = f;
      paintEdge(parts, f);
      if (t < 1) raf = requestAnimationFrame(step);
      else setFrame(f);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // The key stands for ends and phase: the move restarts only when where it goes changes.
  }, [key]);
  return frame;
}

function GraphEdgeView({ id, data, markerEnd, source, target }: EdgeProps<FlowEdge>) {
  const group = useRef<SVGGElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const parts: EdgeParts = {
    get group() { return group.current; },
    get label() { return label.current; },
    nodes: () => {
      const flow = group.current?.closest('.react-flow');
      const node = (nodeId: string) => [...(flow?.querySelectorAll<HTMLElement>('.react-flow__node') ?? [])].find((el) => el.dataset.id === nodeId) ?? null;
      return [node(source), node(target)];
    },
  };
  const frame = useEdgeFrame(data?.ends ?? NO_ENDS, data?.phase ?? 'persist', parts);
  if (!data) return null;
  return (
    <g ref={group} className="graph-edge-motion" style={{ opacity: frame.opacity }} data-phase={data.phase}>
      <BaseEdge id={id} path={linePath(frame.points)} markerEnd={markerEnd} interactionWidth={0} className={`graph-edge rel-${relationStyle(data.relation)}${data.showLabel || data.relation === PARENT ? '' : ' distant'}`} />
      {data.showLabel && data.relation !== PARENT && (
        <EdgeLabelRenderer>
          <div ref={label} className="edge-label graph-edge-label" style={{ opacity: frame.opacity, transform: labelTransform(frame.points) }}>
            {graphRelationLabel(data.relation)}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}

/** Where each node's two handles are: the middle of its left and right sides. */
const NODE_HANDLES = [
  { type: 'target' as const, position: Position.Left, x: 0, y: NODE_HEIGHT / 2, width: 1, height: 1 },
  { type: 'source' as const, position: Position.Right, x: NODE_WIDTH, y: NODE_HEIGHT / 2, width: 1, height: 1 },
];

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
/** Depth 1 is the tree around the focus (parent and children); each depth after it walks one more hop of links. */
/** "1 record", "2 records". */
const count = (n: number, noun: string) => `${n} ${n === 1 ? noun : `${noun}s`}`;

export const MAX_DEPTH = 3;
const DEPTHS = [1, 2, 3];
const DEPTH_LABELS = ['Parent and children only', 'Plus links one step away', 'Plus links two steps away'];
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = { depth: 1, filters: NO_FILTERS, trace: false, openGroups: new Map() };

export interface GraphViewProps {
  index: SpecIndex;
  /** A record ID, or a group as `<parent-id>/<kind>`. */
  focus: string;
  /** Called with a record or group ID when the person moves the center there. */
  onNavigate: (id: string) => void;
  /** The address a node's link points to, for opening in a new tab. */
  hrefFor: (id: string) => string;
  /** The settings, when the host keeps them (so they survive moving between pages and views). */
  settings?: GraphSettings;
  onSettingsChange?: (settings: GraphSettings) => void;
  /** Called with the drawn graph, so the host's inspector can list what it connects. */
  onGraph?: (info: GraphInfo) => void;
}

/**
 * How a node is named in the trail: a record's title with its ID in parentheses, "Browsing
 * (LA-BRW)"; a group, which has no ID of its own, by its name alone ("Use cases", no count), with
 * its parent's ID in the full text (tooltip and accessible name) so two groups of one name differ.
 */
function trailItem(index: SpecIndex, id: string): { body: ReactNode; full: string } {
  const record = index.byId.get(id);
  if (record) {
    return {
      body: <><span className="trail-name">{record.title}</span> <code className="trail-id">({id})</code></>,
      full: `${record.title} (${id})`,
    };
  }
  const name = groupName(index, id);
  return { body: <span className="trail-name">{name}</span>, full: `${name} of ${parseGroupId(id)!.parent}` };
}

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
    () => (tracing ? traceChain(index, focus, filters) : neighborhood(index, focus, depth, filters, openGroups)),
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
  useCommand('graphDepthUp', () => update({ depth: Math.min(MAX_DEPTH, latest.current.depth + 1) }), valid && !tracing);
  useCommand('graphDepthDown', () => update({ depth: Math.max(1, latest.current.depth - 1) }), valid && !tracing);
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
            {trail.filter((id) => isGraphNode(index, id)).map((id) => {
              const item = trailItem(index, id);
              return (
                <li key={id}>
                  {id === focus
                    ? <span className="trail-item" aria-current="page" title={item.full} aria-label={item.full}>{item.body}</span>
                    : <NodeLink id={id} onNavigate={onNavigate} hrefFor={hrefFor} title={item.full} ariaLabel={item.full} className="trail-item">{item.body}</NodeLink>}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="graph-toolbar">
          <div className="graph-depth" role="group" aria-label="Depth">
            <span>Depth</span>
            {DEPTHS.map((d) => (
              <Tooltip key={d} label={DEPTH_LABELS[d - 1]} command={d === depth + 1 ? 'graphDepthUp' : d === depth - 1 ? 'graphDepthDown' : undefined}>
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
            {count(graph.nodes.length - groups, 'record')}{groups > 0 && <> · {count(groups, 'group')}</>} · {count(graph.edges.length, 'link')}
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
function keyboardOrder(graph: Neighborhood, placed: Placed) {
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

/** The viewport that fits every box in the canvas, centered, never zoomed in past 1. */
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
  graph: Neighborhood;
  onNavigate: (id: string) => void;
  onToggle: (id: string, nowOpen: boolean) => void;
}) {
  const [placed, setPlaced] = useState<(Placed & { graph: Neighborhood }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const active = useRef<string | null>(null);
  /** After a keyboard action, the node to put keyboard focus on once the new picture is drawn. */
  const refocus = useRef<string | null>(null);
  const { setViewport } = useReactFlow();
  /** The positions last laid out, in world coordinates, so the next picture can anchor on its focus. */
  const laidOut = useRef<Map<string, { x: number; y: number }> | null>(null);

  useEffect(() => {
    let live = true;
    layoutNeighborhood(graph).then(
      (result) => {
        if (!live) return;
        // The new focus keeps its place in the world when it was in the last picture (LA-BRW-DR180).
        const positions = anchorLayout(result.positions, graph.focus, laidOut.current);
        laidOut.current = positions;
        setPlaced({ ...result, positions, graph });
        setError(null);
      },
      (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); },
    );
    return () => { live = false; };
  }, [graph]);

  const order = useMemo(() => (placed ? keyboardOrder(placed.graph, placed) : []), [placed]);

  /** The edges last drawn, so the next picture knows which edges persist, which are new and which leave. */
  const shown = useRef<FlowEdge[]>([]);
  /** The nodes last drawn (leaving ones included), so the next picture knows which records enter and which leave. */
  const shownNodes = useRef<FlowNode[] | null>(null);
  const drewPicture = useRef(false);
  const { nodes, edges, leaving, leavingNodes } = useMemo(() => {
    if (!placed) return { nodes: [] as FlowNode[], edges: [] as FlowEdge[], leaving: [] as FlowEdge[], leavingNodes: [] as FlowNode[] };
    const { graph: g, positions } = placed;
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    const reduced = readMotion().reduced;
    // Records new to the picture fade in at their place; records that left fade out where they were.
    const drawnBefore = shownNodes.current?.filter((n) => !n.id.startsWith(LEAVING)) ?? null;
    const fades = fadeSets(drawnBefore?.map((n) => n.id) ?? null, g.nodes.map((n) => n.id));
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
        // Saying where the handles are means React Flow never has to measure a node again when the
        // picture changes; while it measured, every edge was dropped for a frame and drawn anew, so
        // nothing could carry it from its old place to its new one.
        handles: NODE_HANDLES,
        ...(fades.entering.has(id) && !reduced ? { className: 'is-entering' } : {}),
      };
      if (node.group) {
        const marks = groupMarks(index, id);
        return {
          ...base,
          type: 'folder',
          ariaLabel: `Group ${node.title} in ${node.group.parent}, ${node.group.open ? 'open' : 'folded'}${isFocus ? ' (center)' : ''}`,
          data: { node, kindLabel: 'Group', ...marks, isFocus, onToggle: isFocus ? undefined : () => onToggle(id, node.group!.open) },
        };
      }
      const problems = node.kind === FILE_KIND ? [] : index.problemsFor.get(id) ?? [];
      const errors = problems.filter((p) => p.severity === 'error').length;
      return {
        ...base,
        type: 'record',
        ariaLabel: `${node.kind === FILE_KIND ? 'File' : kindLabel(index, node.kind)} ${isFocus ? '(center) ' : ''}${node.title}`,
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
    const center = (id: string) => {
      const p = positions.get(id) ?? { x: 0, y: 0 };
      return { x: p.x + NODE_WIDTH / 2, y: p.y + NODE_HEIGHT / 2 };
    };
    // Edges in the last picture keep moving with their boxes; new ones fade in (not on the first
    // picture, which appears at once); edges that are gone fade out where their boxes go, or stay,
    // until the move is over. A leaving edge is drawn from its own ends, so it is hung on boxes that
    // are still in the picture to keep React Flow drawing it.
    const before = new Map(shown.current.map((e) => [e.id, e]));
    const hadPicture = drewPicture.current;
    const edges: FlowEdge[] = g.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'link',
      markerEnd: { type: MarkerType.ArrowClosed },
      focusable: false,
      selectable: false,
      data: {
        relation: e.relation,
        ends: { source: center(e.source), target: center(e.target) },
        phase: hadPicture && !before.has(e.id) ? 'enter' : 'persist',
        showLabel: e.source === g.focus || e.target === g.focus,
      },
    }));
    const now = new Set(edges.map((e) => e.id));
    const leaving: FlowEdge[] = reduced ? [] : [...before.values()].filter((e) => !now.has(e.id) && e.data).map((e) => {
      if (e.data!.phase === 'leave') return e; // already fading out from the picture before
      const keep = (id: string, old: { x: number; y: number }) => (positions.has(id) ? center(id) : old);
      return {
        ...e,
        source: positions.has(e.source) ? e.source : g.focus,
        target: positions.has(e.target) ? e.target : g.focus,
        data: { ...e.data!, phase: 'leave', ends: { source: keep(e.source, e.data!.ends.source), target: keep(e.target, e.data!.ends.target) } },
      };
    });
    // A leaving record is drawn under its own ID, so it is never taken for the record (which may come back), and can't be clicked or focused.
    const stillLeaving = (shownNodes.current ?? []).filter((n) => n.id.startsWith(LEAVING) && !byId.has(n.id.slice(LEAVING.length)));
    const leavingNodes: FlowNode[] = reduced ? [] : [
      ...stillLeaving,
      ...(drawnBefore ?? []).filter((n) => fades.leaving.has(n.id)).map((n) => ({
        ...n,
        id: LEAVING + n.id,
        className: 'is-leaving',
        focusable: false,
        ariaLabel: undefined,
        domAttributes: { 'aria-hidden': true },
      })),
    ];
    return { nodes, edges, leaving, leavingNodes };
    // `shown` and `shownNodes` are read, not watched: they are the picture drawn before this one.
  }, [placed, order, index]);

  // Leaving edges are dropped once they have faded out.
  const [settled, setSettled] = useState<object | null>(null);
  useEffect(() => {
    if (leaving.length === 0 && leavingNodes.length === 0) return;
    const timer = setTimeout(() => setSettled(leaving), readMotion().duration);
    return () => clearTimeout(timer);
  }, [leaving, leavingNodes]);
  const faded = settled === leaving;
  const drawnEdges = useMemo(() => (faded || leaving.length === 0 ? edges : [...edges, ...leaving]), [edges, leaving, faded]);
  const drawnNodes = useMemo(() => (faded || leavingNodes.length === 0 ? nodes : [...nodes, ...leavingNodes]), [nodes, leavingNodes, faded]);
  useEffect(() => {
    shown.current = drawnEdges;
    if (placed) {
      shownNodes.current = drawnNodes;
      drewPicture.current = true;
    }
  }, [drawnEdges, drawnNodes, placed]);

  const domNode = (id: string) =>
    [...(wrapper.current?.querySelectorAll<HTMLElement>('.react-flow__node') ?? [])].find((el) => el.dataset.id === id) ?? null;

  /**
   * Moves the camera: to frame the focus (a new picture, or a resize), or to fit the whole picture
   * (the Fit command); with the shared motion, or at once. It always starts from the view as it is,
   * so a view zoomed or panned by hand glides from there (LA-BRW-DR181).
   */
  const fit = useCallback((animate: boolean, whole = false) => {
    const box = wrapper.current?.getBoundingClientRect();
    if (!placed || !box || box.width <= 0 || box.height <= 0) return;
    const motion = readMotion();
    const view = whole ? fitPositions(placed.positions, box.width, box.height) : frameFocus(placed.positions, placed.graph.focus, box.width, box.height);
    setViewport(view, animate && motion.duration > 0 ? { duration: motion.duration, ease: motion.ease, interpolate: 'linear' } : { duration: 0 });
  }, [placed, setViewport]);

  // Frame the new picture's focus, starting with the nodes' move and lasting as long (the first
  // picture appears at once), and after a keyboard action put focus back on the right node.
  const framed = useRef(false);
  useLayoutEffect(() => {
    if (!placed) return;
    fit(framed.current);
    framed.current = true;
    if (refocus.current) {
      const id = placed.graph.nodes.some((n) => n.id === refocus.current) ? refocus.current : placed.graph.focus;
      refocus.current = null;
      domNode(id)?.focus();
      active.current = id;
    }
  }, [placed, fit]);

  // Frame again whenever the container changes size (a split pane, full screen, a window resize).
  // It observes once, for the canvas's life: observing anew with each picture would report the
  // size again and cut the camera's glide short.
  const latestFit = useRef(fit);
  latestFit.current = fit;
  useEffect(() => {
    const el = wrapper.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = '';
    const observer = new ResizeObserver(() => {
      const box = el.getBoundingClientRect();
      const size = `${Math.round(box.width)}x${Math.round(box.height)}`;
      if (size === last) return;
      last = size;
      latestFit.current(false);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useCommand('graphFit', () => fit(true, true), !!placed);
  /** Opens or folds a group in place, keeping keyboard focus on it (its chevron, or o). The center group stays open. */
  const toggle = (id: string) => {
    const node = placed?.graph.nodes.find((n) => n.id === id);
    if (!node?.group || id === placed?.graph.focus) return;
    refocus.current = id;
    onToggle(id, node.group.open);
  };
  useCommand('graphToggleGroup', () => { if (active.current) toggle(active.current); }, !!placed);

  /** A click or Enter on a node, record or group: it becomes the center, at its own address. */
  const activate = (id: string, fromKeyboard: boolean) => {
    if (!placed || id.startsWith('file:') || id.startsWith(LEAVING) || id === placed.graph.focus) return;
    if (fromKeyboard) refocus.current = id;
    onNavigate(id);
  };
  // By touch, a first tap selects a node and a second tap (or the card's Open chip) opens it.
  const canOpen = useCallback((id: string) => !!placed && !id.startsWith('file:') && !id.startsWith(LEAVING) && id !== placed.graph.focus, [placed]);
  const tap = useTapToOpen(onNavigate, canOpen, wrapper, graph.focus);
  const armedNode = tap.armed ? placed?.graph.nodes.find((n) => n.id === tap.armed) : undefined;

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
          Drawn around the center instead of in tiers: {placed.cycle.join(' → ')} → {placed.cycle[0]} link in a circle within one tier.
        </p>
      )}
      <ReactFlow
        nodes={drawnNodes}
        edges={drawnEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        onNodeClick={(e, n) => tap.onNodeClick(e, n.id)}
        onPaneClick={tap.clear}
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {armedNode && (
        <TapCard
          kind={armedNode.group ? 'Group' : kindLabel(index, armedNode.kind)}
          name={armedNode.title}
          onOpen={tap.openArmed}
          onDismiss={tap.clear}
        />
      )}
    </div>
  );
}

