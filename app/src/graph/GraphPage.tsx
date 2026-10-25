import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
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
import { lowerLabel } from '../plural';
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
  graphEdgeLabel,
  graphRelationLabel,
  groupName,
  groupMarks,
  isFiltered,
  isGraphNode,
  kindGroups,
  neighborhood,
  nextTrail,
  nodeChildren,
  nodeParent,
  parseGroupId,
  relationsOf,
  traceChain,
  type Filters,
  type GraphNode,
  type Neighborhood,
} from './model';
import { layoutNeighborhood, NODE_HEIGHT, NODE_WIDTH, type Placed } from './layout';
import { anchorLayout, fadeSets, frameFocus } from './camera';
import { EdgeHints } from './hints';
import { canvasProgress, edgeMove, readMotion, tweenEdge, type EdgeEnds, type EdgeFrame, type EdgePhase } from './motion';
import { Button } from '../components/Button';

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
  /** A box that left the picture and fades out where it was: it can't be clicked or focused. */
  leaving?: boolean;
}
interface EdgeData extends Record<string, unknown> {
  relation: string;
  /** The centers of the two boxes it joins, in the picture now drawn. */
  ends: EdgeEnds;
  /** Whether it was in the last picture, is new, or is leaving (fading out until the move ends). */
  phase: EdgePhase;
  showLabel: boolean;
  /** The words drawn on the edge: its relation's label, read from its source. */
  label: string;
  /** To or between context nodes: faded and thinner. */
  context: boolean;
  /** A cross-link added by the Links switch: dashed, in its own color. */
  link: boolean;
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
  // A domain event's links (LA-BRW-UC40-R07): dashed, in the spark colors events are drawn in.
  if (['reacts_to', 'raised_by'].includes(relation)) return 'event';
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

/** A context node's quiet title: short, cut at a word; the whole title and the ID are in its tooltip (LA-BRW-DR302). */
export function shortTitle(title: string, max = 28): string {
  if (title.length <= max) return title;
  const cut = title.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function GraphNodeView({ data }: NodeProps<FlowNode>) {
  const { node } = data;
  // A context node is quiet: its kind and a short title; its ID and full title show on hover.
  const quiet = node.context === true;
  return (
    <div
      className={`graph-node stage-${node.stage || 'structural'} kind-${node.kind}${data.isFocus ? ' is-focus' : ''}`}
      title={`${node.title} (${node.id})`}
    >
      <Handle type="target" position={Position.Left} className="graph-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="graph-handle" isConnectable={false} />
      <small>{data.kindLabel}{node.kind !== FILE_KIND && !quiet && <> · {node.id}</>}</small>
      <strong>{quiet ? shortTitle(node.title) : node.title}</strong>
      <Marks data={data} />
    </div>
  );
}

/** A chip of the light ring: "+12 more use cases", a context node that re-centers on their folder. */
function MoreNodeView({ data }: NodeProps<FlowNode>) {
  const { node } = data;
  return (
    <div className="graph-node stage-more" title={`${node.title}: center on ${node.more!.target}`}>
      <Handle type="target" position={Position.Left} className="graph-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="graph-handle" isConnectable={false} />
      <strong>{node.title}</strong>
    </div>
  );
}

/** A group: a stage, a folder, or a group of one kind of child, showing its count, open or folded. */
function GroupNodeView({ data }: NodeProps<FlowNode>) {
  const { node } = data;
  const open = node.group!.open;
  return (
    <div
      className={`graph-node stage-group kind-${node.kind}${open ? ' is-open' : ' is-folded'}${data.isFocus ? ' is-focus' : ''}`}
      title={`${node.title} in ${node.group!.owner} (${open ? 'open' : 'folded'})`}
      data-open={open}
    >
      <Handle type="target" position={Position.Left} className="graph-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="graph-handle" isConnectable={false} />
      <small>Group · {node.group!.owner}</small>
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

/** Whether a drawn node is a box fading out of the picture. */
const isLeaving = (n: FlowNode) => n.data.leaving === true;

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
  /** The canvas, whose nodes' transition it follows. */
  canvas: () => Element | null;
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
 * where it was drawn to where it goes, with the shared motion (LA-PAT-APP-UX-R04): the same
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
    const step = (frameTime: number) => {
      // Follow the nodes' own transition while they move (read once a frame for the whole canvas); once it has ended, so has the move.
      const clock = canvasProgress(parts.canvas(), motion.duration, frameTime);
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
    canvas: () => group.current?.closest('.react-flow') ?? null,
  };
  const frame = useEdgeFrame(data?.ends ?? NO_ENDS, data?.phase ?? 'persist', parts);
  if (!data) return null;
  // A cross-link (the Links switch) is dashed in its own color, apart from the tree's solid parent lines.
  const kind = data.link ? ' is-link' : '';
  return (
    <g ref={group} className={`graph-edge-motion${data.context ? ' is-context' : ''}`} style={{ opacity: frame.opacity }} data-phase={data.phase} data-source={source} data-target={target}>
      <BaseEdge id={id} path={linePath(frame.points)} markerEnd={markerEnd} interactionWidth={0} className={`graph-edge rel-${relationStyle(data.relation)}${kind}${data.showLabel || data.relation === PARENT ? '' : ' distant'}`} />
      {data.showLabel && data.relation !== PARENT && (
        <EdgeLabelRenderer>
          <div ref={label} className="edge-label graph-edge-label" style={{ opacity: frame.opacity, transform: labelTransform(frame.points) }}>
            {data.label}
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

const nodeTypes = { record: GraphNodeView, folder: GroupNodeView, more: MoreNodeView };
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

/**
 * What the person set on the graph: depth, filters, trace mode, the groups they opened or closed,
 * the Links switch, the context ring and the minimap. The last three are optional so a host that
 * stores older settings still fits; each has its default when left out.
 */
export interface GraphSettings {
  depth: number;
  filters: Filters;
  trace: boolean;
  openGroups: ReadonlyMap<string, boolean>;
  /** The Links switch: the focused record's own links, one step. Off by default. */
  links?: boolean;
  /** The context ring, faded around the picture. On by default. */
  context?: boolean;
  /** The minimap in a corner of the canvas. Off by default. */
  minimap?: boolean;
}
/** "1 record", "2 records". */
const count = (n: number, noun: string) => `${n} ${n === 1 ? noun : `${noun}s`}`;

export const MAX_DEPTH = 3;
const DEPTHS = [1, 2, 3];
/** Depth counts levels of the tree each way, folders and stages included; the Links switch adds the center's own links. */
const DEPTH_LABELS = ['One level each way: parent and children', 'Two levels each way', 'Three levels each way'];
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = { depth: 1, filters: NO_FILTERS, trace: false, openGroups: new Map(), links: false, context: true, minimap: false };

/** Where a step command goes from a node: its parent, its first child, or its previous or next sibling in the tree. */
export function stepTarget(index: SpecIndex, focus: string, step: 'out' | 'in' | 'previous' | 'next'): string | null {
  const ok = (id: string | null | undefined) => (id && isGraphNode(index, id) ? id : null);
  if (step === 'out') return ok(nodeParent(index, focus));
  if (step === 'in') return ok(nodeChildren(index, focus).find((c) => isGraphNode(index, c)));
  const up = nodeParent(index, focus);
  if (up === null) return null;
  const siblings = nodeChildren(index, up).filter((c) => isGraphNode(index, c));
  const at = siblings.indexOf(focus);
  if (at < 0) return null;
  return ok(siblings[at + (step === 'next' ? 1 : -1)]);
}

/** The summary above the canvas, of the focus picture only: "9 records · 2 groups · 8 links · 6 more faded". */
export function graphSummary(graph: Neighborhood): string {
  const inFocus = graph.nodes.filter((n) => !n.context);
  const groups = inFocus.filter((n) => n.group).length;
  const links = graph.edges.filter((e) => !e.context).length;
  const faded = graph.nodes.length - inFocus.length;
  return `${count(inFocus.length - groups, 'record')}${groups > 0 ? ` · ${count(groups, 'group')}` : ''} · ${count(links, 'link')}${faded > 0 ? ` · ${faded} more faded` : ''}`;
}

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
  /**
   * Called with the node under the pointer or keyboard focus (the spotlight's, `hover`) and the one
   * selected by a first tap (`selected`), or null, so the host's side bar can describe it.
   */
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
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

export function GraphView({ index, focus, onNavigate, hrefFor, settings: hosted, onSettingsChange, onGraph, onPeek }: GraphViewProps) {
  const [own, setOwn] = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const settings = hosted ?? own;
  const { depth, filters, trace, openGroups } = settings;
  const links = settings.links ?? false;
  const ring = settings.context ?? true;
  const minimap = settings.minimap ?? false;
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
  // The trail is one line (LA-PAT-APP-UX-R08): its items shrink, cut with an ellipsis, and when
  // they still overflow it scrolls to the end, so the center is always in view and the canvas
  // below never moves as the trail grows.
  const trailList = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const ol = trailList.current;
    if (ol) ol.scrollLeft = ol.scrollWidth;
  }, [trail, focus]);

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
    () => (tracing ? traceChain(index, focus, filters) : neighborhood(index, focus, depth, filters, openGroups, { links, context: ring })),
    [index, focus, depth, filters, tracing, openGroups, links, ring],
  );
  // Before paint, so the inspector shows what the graph connects in the same frame as the graph
  // (in an effect it showed one frame without it, then pushed its legend down; LA-PAT-APP-UX-R08).
  useLayoutEffect(() => { onGraph?.({ graph, tracing }); }, [graph, tracing, onGraph]);

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
  useCommand('graphLinks', () => update({ links: !(latest.current.links ?? false) }), valid && !tracing);
  // Stepping through the tree moves the center, as a click does.
  const stepTo = (step: 'out' | 'in' | 'previous' | 'next') => () => {
    const to = stepTarget(index, focus, step);
    if (to) onNavigate(to);
  };
  useCommand('graphStepOut', stepTo('out'), valid);
  useCommand('graphStepIn', stepTo('in'), valid);
  useCommand('graphStepPrevious', stepTo('previous'), valid);
  useCommand('graphStepNext', stepTo('next'), valid);

  if (!valid) {
    return (
      <div className="placeholder graph-missing">
        <p>There's no record or group <code>{focus}</code>.</p>
      </div>
    );
  }
  const counts = graphSummary(graph);
  const steps = [
    { step: 'out' as const, command: 'graphStepOut', label: 'Step out to the parent', mark: '↑' },
    { step: 'in' as const, command: 'graphStepIn', label: 'Step in to the first child', mark: '↓' },
    { step: 'previous' as const, command: 'graphStepPrevious', label: 'Step to the previous sibling', mark: '←' },
    { step: 'next' as const, command: 'graphStepNext', label: 'Step to the next sibling', mark: '→' },
  ];

  return (
    <section className="graph-page" aria-label="Graph" onKeyDown={onPageKey}>
      <header className="graph-header">
        <nav className="graph-trail" aria-label="Records visited">
          <ol ref={trailList} tabIndex={0}>
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
          <div className="graph-links" role="group" aria-label="Cross-links">
            <Tooltip label="Links: the center's own links, one step" command="graphLinks">
              <button type="button" aria-pressed={links} disabled={tracing} onClick={() => update({ links: !links })}>Links</button>
            </Tooltip>
          </div>
          <div className="graph-steps" role="group" aria-label="Step through the tree">
            {steps.map((s) => (
              <Tooltip key={s.step} label={s.label} command={s.command}>
                <Button className="graph-step" aria-label={s.label} disabled={!stepTarget(index, focus, s.step)} onClick={stepTo(s.step)}>{s.mark}</Button>
              </Tooltip>
            ))}
          </div>
          {/* Right after the depth, Links and the steps, whose widths never change, and as one piece of
              text, so a new count never moves anything (LA-PAT-APP-UX-R08); trace and filters sit at the end. */}
          <span className="graph-count" title={counts}>{counts}</span>
          {canTrace(index, focus) && (
            <label className="graph-trace-toggle">
              <Tooltip label="Trace mode on or off" command="graphTrace">
                <input type="checkbox" checked={trace} onChange={(e) => setTrace(e.target.checked)} />
              </Tooltip>
              Trace mode
            </label>
          )}
          <FilterControls
            index={index}
            filters={filters}
            setFilters={setFilters}
            ring={ring}
            setRing={(on) => update({ context: on })}
            minimap={minimap}
            setMinimap={(on) => update({ minimap: on })}
          />
        </div>
      </header>
      <div className="graph-workspace">
        <div className="graph-canvas">
          <ReactFlowProvider>
            <GraphCanvas index={index} graph={graph} onNavigate={onNavigate} onToggle={toggleGroup} minimap={minimap} onPeek={onPeek} />
          </ReactFlowProvider>
        </div>
      </div>
    </section>
  );
}

/** The trace preset's button, worded with the relations' labels (LA-BRW-DR243): "Only satisfies, proves and carries out links". */
export function traceOnlyLabel(index: SpecIndex): string {
  const words = ['satisfies', 'proves', 'fulfills'].map((r) => lowerLabel(graphRelationLabel(r, index)));
  return `Only ${words.slice(0, -1).join(', ')} and ${words.at(-1)} links`;
}

interface FilterProps {
  index: SpecIndex;
  filters: Filters;
  setFilters: (f: Filters) => void;
  ring: boolean;
  setRing: (on: boolean) => void;
  minimap: boolean;
  setMinimap: (on: boolean) => void;
}

function FilterControls({ index, filters, setFilters, ring, setRing, minimap, setMinimap }: FilterProps) {
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
        <fieldset>
          <legend>Picture</legend>
          <label>
            <input type="checkbox" role="switch" checked={ring} onChange={(e) => setRing(e.target.checked)} />
            Show context ring
          </label>
          <label>
            <input type="checkbox" role="switch" checked={minimap} onChange={(e) => setMinimap(e.target.checked)} />
            Minimap
          </label>
        </fieldset>
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
              {graphRelationLabel(r, index)}
            </label>
          ))}
        </fieldset>
        <div className="graph-filter-actions">
          <Button onClick={() => setFilters({ ...filters, hiddenRelations: new Set(relations.filter((r) => !TRACE_RELATIONS.has(r))) })}>
            {traceOnlyLabel(index)}
          </Button>
          <Button onClick={() => setFilters(NO_FILTERS)} disabled={hidden === 0}>Clear filters</Button>
        </div>
        <p className="hint">Escape clears every filter.</p>
      </div>
    </details>
  );
}

/**
 * Nodes in reading order for the keyboard: column by column (tiers and traces both read left to
 * right), ring by ring for the radial fallback. Context nodes are out of focus, so they are left out.
 */
export function keyboardOrder(graph: Neighborhood, placed: Pick<Placed, 'positions' | 'layout'>) {
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
  return graph.nodes.filter((n) => !n.context).sort(compare).map((n) => n.id);
}

/** Only the focus nodes' positions: the camera frames them, and the context ring may run past the canvas's edges. */
export function focusPositions(graph: Neighborhood, positions: ReadonlyMap<string, { x: number; y: number }>): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const n of graph.nodes) {
    const p = positions.get(n.id);
    if (p && !n.context) out.set(n.id, p);
  }
  return out;
}

/** The centers of the context nodes, in world coordinates: what the edge hints count. */
export function contextCenters(graph: Neighborhood, positions: ReadonlyMap<string, { x: number; y: number }>): { x: number; y: number }[] {
  return graph.nodes.flatMap((n) => {
    const p = positions.get(n.id);
    return n.context && p ? [{ x: p.x + NODE_WIDTH / 2, y: p.y + NODE_HEIGHT / 2 }] : [];
  });
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

function GraphCanvas({ index, graph, onNavigate: navigate, onToggle, minimap, onPeek }: {
  index: SpecIndex;
  graph: Neighborhood;
  onNavigate: (id: string) => void;
  onToggle: (id: string, nowOpen: boolean) => void;
  minimap: boolean;
  onPeek?: GraphViewProps['onPeek'];
}) {
  // A chip of the light ring re-centers on the folder it stands for.
  const chipTargets = useMemo(() => new Map(graph.nodes.filter((n) => n.more).map((n) => [n.id, n.more!.target])), [graph]);
  const onNavigate = useCallback((id: string) => navigate(chipTargets.get(id) ?? id), [navigate, chipTargets]);
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
  const centers = useMemo(() => (placed ? contextCenters(placed.graph, placed.positions) : []), [placed]);

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
    const drawnBefore = shownNodes.current?.filter((n) => !isLeaving(n)) ?? null;
    const fades = fadeSets(drawnBefore?.map((n) => n.id) ?? null, g.nodes.map((n) => n.id));
    // Focus nodes in keyboard order, then the context ring, which is out of focus: no keyboard stop,
    // hidden from assistive technology, faded and a little smaller (the CSS fades it as it changes).
    const contextIds = g.nodes.filter((n) => n.context).map((n) => n.id);
    const nodes: FlowNode[] = [...order, ...contextIds].map((id) => {
      const node = byId.get(id)!;
      const isFocus = id === g.focus;
      const classes = [fades.entering.has(id) && !reduced ? 'is-entering' : '', node.context ? 'is-context' : ''].filter(Boolean).join(' ');
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
        ...(classes ? { className: classes } : {}),
        ...(node.context ? { focusable: false, domAttributes: { 'aria-hidden': true } } : {}),
      };
      if (node.more) {
        return { ...base, type: 'more', data: { node, kindLabel: '', errors: 0, warnings: 0, gaps: [], isFocus: false } };
      }
      if (node.group) {
        const marks = groupMarks(index, id);
        return {
          ...base,
          type: 'folder',
          ...(node.context ? {} : { ariaLabel: `Group ${node.title} in ${node.group.owner}, ${node.group.open ? 'open' : 'folded'}${isFocus ? ' (center)' : ''}` }),
          // The center group is always open, and a context group is out of focus: neither has a chevron.
          data: { node, kindLabel: 'Group', ...marks, isFocus, onToggle: isFocus || node.context ? undefined : () => onToggle(id, node.group!.open) },
        };
      }
      const problems = node.kind === FILE_KIND ? [] : index.problemsFor.get(id) ?? [];
      const errors = problems.filter((p) => p.severity === 'error').length;
      return {
        ...base,
        type: 'record',
        ...(node.context ? {} : { ariaLabel: `${node.kind === FILE_KIND ? 'File' : kindLabel(index, node.kind)} ${isFocus ? '(center) ' : ''}${node.title}` }),
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
        label: graphEdgeLabel(index, e),
        context: e.context === true,
        link: g.mode === 'hierarchy' && e.relation !== PARENT,
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
    // A leaving record keeps its ID and its element, marked as leaving, so React Flow keeps the box it
    // drew rather than drawing it anew under another ID (which made a re-center of 200 boxes
    // remount every box that left; LA-PAT-APP-UX-R11). It can't be clicked or focused. A record that
    // comes back into the picture is drawn as itself again, and its leaving box is dropped.
    const stillLeaving = (shownNodes.current ?? []).filter((n) => isLeaving(n) && !byId.has(n.id));
    const leavingNodes: FlowNode[] = reduced ? [] : [
      ...stillLeaving,
      ...(drawnBefore ?? []).filter((n) => fades.leaving.has(n.id)).map((n) => ({
        ...n,
        data: { ...n.data, leaving: true, onToggle: undefined },
        // A context node leaves as it was, faded, so nothing pops.
        className: n.className?.split(' ').includes('is-context') ? 'is-context is-leaving' : 'is-leaving',
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
   * so a view zoomed or panned by hand glides from there (LA-BRW-DR181). Both frame the focus nodes
   * only: the context ring may run past the canvas's edges, cut off by the vignette.
   */
  const fit = useCallback((animate: boolean, whole = false) => {
    const box = wrapper.current?.getBoundingClientRect();
    if (!placed || !box || box.width <= 0 || box.height <= 0) return;
    const motion = readMotion();
    const inFocus = focusPositions(placed.graph, placed.positions);
    const view = whole ? fitPositions(inFocus, box.width, box.height) : frameFocus(inFocus, placed.graph.focus, box.width, box.height);
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

  /**
   * The hover spotlight: hovering or keyboard-focusing a focus node brightens it, its edges and the
   * nodes it joins (focus or context), and dims the rest a step; leaving restores the picture. It
   * writes classes straight to the drawn elements, so the picture is not drawn anew, and the CSS
   * fades them with the motion tokens (at once under reduced motion).
   */
  const spot = useCallback((id: string | null) => {
    const root = wrapper.current;
    if (!root) return;
    for (const el of root.querySelectorAll('.is-lit')) el.classList.remove('is-lit');
    const node = id && placed?.graph.nodes.find((n) => n.id === id);
    // The side bar's Details shows the node lit, a context node too (it has no spotlight of its own).
    onPeek?.('hover', node && node.kind !== FILE_KIND && !node.more ? node.id : null);
    if (!node || node.context) { root.classList.remove('has-spotlight'); return; }
    const lit = new Set([id]);
    const edgeIds = new Set<string>();
    for (const e of placed!.graph.edges) {
      if (e.source !== id && e.target !== id) continue;
      lit.add(e.source);
      lit.add(e.target);
      edgeIds.add(`${e.source} ${e.target}`);
    }
    root.classList.add('has-spotlight');
    for (const el of root.querySelectorAll<HTMLElement>('.react-flow__node')) if (lit.has(el.dataset.id ?? '')) el.classList.add('is-lit');
    for (const el of root.querySelectorAll<SVGGElement>('g.graph-edge-motion')) if (edgeIds.has(`${el.dataset.source} ${el.dataset.target}`)) el.classList.add('is-lit');
  }, [placed, onPeek]);
  // A new picture starts without a spotlight.
  useEffect(() => () => spot(null), [spot]);

  /** A click or Enter on a node, record or group: it becomes the center, at its own address. */
  const activate = (id: string, fromKeyboard: boolean) => {
    if (!placed || id.startsWith('file:') || !placed.graph.nodes.some((n) => n.id === id) || id === placed.graph.focus) return;
    if (fromKeyboard) refocus.current = id;
    onNavigate(id);
  };
  // By touch, a first tap selects a node and a second tap (or the card's Open chip) opens it.
  const canOpen = useCallback((id: string) => !!placed && !id.startsWith('file:') && placed.graph.nodes.some((n) => n.id === id) && id !== placed.graph.focus, [placed]);
  const tap = useTapToOpen(onNavigate, canOpen, wrapper, graph.focus);
  const armedNode = tap.armed ? placed?.graph.nodes.find((n) => n.id === tap.armed) : undefined;
  useEffect(() => { onPeek?.('selected', tap.armed); }, [tap.armed, onPeek]);

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
        spot(id ?? null);
      }}
      onBlur={() => spot(null)}
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
        onNodeMouseEnter={(_, n) => spot(n.id)}
        onNodeMouseLeave={() => spot(null)}
        onPaneClick={tap.clear}
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
        {minimap && (
          <MiniMap
            className="graph-minimap"
            ariaLabel="Minimap"
            nodeClassName={(n) => (n.className?.split(' ').includes('is-context') ? 'is-context' : n.id === graph.focus ? 'is-focus' : '')}
            nodeBorderRadius={2}
            pannable={false}
            zoomable={false}
          />
        )}
      </ReactFlow>
      {placed && <EdgeHints centers={centers} wrapper={wrapper} />}
      {armedNode && (
        <TapCard
          kind={armedNode.more ? 'More' : armedNode.group ? 'Group' : kindLabel(index, armedNode.kind)}
          name={armedNode.title}
          onOpen={tap.openArmed}
          onDismiss={tap.clear}
        />
      )}
    </div>
  );
}

