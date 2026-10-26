import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import {
  Background,
  BaseEdge,
  ControlButton,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
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
  filterKind,
  graphEdgeLabel,
  graphRelationLabel,
  groupName,
  isFiltered,
  isGraphNode,
  kindGroups,
  neighborhood,
  nextTrail,
  nodeChildren,
  nodeParent,
  parseGroupId,
  relationsOf,
  stageOf,
  traceChain,
  type Filters,
  type Neighborhood,
} from './model';
import { boxExit, contentScale, traceGrid, type Point } from './layout';
import { centerOf, graphMap, linkEnds, mapRootOf, parentLine, type GraphMap, type PlacedMap } from './map';
import { nestedMap, type NestedMap, type NestedNode } from './nested';
import { readyVoronoiMap, voronoiMap, type VoronoiMap, type VoronoiNode } from './voronoi';
import { treeGroup } from './tree';
import { isCentered, labelFor, labelHeight, labelLines, marksOf, type WrappedLabel } from './text';
import { drawnFor, drawnKey, drawnNested, fitBoxes, frameNested, frameOnMap, glideDuration, MAX_ZOOM, mergeDrawn, zoomPath, type Drawn, type Viewport } from './camera';
import { EdgeHints, type Side } from './hints';
import { readMotion } from './motion';
import { Button } from '../components/Button';

// The graph view: the product's tree as one fixed map (map.ts), explored by a camera (camera.ts).
// Clicking a record or a group focuses it (through onNavigate, so the host changes the address and
// Back walks back along the path), and the camera glides to frame it; nothing in the map moves or
// changes size. Trace mode is a chain, not the tree, and keeps a small picture of its own.
//
// GraphView is the graph on its own: it takes the focus and an onNavigate callback and never reads
// the address, so it can sit in any pane. The focus page (app/src/views/FocusPage.tsx) hosts it in
// the Graph and Split views, keeps its settings across pages, and shows what it connects in the
// side bar.

/** One drawn box: a node of the map (or of a trace), labeled or plain. */
interface NodeData extends Record<string, unknown> {
  id: string;
  kind: string;
  stage: string;
  title: string;
  kindLabel: string;
  /** The line above the title: "Use case · LA-EXP-UC03", "Group · LA-EXP", "File". */
  meta: string;
  group: boolean;
  errors: number;
  warnings: number;
  gaps: string[];
  isFocus: boolean;
  /** Whether it is big enough on screen for its text; a plain box is a filled box with no text. */
  label: boolean;
  /** How much its box's border and shape grow with its size (LA-EXP-DR58): 1 for a leaf. */
  scale: number;
  /** How much its text, padding and marks grow: its level's, fixed by the map, never by the camera (LA-EXP-DR58). */
  text: number;
  /** Its label's lines as the map broke them (text.ts, or nested.ts in the Nested view), and whether it is centered. */
  lines: WrappedLabel;
  centered: boolean;
  /** In the Nested view (LA-EXP-DR62): a box drawn with its children inside it has a header band of this height (map units) holding its label at the top; 0 for a leaf, whose label is centered. */
  header?: number;
  /** In the Voronoi view (LA-EXP-DR64): the cell's outline and its label's box, in the node's own units (its bounding box from 0, 0). */
  cell?: { points: string; label: { x: number; y: number; w: number; h: number } };
}
interface EdgeData extends Record<string, unknown> {
  relation: string;
  /** Where it is drawn, in world coordinates: a parent line's two ends, or a link's curve's ends. */
  points: [Point, Point];
  /** The words drawn on a link: its relation's label, read from its source. */
  label: string;
  /** A cross-link added by the Links switch: a dashed curve, in its own color. */
  link: boolean;
  /** How much its stroke grows, as a box's border does (LA-EXP-DR58): its child's content scale for a parent line, 1 for a link. */
  scale: number;
}
type FlowNode = Node<NodeData | BarData>;
type FlowEdge = Edge<EdgeData>;
interface BarData extends Record<string, unknown> { bar: true }

/** CSS family for an edge's relation, so related relations share a line style. */
export function relationStyle(relation: string): string {
  if (relation === PARENT) return 'structure';
  if (['satisfies', 'proves', 'fulfills'].includes(relation)) return 'trace';
  if (['uses', 'implements', 'depends_on'].includes(relation)) return 'design';
  if (relation === 'names') return 'file';
  if (relation === 'follows') return 'pattern';
  // A domain event's links (LA-EXP-UC04-R07): dashed, in the spark colors events are drawn in.
  if (['reacts_to', 'raised_by'].includes(relation)) return 'event';
  return 'other';
}

function Marks({ data }: { data: NodeData }) {
  if (data.errors === 0 && data.warnings === 0 && data.gaps.length === 0) return null;
  const within = data.group ? ' among its members' : '';
  return (
    <span className="graph-marks">
      {data.errors > 0 && <span className="graph-mark error" title={`${data.errors} error${data.errors > 1 ? 's' : ''}${within}`} aria-label="has errors">!</span>}
      {data.errors === 0 && data.warnings > 0 && <span className="graph-mark warning" title={`${data.warnings} warning${data.warnings > 1 ? 's' : ''}${within}`} aria-label="has warnings">!</span>}
      {data.gaps.length > 0 && <span className="graph-mark gap" title={data.gaps.map((g) => (g === 'satisfies' ? 'not satisfied' : 'not proved')).join(', ') + within} aria-label="has coverage gaps">gap</span>}
    </span>
  );
}

/** The node's scales as CSS variables (LA-EXP-DR58): its border and shape (`--box-scale`), its text, padding and marks (`--node-scale`). */
const scaleStyle = (scale: number, text: number): CSSProperties | undefined =>
  scale !== 1 || text !== 1 ? ({ '--box-scale': scale, '--node-scale': text } as CSSProperties) : undefined;

function GraphNodeView({ data }: NodeProps<Node<NodeData>>) {
  /** Whether a domain draws a hexagon mark before its kind and ID line (Nested and Voronoi), rather than being a hexagon (Tree). */
  const marked = data.header !== undefined || data.cell !== undefined;
  const classes = [
    'graph-node',
    data.group ? 'stage-group' : `stage-${data.stage || 'structural'}`,
    `kind-${data.kind}`,
    data.isFocus ? 'is-focus' : '',
    data.centered ? 'is-centered' : '',
    data.label ? '' : 'is-plain',
    // A domain is a hexagon in the Tree view (LA-EXP-DR61), and in the Nested and Voronoi views a box or a cell with a hexagon mark (LA-EXP-DR62, LA-EXP-DR64).
    data.kind === 'domain' && !data.group ? (marked ? 'has-hexagon-mark' : 'is-hexagon') : '',
    data.header ? 'is-container' : '',
    data.cell ? 'is-cell' : '',
  ].filter(Boolean).join(' ');
  const style = scaleStyle(data.scale, data.text);
  const label = data.label && (
    <>
      {/* The lines as the map broke them; a marked box keeps room beside its kind and ID line for the badge. */}
      <small className={data.errors + data.warnings + data.gaps.length > 0 ? 'graph-badge-room' : undefined}>{data.lines.meta.map((l, i) => <span key={i}>{i === 0 && data.kind === 'domain' && marked && !data.group && <span className="graph-hexagon-mark" aria-hidden="true" />}{l}</span>)}</small>
      <strong>{data.lines.title.map((l, i) => <span key={i}>{l}</span>)}</strong>
      <Marks data={data} />
    </>
  );
  const handles = (
    <>
      <Handle type="target" position={Position.Left} className="graph-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="graph-handle" isConnectable={false} />
    </>
  );
  const title = data.group ? `${data.title} (${data.meta.replace(/^Group · /, 'in ')})` : `${data.title} (${data.id})`;
  if (data.cell) {
    // A Voronoi cell (LA-EXP-DR64): the node is clipped to its outline, so only the cell takes the
    // pointer; the outline is drawn as a polygon, and the label sits in the box the map gave it.
    const { points, label: at } = data.cell;
    return (
      <div className={classes} title={title} style={{ ...style, clipPath: `polygon(${points.split(' ').map((p) => p.split(',').map((v) => `${v}px`).join(' ')).join(', ')})` }}>
        <svg className="graph-cell-shape" aria-hidden="true" width="100%" height="100%"><polygon points={points} /></svg>
        {handles}
        {label && <div className="graph-cell-label" style={{ left: at.x, top: at.y, width: at.w, height: at.h }}>{label}</div>}
      </div>
    );
  }
  return (
    <div className={classes} title={title} style={style}>
      {handles}
      {label}
    </div>
  );
}

/** A bar standing for children too small to draw (LA-EXP-DR60). */
function BarView() {
  return <div className="graph-bar" />;
}

const linePath = ([a, b]: [Point, Point]) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
/** A link's curve: leaving and entering its boxes level, bending between them. */
function curvePath([a, b]: [Point, Point]) {
  const bend = Math.max(40, Math.abs(b.x - a.x) / 2);
  const dir = b.x >= a.x ? 1 : -1;
  return `M ${a.x} ${a.y} C ${a.x + dir * bend} ${a.y}, ${b.x - dir * bend} ${b.y}, ${b.x} ${b.y}`;
}

function GraphEdgeView({ id, data, markerEnd, source, target }: EdgeProps<FlowEdge>) {
  if (!data) return null;
  const [a, b] = data.points;
  // A cross-link (the Links switch) is a dashed curve in its own color, apart from the tree's level parent lines.
  return (
    <g className="graph-edge-group" data-source={source} data-target={target} style={data.scale !== 1 ? ({ '--edge-scale': data.scale } as CSSProperties) : undefined}>
      <BaseEdge id={id} path={data.link ? curvePath(data.points) : linePath(data.points)} markerEnd={data.link ? markerEnd : undefined} interactionWidth={0} className={`graph-edge rel-${relationStyle(data.relation)}${data.link ? ' is-link' : ''}`} />
      {data.link && data.label && (
        <EdgeLabelRenderer>
          <div className="edge-label graph-edge-label" style={{ transform: `translate(-50%, -50%) translate(${(a.x + b.x) / 2}px, ${(a.y + b.y) / 2}px)` }}>
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}

/** Where a node's two handles are: the middle of its left and right sides. */
const nodeHandles = (width: number, height: number) => [
  { type: 'target' as const, position: Position.Left, x: 0, y: height / 2, width: 1, height: 1 },
  { type: 'source' as const, position: Position.Right, x: width, y: height / 2, width: 1, height: 1 },
];

const nodeTypes = { box: GraphNodeView, bar: BarView };
const edgeTypes = { line: GraphEdgeView };

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

/** How the graph draws the tree (LA-EXP-UC03-R16): Tree, parents beside their children; Nested, parents made of them as boxes; Voronoi, as polygon cells. */
export type GraphLayout = 'tree' | 'nested' | 'voronoi';
export const GRAPH_LAYOUTS: readonly { layout: GraphLayout; label: string; tip: string }[] = [
  { layout: 'tree', label: 'Tree', tip: 'Tree: each parent beside its children' },
  { layout: 'nested', label: 'Nested', tip: 'Nested: each parent a box made of its children' },
  { layout: 'voronoi', label: 'Voronoi', tip: 'Voronoi: each parent a cell made of its children' },
];

/** What the person set on the graph: the view, depth, filters, trace mode, the Links switch and the minimap. */
export interface GraphSettings {
  /** Tree, Nested or Voronoi (LA-EXP-UC03-R16). Tree by default. */
  layout: GraphLayout;
  depth: number;
  filters: Filters;
  trace: boolean;
  /** The Links switch: the focused record's own links, one step. Off by default. */
  links: boolean;
  /** The minimap in a corner of the canvas. Off by default. */
  minimap: boolean;
}
/** "1 record", "2 records". */
const count = (n: number, noun: string) => `${n} ${n === 1 ? noun : `${noun}s`}`;

export const MAX_DEPTH = 3;
const DEPTHS = [1, 2, 3];
/** Depth is how many levels below the focus the camera frames (Tree), or how many levels inside it are labeled (Nested and Voronoi), folders and stages included. */
const DEPTH_LABELS: Record<GraphLayout, string[]> = {
  tree: ['Frame the focus and its children', 'Frame two levels below the focus', 'Frame three levels below the focus'],
  nested: ['Label the focus and its children', 'Label two levels inside the focus', 'Label three levels inside the focus'],
  voronoi: ['Label the focus and its children', 'Label two levels inside the focus', 'Label three levels inside the focus'],
};
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = { layout: 'tree', depth: 1, filters: NO_FILTERS, trace: false, links: false, minimap: false };
/** The view after this one, for the switch's command. */
export const nextLayout = (layout: GraphLayout): GraphLayout => GRAPH_LAYOUTS[(GRAPH_LAYOUTS.findIndex((l) => l.layout === layout) + 1) % GRAPH_LAYOUTS.length].layout;

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

/** The summary above the canvas, of the framed picture: "9 records · 2 groups · 8 links". */
export function graphSummary(graph: Neighborhood): string {
  const groups = graph.nodes.filter((n) => n.group).length;
  return `${count(graph.nodes.length - groups, 'record')}${groups > 0 ? ` · ${count(groups, 'group')}` : ''} · ${count(graph.edges.length, 'link')}`;
}

export interface GraphViewProps {
  index: SpecIndex;
  /** A record ID, or a group's ID in the graph's tree. */
  focus: string;
  /** Called with a record or group ID when the person moves the focus there. */
  onNavigate: (id: string) => void;
  /** The address a node's link points to, for opening in a new tab. */
  hrefFor: (id: string) => string;
  /** The settings, when the host keeps them (so they survive moving between pages and views). */
  settings?: GraphSettings;
  onSettingsChange?: (settings: GraphSettings) => void;
  /** Called with the framed picture, so the host's side bar can list what it connects. */
  onGraph?: (info: GraphInfo) => void;
  /**
   * Called with the node under the pointer or keyboard focus (the spotlight's, `hover`) and the one
   * selected by a first tap (`selected`), or null, so the host's side bar can describe it.
   */
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
}

/**
 * How a node is named in the trail: a record's title with its ID in parentheses, "Browsing
 * (LA-EXP)"; a group, which has no ID of its own, by its name alone ("Use cases", no count), with
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
  const { layout, depth, filters, trace, links, minimap } = settings;
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
  // It is a Tab stop only while it overflows, so the keyboard can scroll it (LA-PAT-APP-UX-R10).
  const trailList = useRef<HTMLOListElement>(null);
  const [trailOverflows, setTrailOverflows] = useState(false);
  useLayoutEffect(() => {
    const ol = trailList.current;
    if (!ol) return;
    ol.scrollLeft = ol.scrollWidth;
    const measure = () => setTrailOverflows(ol.scrollWidth > ol.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(ol);
    return () => observer.disconnect();
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
    () => (tracing ? traceChain(index, focus, filters) : neighborhood(index, focus, depth, filters, { links })),
    [index, focus, depth, filters, tracing, links],
  );
  // Before paint, so the side bar shows what the graph connects in the same frame as the graph
  // (in an effect it showed one frame without it, then pushed its legend down; LA-PAT-APP-UX-R08).
  useLayoutEffect(() => { onGraph?.({ graph, tracing }); }, [graph, tracing, onGraph]);

  const clearFilters = useCallback(() => update({ filters: NO_FILTERS, trace: false }), [update]);
  const onPageKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && (isFiltered(filters) || trace)) { e.preventDefault(); clearFilters(); }
  };
  const valid = isGraphNode(index, focus);
  useCommand('graphDepthUp', () => update({ depth: Math.min(MAX_DEPTH, latest.current.depth + 1) }), valid && !tracing);
  useCommand('graphDepthDown', () => update({ depth: Math.max(1, latest.current.depth - 1) }), valid && !tracing);
  useCommand('graphTrace', () => update({ trace: !latest.current.trace }), valid && canTrace(index, focus));
  useCommand('graphLinks', () => update({ links: !latest.current.links }), valid && !tracing);
  useCommand('graphLayout', () => update({ layout: nextLayout(latest.current.layout) }), valid && !tracing);
  // Stepping through the tree moves the focus, as a click does.
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
          <ol ref={trailList} tabIndex={trailOverflows ? 0 : undefined}>
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
          <div className="graph-depth graph-layout" role="group" aria-label="Layout">
            {GRAPH_LAYOUTS.map((l) => (
              <Tooltip key={l.layout} label={l.tip} command={l.layout !== layout ? 'graphLayout' : undefined}>
                <button type="button" aria-pressed={layout === l.layout} disabled={tracing} onClick={() => update({ layout: l.layout })}>{l.label}</button>
              </Tooltip>
            ))}
          </div>
          <div className="graph-depth" role="group" aria-label="Depth">
            <span>Depth</span>
            {DEPTHS.map((d) => (
              <Tooltip key={d} label={DEPTH_LABELS[layout][d - 1]} command={d === depth + 1 ? 'graphDepthUp' : d === depth - 1 ? 'graphDepthDown' : undefined}>
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
          <FilterControls index={index} filters={filters} setFilters={setFilters} minimap={minimap} setMinimap={(on) => update({ minimap: on })} />
        </div>
      </header>
      <div className="graph-workspace">
        <div className="graph-canvas">
          <ReactFlowProvider>
            <GraphCanvas index={index} graph={graph} layout={layout} depth={depth} filters={filters} onNavigate={onNavigate} minimap={minimap} onPeek={onPeek} />
          </ReactFlowProvider>
        </div>
      </div>
    </section>
  );
}

/** The trace preset's button, worded with the relations' labels (LA-EXP-V03-R07): "Only satisfies, proves and carries out links". */
export function traceOnlyLabel(index: SpecIndex): string {
  const words = ['satisfies', 'proves', 'fulfills'].map((r) => lowerLabel(graphRelationLabel(r, index)));
  return `Only ${words.slice(0, -1).join(', ')} and ${words.at(-1)} links`;
}

interface FilterProps {
  index: SpecIndex;
  filters: Filters;
  setFilters: (f: Filters) => void;
  minimap: boolean;
  setMinimap: (on: boolean) => void;
}

function FilterControls({ index, filters, setFilters, minimap, setMinimap }: FilterProps) {
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

/** A box on the canvas with its place and size, in world coordinates. */
export interface Box { id: string; x: number; y: number; w: number; h: number; label: boolean; text: number; parent: boolean }

/**
 * The labeled boxes in reading order for the keyboard: in the Tree view column by column, left to
 * right, then top to bottom; in the Nested view (given each box's place in the tree's order) a
 * parent before its children. Plain boxes are out of the keyboard order.
 */
export function keyboardOrder(boxes: readonly Pick<Box, 'id' | 'x' | 'y' | 'label'>[], treeOrder?: (id: string) => number): string[] {
  const labeled = boxes.filter((b) => b.label);
  return (treeOrder ? labeled.sort((a, b) => treeOrder(a.id) - treeOrder(b.id)) : labeled.sort((a, b) => a.x - b.x || a.y - b.y)).map((b) => b.id);
}

/**
 * The nodes hidden by the kind filters (LA-EXP-UC03-R05): a node of a hidden kind and everything
 * beneath it. The focus and its ancestors are never hidden. The map keeps their places.
 */
export function hiddenNodes(index: SpecIndex, map: PlacedMap, filters: Filters, focus: string): Set<string> {
  const hidden = new Set<string>();
  if (filters.hiddenKinds.size === 0) return hidden;
  const keep = new Set<string>();
  for (let at: string | null = focus; at !== null; at = map.nodes.get(at)?.parent ?? null) keep.add(at);
  const walk = (id: string, under: boolean) => {
    const kind = filterKind(index, id);
    const off = !keep.has(id) && (under || (kind !== null && filters.hiddenKinds.has(kind)));
    if (off) hidden.add(id);
    for (const c of map.nodes.get(id)!.children) walk(c, off);
  };
  for (const r of map.roots) walk(r, false);
  return hidden;
}

/** A box's data: what it shows and how it is named. */
function boxData(index: SpecIndex, id: string, focus: string, label: boolean, scale: number, text: number, parent: boolean, graph: Neighborhood, nested?: NestedNode | VoronoiNode): NodeData {
  // The same lines the map sized the box for (text.ts, or the Nested or Voronoi map's), so the label always fits it.
  const { title, meta } = labelLines(index, id);
  const centered = nested ? nested.centered : isCentered(text, parent);
  const lines = nested ? nested.lines : labelFor(index, id, centered);
  const record = index.byId.get(id);
  if (record) {
    return { id, kind: record.kind, stage: stageOf(index, record.kind), title, kindLabel: kindLabel(index, record.kind), meta, group: false, ...marksOf(index, id), isFocus: id === focus, label, scale, text, lines, centered };
  }
  if (id.startsWith('file:')) {
    const node = graph.nodes.find((n) => n.id === id);
    return { id, kind: FILE_KIND, stage: 'file', title: node?.title ?? title, kindLabel: 'File', meta, group: false, errors: 0, warnings: 0, gaps: [], isFocus: false, label, scale, text, lines, centered };
  }
  return { id, kind: treeGroup(index, id)?.kind ?? 'folder', stage: 'group', title, kindLabel: 'Group', meta, group: true, ...marksOf(index, id), isFocus: id === focus, label, scale, text, lines, centered };
}

/** The accessible name of a labeled box. */
function ariaName(d: NodeData): string {
  if (d.group) return `Group ${d.title} in ${d.meta.replace(/^Group · /, '')}${d.isFocus ? ' (center)' : ''}`;
  return `${d.kindLabel} ${d.isFocus ? '(center) ' : ''}${d.title}`;
}

/** The camera, as the store holds it. */
const useZoom = () => useStore((s) => s.transform[2]);

/** The dots behind the map, only while they are far enough apart to draw (a map zoomed far out would fill them in). */
function MapBackground() {
  const zoom = useZoom();
  return zoom >= 0.25 ? <Background gap={24} size={1} /> : null;
}

/**
 * The minimap (LA-EXP-UC03-R15): a true overview of the one map, its upper levels as boxes (as many
 * as stay readable, at most about 400), the focus solid, and the viewport outlined as the camera
 * moves.
 */
function MapOverview({ map, focus, hidden }: { map: PlacedMap; focus: string; hidden: ReadonlySet<string> }) {
  // A Voronoi cell is drawn as its outline (LA-EXP-DR64), every other node as its box.
  const shapeOf = (n: PlacedMap['byLevel'][number][number], className: string) => ('polygon' in n
    ? <polygon key={n.id} className={className} points={(n as VoronoiNode).polygon.map((p) => p.join(',')).join(' ')} />
    : <rect key={n.id} className={className} x={n.x} y={n.y} width={n.w} height={n.h} />);
  const boxes = useMemo(() => {
    const out = [];
    for (const level of map.byLevel) {
      if (out.length + level.length > 400) break;
      out.push(...level.filter((n) => !hidden.has(n.id)));
    }
    return out;
  }, [map, hidden]);
  const view = useStore((s) => {
    const [x, y, zoom] = s.transform;
    return `${-x / zoom} ${-y / zoom} ${s.width / zoom} ${s.height / zoom}`;
  });
  const [vx, vy, vw, vh] = view.split(' ').map(Number);
  const f = map.nodes.get(focus);
  const W = 200;
  const H = Math.min(200, Math.max(80, (W * map.height) / Math.max(1, map.width)));
  const pad = Math.max(map.width, map.height) * 0.02;
  return (
    <div className="graph-minimap">
      <svg role="img" aria-label="Minimap" width={W} height={H} viewBox={`${-pad} ${-pad} ${map.width + 2 * pad} ${map.height + 2 * pad}`} preserveAspectRatio="xMidYMid meet">
        {boxes.map((n) => shapeOf(n, 'graph-minimap-node'))}
        {f && shapeOf(f, 'graph-minimap-node is-focus')}
        <rect className="graph-minimap-view" x={vx} y={vy} width={vw} height={vh} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** The Voronoi map while it is being laid out: nothing to draw. */
const EMPTY_VORONOI: VoronoiMap = { view: 'voronoi', nodes: new Map(), roots: [], byLevel: [], width: 0, height: 0 };

const sameView = (a: Viewport, b: Viewport) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.zoom - b.zoom) < 1e-6;

function GraphCanvas({ index, graph, layout, depth, filters, onNavigate, minimap, onPeek }: {
  index: SpecIndex;
  graph: Neighborhood;
  layout: GraphLayout;
  depth: number;
  filters: Filters;
  onNavigate: (id: string) => void;
  minimap: boolean;
  onPeek?: GraphViewProps['onPeek'];
}) {
  const tracing = graph.mode === 'trace';
  const focus = graph.focus;
  // The focus's own product's map (no other product's nodes are in it), in any layout (LA-EXP-UC03-R16): the Tree map (map.ts), the Nested map (nested.ts) or the Voronoi map (voronoi.ts), under one camera.
  // The Voronoi map is laid out in a worker the first time; until it is ready the canvas is empty.
  const root = useMemo(() => mapRootOf(index, focus), [index, focus]);
  const nested = layout !== 'tree';
  const [laidOut, setLaidOut] = useState<{ index: SpecIndex; root: string; map: VoronoiMap } | null>(null);
  const voronoi = layout === 'voronoi' ? (laidOut && laidOut.index === index && laidOut.root === root ? laidOut.map : readyVoronoiMap(index, root)) : undefined;
  useEffect(() => {
    if (layout !== 'voronoi' || voronoi) return;
    let live = true;
    void voronoiMap(index, root).then((m) => { if (live) setLaidOut({ index, root, map: m }); }, () => {});
    return () => { live = false; };
  }, [layout, voronoi, index, root]);
  const map: GraphMap | NestedMap | VoronoiMap = useMemo(
    () => (layout === 'voronoi' ? voronoi ?? EMPTY_VORONOI : layout === 'nested' ? nestedMap(index, root) : graphMap(index, root)),
    [index, root, layout, voronoi],
  );
  const wrapper = useRef<HTMLDivElement>(null);
  const active = useRef<string | null>(null);
  /** After a keyboard action, the node to put keyboard focus on once the camera has framed it. */
  const refocus = useRef<string | null>(null);
  const { getViewport, setViewport } = useReactFlow();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const hidden = useMemo(() => hiddenNodes(index, map, filters, focus), [index, map, filters, focus]);
  const parentShown = !filters.hiddenRelations.has(PARENT);
  /** The records the focus links to (the Links switch): always drawn, and counted by the edge hints when out of view. */
  const linked = useMemo(() => [...new Set(graph.edges.filter((e) => e.relation !== PARENT).flatMap((e) => [e.source, e.target]))].filter((id) => id !== focus), [graph, focus]);
  const always = useMemo(() => [focus, ...linked], [focus, linked]);

  // ---- What is drawn: the level of detail for the camera (LA-EXP-DR60) ----
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const shownKey = useRef('');
  const show = useCallback((d: Drawn) => {
    const key = drawnKey(d);
    if (key === shownKey.current) return;
    shownKey.current = key;
    setDrawn(d);
  }, []);
  const drawnAt = useCallback((v: Viewport): Drawn => {
    if (!size) return { boxes: [], bars: [] };
    const d = map.view !== 'tree'
      ? drawnNested(map, v, size.w, size.h, always, { focus, depth, framed: frameNested(map, focus, size.w, size.h).zoom })
      : drawnFor(map, v, size.w, size.h, always);
    return { boxes: d.boxes.filter((b) => !hidden.has(b.id)), bars: d.bars.filter((b) => !hidden.has(b.parent)) };
  }, [map, size, always, hidden, focus, depth]);

  const latestDrawnAt = useRef(drawnAt);
  latestDrawnAt.current = drawnAt;

  // ---- The camera ----
  const glide = useRef<number | null>(null);
  const stopGlide = () => { if (glide.current !== null) { cancelAnimationFrame(glide.current); glide.current = null; } };
  useEffect(() => stopGlide, []);
  /** Moves the camera to a viewport: one smooth zoom and pan with the shared motion, or at once. */
  const moveTo = useCallback((target: Viewport, animate: boolean) => {
    stopGlide();
    const from = getViewport();
    const motion = readMotion();
    if (!size || !animate || motion.duration === 0 || sameView(from, target)) {
      setViewport(target, { duration: 0 });
      if (!tracing) show(drawnAt(target));
      return;
    }
    const path = zoomPath(from, target, size.w, size.h);
    // Everything the glide passes over is drawn once, as it starts, and trimmed when it ends, so no frame of the move draws anew.
    if (!tracing) show(mergeDrawn([0, 0.25, 0.5, 0.75, 1].map((t) => drawnAt(path.at(t)))));
    const duration = glideDuration(motion.duration, path.S);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setViewport(path.at(motion.ease(t)), { duration: 0 });
      if (t < 1) { glide.current = requestAnimationFrame(step); return; }
      glide.current = null;
      if (!tracing) show(latestDrawnAt.current(target));
    };
    glide.current = requestAnimationFrame(step);
  }, [getViewport, setViewport, size, tracing, show, drawnAt]);

  // A trace's boxes are leaves at text scale 1, each as tall as its wrapped label needs (text.ts).
  const tracePlaced = useMemo(() => (tracing ? traceGrid(graph, (id) => 2 * Math.ceil(labelHeight(labelFor(index, id, false)) / 2)) : null), [tracing, graph, index]);
  /** The camera that frames the focus: on the map, the focus and the levels the depth shows; in a trace, the whole chain. */
  const framing = useCallback((): Viewport | null => {
    if (!size) return null;
    if (tracePlaced) return fitBoxes(tracePlaced.positions, size.w, size.h, 40, tracePlaced.heights, tracePlaced.widths);
    return map.view !== 'tree' ? frameNested(map, focus, size.w, size.h) : frameOnMap(map, focus, depth, size.w, size.h);
  }, [size, tracePlaced, map, focus, depth]);

  // Frame the focus whenever it, the depth or the pane's size changes: a glide, except the first
  // picture, a resize and a map that has just been laid out, which frame at once.
  const framedFor = useRef<{ w: number; h: number } | null>(null);
  const framedEmpty = useRef(false);
  useLayoutEffect(() => {
    const target = framing();
    if (!target || !size) return;
    const resized = framedFor.current !== null && (framedFor.current.w !== size.w || framedFor.current.h !== size.h);
    moveTo(target, framedFor.current !== null && !resized && !framedEmpty.current);
    framedFor.current = size;
    framedEmpty.current = map.nodes.size === 0;
  }, [framing]);
  // What is drawn follows the filters and the Links switch at once.
  useEffect(() => { if (glide.current === null && !tracing && size) show(drawnAt(getViewport())); }, [drawnAt]);

  // The pane's size, observed once for the canvas's life.
  useLayoutEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const measure = (box: { width: number; height: number }) => {
      if (box.width <= 0 || box.height <= 0) return;
      setSize((s) => (s && Math.round(s.w) === Math.round(box.width) && Math.round(s.h) === Math.round(box.height) ? s : { w: box.width, h: box.height }));
    };
    measure(el.getBoundingClientRect());
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => measure(entries[0]?.contentRect ?? el.getBoundingClientRect()));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Free zoom and pan (wheel, pinch, drag, the zoom buttons) move the same camera; what is drawn
  // follows once a frame. A gesture during a glide takes over from it.
  const pending = useRef<number | null>(null);
  const follow = useCallback(() => {
    if (pending.current !== null || tracing) return;
    // Read when the frame comes, so it draws for the camera and the pane as they are then.
    pending.current = requestAnimationFrame(() => { pending.current = null; if (glide.current === null) show(latestDrawnAt.current(getViewport())); });
  }, [tracing, show, getViewport]);
  useEffect(() => () => { if (pending.current !== null) cancelAnimationFrame(pending.current); }, []);
  const onMove = useCallback((event: MouseEvent | TouchEvent | null) => {
    if (event && glide.current !== null) stopGlide();
    if (glide.current === null) follow();
  }, [follow]);

  const frameFocus = useCallback(() => { const t = framing(); if (t) moveTo(t, true); }, [framing, moveTo]);
  useCommand('graphFit', frameFocus, !!size);

  // ---- The boxes and lines ----
  const boxes = useMemo((): Box[] => {
    if (tracePlaced) {
      return graph.nodes.map((n) => ({ id: n.id, ...tracePlaced.positions.get(n.id)!, w: tracePlaced.widths.get(n.id)!, h: tracePlaced.heights.get(n.id)!, label: true, text: 1, parent: false }));
    }
    if (!drawn) return [];
    // What was drawn for the map before this one (the Voronoi map's empty stand-in, say) may name nodes this one lacks.
    const placed = drawn.boxes.filter((b) => map.nodes.has(b.id)).map((b) => { const n = map.nodes.get(b.id)!; return { id: b.id, x: n.x, y: n.y, w: n.w, h: n.h, label: b.label, text: n.text, parent: n.children.length > 0 }; });
    // Nested and Voronoi, a parent is drawn before its children, so each child lies over its parent (LA-EXP-DR63).
    if (map.view !== 'tree') placed.sort((a, b) => map.nodes.get(a.id)!.order - map.nodes.get(b.id)!.order);
    return placed;
  }, [tracePlaced, graph, drawn, map]);
  const order = useMemo(() => {
    if (tracing || map.view === 'tree') return keyboardOrder(boxes);
    return keyboardOrder(boxes, (id) => map.nodes.get(id)?.order ?? Infinity);
  }, [boxes, map, tracing]);

  const { nodes, edges } = useMemo(() => {
    const byId = new Map(boxes.map((b) => [b.id, b]));
    const nodes: FlowNode[] = boxes.map((b) => {
      const inNested = !tracing && map.view !== 'tree' ? map.nodes.get(b.id) as NestedNode | VoronoiNode : undefined;
      // Nested and Voronoi, a box's border grows with its text, so a large box's edge stays in proportion to its label, and its lines are the map's (LA-EXP-DR62, LA-EXP-DR64).
      const data = boxData(index, b.id, focus, b.label, inNested ? Math.max(0.5, b.text) : contentScale(b.w, b.h), b.text, b.parent, graph, inNested);
      if (inNested && 'header' in inNested) data.header = inNested.header;
      if (inNested && 'polygon' in inNested) {
        const r = (v: number) => Math.round(v * 100) / 100;
        data.cell = { points: inNested.polygon.map(([x, y]) => `${r(x - b.x)},${r(y - b.y)}`).join(' '), label: { x: inNested.label.x - b.x, y: inNested.label.y - b.y, w: inNested.label.w, h: inNested.label.h } };
      }
      return {
        id: b.id,
        type: 'box',
        position: { x: b.x, y: b.y },
        width: b.w,
        height: b.h,
        draggable: false,
        connectable: false,
        selectable: false,
        // Saying where the handles are means React Flow never has to measure a node.
        handles: nodeHandles(b.w, b.h),
        data,
        ...(b.label
          ? { ariaLabel: ariaName(data) }
          : { focusable: false, className: 'is-plain', domAttributes: { 'aria-hidden': true } }),
      };
    });
    if (!tracing && drawn && map.view === 'tree') {
      for (const bar of drawn.bars) {
        const level = map.levels[bar.level];
        nodes.push({ id: bar.id, type: 'bar', position: { x: level.x, y: bar.y }, width: level.width, height: bar.h, draggable: false, connectable: false, selectable: false, focusable: false, handles: nodeHandles(level.width, bar.h), data: { bar: true }, className: 'is-bar', domAttributes: { 'aria-hidden': true } });
      }
    }
    const edges: FlowEdge[] = [];
    if (tracing) {
      for (const e of graph.edges) {
        const s = byId.get(e.source);
        const t = byId.get(e.target);
        if (!s || !t) continue;
        const sc = centerOf(s);
        const tc = centerOf(t);
        edges.push({
          id: e.id, source: e.source, target: e.target, type: 'line', markerEnd: { type: MarkerType.ArrowClosed }, focusable: false, selectable: false,
          data: { relation: e.relation, points: [boxExit(sc.x, sc.y, tc.x, tc.y, s.w, s.h), boxExit(tc.x, tc.y, sc.x, sc.y, t.w, t.h)], label: graphEdgeLabel(index, e), link: true, scale: 1 },
        });
      }
      return { nodes, edges };
    }
    // The tree's parent lines: level, from the parent's right edge to the child's left edge, at the child's middle.
    // Nested has none: holding is the parent link (LA-EXP-DR62).
    if (parentShown && map.view === 'tree') {
      for (const b of boxes) {
        const up = map.nodes.get(b.id)?.parent;
        const p = up ? byId.get(up) : undefined;
        if (!p) continue;
        const shape = (id: string) => (index.byId.get(id)?.kind === 'domain' ? 'hexagon' as const : 'box' as const);
        edges.push({ id: `${p.id}|${PARENT}|${b.id}`, source: p.id, target: b.id, type: 'line', focusable: false, selectable: false, data: { relation: PARENT, points: parentLine(p, b, shape(p.id), shape(b.id)), label: '', link: false, scale: contentScale(b.w, b.h) } });
      }
    }
    // The Links switch: the focus's own links, as curves between their boxes; in the Voronoi view, between their cells' labels, inside the cells.
    const anchor = (b: Box) => { const n = map.nodes.get(b.id); return n && 'polygon' in n ? (n as VoronoiNode).label : b; };
    for (const e of graph.edges) {
      if (e.relation === PARENT) continue;
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) continue;
      edges.push({ id: e.id, source: e.source, target: e.target, type: 'line', markerEnd: { type: MarkerType.ArrowClosed }, focusable: false, selectable: false, data: { relation: e.relation, points: linkEnds(anchor(s), anchor(t)), label: graphEdgeLabel(index, e), link: true, scale: 1 } });
    }
    return { nodes, edges };
  }, [boxes, drawn, tracing, map, index, focus, graph, parentShown]);

  const domNode = (id: string) =>
    [...(wrapper.current?.querySelectorAll<HTMLElement>('.react-flow__node') ?? [])].find((el) => el.dataset.id === id) ?? null;

  // After a keyboard action, put focus back on the right node once it is drawn.
  useEffect(() => {
    if (!refocus.current) return;
    const id = refocus.current;
    const el = domNode(id);
    if (!el) return;
    refocus.current = null;
    el.focus({ preventScroll: true });
    active.current = id;
  }, [nodes]);

  /**
   * The hover spotlight: hovering or keyboard-focusing a labeled box brightens it, its lines and the
   * boxes they join, and dims the rest a step; leaving restores the picture. It writes classes
   * straight to the drawn elements, so nothing is drawn anew, and the CSS fades them with the
   * motion tokens (at once under reduced motion).
   */
  const spot = useCallback((id: string | null) => {
    const root = wrapper.current;
    if (!root) return;
    for (const el of root.querySelectorAll('.is-lit')) el.classList.remove('is-lit');
    const known = id !== null && !id.startsWith('bar:') && (map.nodes.has(id) || graph.nodes.some((n) => n.id === id));
    onPeek?.('hover', known && !id!.startsWith('file:') ? id : null);
    if (!known) { root.classList.remove('has-spotlight'); return; }
    const lit = new Set([id]);
    const edgeIds = new Set<string>();
    for (const e of edges) {
      if (e.source !== id && e.target !== id) continue;
      lit.add(e.source);
      lit.add(e.target);
      edgeIds.add(`${e.source} ${e.target}`);
    }
    // Nested and Voronoi, holding is the parent link: the box lights its parent and everything inside it, as the Tree view's parent lines light theirs.
    const held = map.view !== 'tree' ? map.nodes.get(id!) : undefined;
    if (held) {
      if (held.parent) lit.add(held.parent);
      const within = (n: string) => { for (const c of map.nodes.get(n)?.children ?? []) { lit.add(c); within(c); } };
      within(held.id);
    }
    root.classList.add('has-spotlight');
    for (const el of root.querySelectorAll<HTMLElement>('.react-flow__node')) if (lit.has(el.dataset.id ?? '')) el.classList.add('is-lit');
    for (const el of root.querySelectorAll<SVGGElement>('g.graph-edge-group')) if (edgeIds.has(`${el.dataset.source} ${el.dataset.target}`)) el.classList.add('is-lit');
  }, [edges, map, graph, onPeek]);
  // A new focus starts without a spotlight.
  useEffect(() => () => spot(null), [focus]);

  /** Whether a box can be focused by a click: a record or a group, not the focus, not a file or a bar. */
  const canOpen = useCallback((id: string) => !id.startsWith('file:') && !id.startsWith('bar:') && id !== focus && isGraphNode(index, id), [focus, index]);
  /** A click or Enter on a box: it becomes the focus, at its own address. */
  const activate = (id: string, fromKeyboard: boolean) => {
    if (!canOpen(id)) return;
    if (fromKeyboard) refocus.current = id;
    onNavigate(id);
  };
  // By touch, a first tap selects a node and a second tap (or the card's Open chip) opens it.
  const tap = useTapToOpen(onNavigate, canOpen, wrapper, focus);
  const armedBox = tap.armed ? nodes.find((n) => n.id === tap.armed && n.type === 'box') : undefined;
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

  // The edge hints count the linked records past each edge; a click brings the nearest of them into view.
  const linkedCenters = useMemo(() => (tracing ? [] : linked.flatMap((id) => { const n = map.nodes.get(id); return n && !hidden.has(id) ? [centerOf(n)] : []; })), [tracing, linked, map, hidden]);
  const panToward = useCallback((side: Side) => {
    if (!size) return;
    const v = getViewport();
    const at = (p: Point) => ({ x: p.x * v.zoom + v.x, y: p.y * v.zoom + v.y });
    const past = linkedCenters.filter((c) => {
      const s = at(c);
      return side === 'up' ? s.y < 0 : side === 'down' ? s.y > size.h : side === 'left' ? s.x < 0 : s.x > size.w;
    });
    const mid = { x: size.w / 2, y: size.h / 2 };
    const nearest = past.sort((a, b) => Math.hypot(at(a).x - mid.x, at(a).y - mid.y) - Math.hypot(at(b).x - mid.x, at(b).y - mid.y))[0];
    if (nearest) moveTo({ x: mid.x - nearest.x * v.zoom, y: mid.y - nearest.y * v.zoom, zoom: v.zoom }, true);
  }, [size, getViewport, linkedCenters, moveTo]);

  return (
    <div
      ref={wrapper}
      className={`graph-flow${nested && !tracing ? ' is-nested' : ''}${layout === 'voronoi' && !tracing ? ' is-voronoi' : ''}`}
      data-layout={tracing ? 'trace' : layout}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        const id = (e.target as HTMLElement).closest?.('.react-flow__node')?.getAttribute('data-id');
        if (id) active.current = id;
        spot(id ?? null);
      }}
      onBlur={() => spot(null)}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        autoPanOnNodeFocus={false}
        onNodeClick={(e, n) => { if (n.type === 'box') tap.onNodeClick(e, n.id); }}
        onNodeMouseEnter={(_, n) => { if (n.type === 'box') spot(n.id); }}
        onNodeMouseLeave={() => spot(null)}
        onPaneClick={tap.clear}
        onMove={onMove}
        onMoveEnd={() => { if (glide.current === null) follow(); }}
        minZoom={0.0005}
        maxZoom={MAX_ZOOM}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <MapBackground />
        <Controls showInteractive={false} showFitView={false}>
          <ControlButton onClick={frameFocus} className="graph-frame-focus" title="Frame the focus" aria-label="Frame the focus">
            <Icon name="maximize" size={14} />
          </ControlButton>
        </Controls>
      </ReactFlow>
      {minimap && !tracing && <MapOverview map={map} focus={focus} hidden={hidden} />}
      {!tracing && <EdgeHints centers={linkedCenters} wrapper={wrapper} noun="linked" onPan={panToward} />}
      {armedBox && (
        <TapCard
          kind={(armedBox.data as NodeData).group ? 'Group' : (armedBox.data as NodeData).kindLabel}
          name={(armedBox.data as NodeData).title}
          onOpen={tap.openArmed}
          onDismiss={tap.clear}
        />
      )}
    </div>
  );
}

