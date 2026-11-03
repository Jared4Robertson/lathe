// The Graph stage of an address, /<id>?stage=graph (LA-V93).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { useCommand } from '../shell/commands';
import { Tooltip } from '../shell/Tooltip';
import { Icon } from '../components/icons';
import { graphDrawn, graphKeyEntries } from './key';
import { useNodeClick } from './nodeClick';
import {
  NO_FILTERS,
  PARENT,
  filterKind,
  isFiltered,
  isGraphNode,
  kindGroups,
  neighborhood,
  type Filters,
  type Neighborhood,
} from './model';
import { graphTarget, graphWalkBar, graphWalkLabels, useGraphWalk } from './steps';
import { StageCamera, StageKey, StageToolbar, TidyUp, ZOOM_STEP } from '../views/StageChrome';
import { DEFAULT_GRAPH_SETTINGS } from '../exploring/session-settings/model';
import { keepCamera } from '../exploring/tab-set/commands/keep-camera';
import { keptCamera } from '../exploring/tab-set/reads';
import { runTabSetCommand } from '../exploring/tab-set/run';
import { mapRootOf, parentLine, type GraphMap, type PlacedMap } from './map';
import { lastLayout, tidyGround, useLaidOut } from './layout';
import { productInput } from './layout-input';
import { type NestedMap, type NestedNode } from './nested';
import { type GroundMap, type GroundNode } from './ground';
import { treeParent } from './tree';
import { CARRIES_OUT, linkLine, linksOf, MOST_LINKS, THEN } from './map-links';
import { thenPairs } from './sequence';
import { setTextMeasure, type TextMeasure } from './text';
import { BLOCK_BELOW_PX, drawnFor, drawnKey, drawnNested, frameGround, frameNested, frameOnMap, frameRect, keptBox, maxZoomFor, mergeDrawn, MIN_ZOOM, wholeIn, type Drawn, type Viewport } from './camera';
import { useCameraGestures } from './gestures';
import { readMotion } from './motion';
import { followBox, useMorph } from './morph';
import { nodeShape } from './shapes';
import { Button } from '../components/Button';
import { pageMeasure, readGraphFonts, readyMeasure, fontFor, type GraphFonts } from './fonts';
import { PLAIN_LOOK, readLook, useThemeVersion, type Look } from './look';
import { plateName, plateOf, plateTip, type Plate, type PlateSource } from './plate';
import { keepLabel } from './sticky';
import { focusStrength } from './fade';
import { boxColors, drawnLabel, paint, type WholePlace, type Bar, type Camera, type Line, type PaintState } from './paint';
import { hitPlate } from './hit';
import { frameIn, useOpenSpace, type Insets, type OpenSpaceStore } from '../views/openSpace';
import { drawLeaderLine, openIn, useLeaderFollow } from '../views/leaderLine';
import { useChanges } from '../changes/changes';
import { useChangesKey } from '../changes/ChangesKey';
import { rollupText } from '../changes/rollup';
import { GHOST_MS, highlightFade, marksMoving, useLiveVersion, useStageMarks } from '../changes/marks';
import { reachLit, reachLitLines, useReachLight } from '../traceability/change-reach/light';
import { useChangeReach } from '../traceability/change-reach/reads';

// The graph view: the product's tree as one fixed map (map.ts), explored by a camera (camera.ts).
// Clicking a record or a group focuses it (through onNavigate, so the host changes the address and
// Back walks back along the path), and the camera glides to frame it; nothing in the map moves or
// changes size. An obligation's chain is the Trace view's (app/src/trace).
//
// The map is drawn on a canvas, every frame (paint.ts): each box in view its shape, its colors and
// its label, the lines at the label's map size times the zoom, so text is crisp at any zoom. A
// visually hidden layer of the drawn boxes, in the keyboard's order, carries focus, the arrow keys
// (and W, A, S and D), Enter and Escape, and each box's role and name for assistive technology; the box it focuses gets
// the drawn focus ring. The pointer finds a box from the map's own outlines (hit.ts).
//
// GraphView is the graph on its own: it takes the focus and an onNavigate callback and never reads
// the address, so it can sit in any pane. The focus page (app/src/views/FocusPage.tsx) hosts it in
// the Graph stage and keeps its settings across pages.

/**
 * How the graph draws the product (LA-V93-R21): Tree, parents beside their children; Nested, parents made of them as
 * boxes; Map, domains as districts on the ground, records one size, links as lines (LA-V93-R74).
 */
export type GraphLayout = 'tree' | 'nested' | 'map';
export const GRAPH_LAYOUTS: readonly { layout: GraphLayout; label: string; tip: string }[] = [
  { layout: 'tree', label: 'Tree', tip: 'Tree: each parent beside its children' },
  { layout: 'nested', label: 'Nested', tip: 'Nested: each parent a box made of its children' },
  { layout: 'map', label: 'Map', tip: 'Map: domains as districts, every record one size, links as lines' },
];

/** What the person set on the graph: the view, depth, kind filters, the minimap and the Map's links. */
export interface GraphSettings {
  /** Tree, Nested or Map (LA-V93-R21). Tree by default. */
  layout: GraphLayout;
  depth: number;
  filters: Filters;
  /** The minimap in a corner of the canvas. Off by default. */
  minimap: boolean;
  /** In the Map, every link between the records drawn as a line, not only the focus's (LA-V93-R74). Off by default. */
  allLinks: boolean;
}
/** "1 record", "2 records". */
const count = (n: number, noun: string) => `${n} ${n === 1 ? noun : `${noun}s`}`;

export const MAX_DEPTH = 3;
const DEPTHS = [1, 2, 3];
/** Depth is how many levels below the focus the Tree draws, folders and stages included. The Nested view draws every level, so it has none. */
const DEPTH_LABELS = ['Draw the focus and its children', 'Draw two levels below the focus', 'Draw three levels below the focus'];
/** The view after this one, for the switch's command. */
export const nextLayout = (layout: GraphLayout): GraphLayout => GRAPH_LAYOUTS[(GRAPH_LAYOUTS.findIndex((l) => l.layout === layout) + 1) % GRAPH_LAYOUTS.length].layout;

/** The summary above the canvas, of the framed picture: "9 records · 2 groups · 8 links". */
export function graphSummary(graph: Neighborhood): string {
  const groups = graph.nodes.filter((n) => n.group).length;
  return `${count(graph.nodes.length - groups, 'record')}${groups > 0 ? ` · ${count(groups, 'group')}` : ''} · ${count(graph.edges.length, 'link')}`;
}

export interface GraphViewProps {
  index: RecordIndex;
  /** A record ID, or a group's ID in the graph's tree. */
  focus: string;
  /** Called with a record or group ID when the person moves the focus there. */
  onNavigate: (id: string) => void;
  /** The settings, when the host keeps them (so they survive moving between pages and views). */
  settings?: GraphSettings;
  onSettingsChange?: (settings: GraphSettings) => void;
  /** Called with what the graph draws of the focus, for the header strip: "9 records · 8 links". */
  onCounts?: (counts: string) => void;
  /** The open space the host's floating panels leave over the stage, where the camera frames the focus. */
  space?: OpenSpaceStore;
  /** The place the graph shows (the Tab set's cameras, exploring/tab-set): its camera is kept as the place is left and taken back as it shows again. */
  cameraKey?: string;
  /** Opens a box in a new place (Cmd or Ctrl+click, or a middle-click for the background), when the host has places. */
  onOpenNew?: (id: string, background: boolean) => void;
}

export function GraphView({ index, focus, onNavigate, settings: hosted, onSettingsChange, onCounts, space, cameraKey, onOpenNew }: GraphViewProps) {
  const [own, setOwn] = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const settings = hosted ?? own;
  const { layout, depth, filters, minimap, allLinks } = settings;
  const latest = useRef(settings);
  latest.current = settings;
  const update = useCallback((patch: Partial<GraphSettings>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    if (onSettingsChange) onSettingsChange(next); else setOwn(next);
  }, [onSettingsChange]);
  const setDepth = (d: number) => update({ depth: d });
  const setFilters = (f: Filters) => update({ filters: f });

  const graph = useMemo(() => neighborhood(index, focus, depth, filters), [index, focus, depth, filters]);
  // The Change reach light (LA-V93-R78): the focus record and everything a change of it would touch, lit while it is on.
  const [reachOn, setReachOn] = useReachLight();
  const reachable = reachOn && index.byId.has(focus) && index.byId.get(focus)!.kind !== 'product';
  const reachRead = useChangeReach(reachable ? focus : null, index);
  const reach = useMemo(() => (reachable && reachRead.state === 'read' && reachRead.answer.changed[0] === focus ? reachLit(reachRead.answer) : null), [reachable, reachRead, focus]);
  // The key bar: what the graph draws now, then the live marks.
  const valid = isGraphNode(index, focus);
  const drawn = useMemo(() => (valid ? graphDrawn(index, graph, layout) : null), [valid, index, graph, layout]);
  const changesKey = useChangesKey();
  const keyEntries = useMemo(() => (drawn ? [...graphKeyEntries(drawn, index.meta.stages), ...changesKey] : []), [drawn, index, changesKey]);
  // Before paint, so the header strip's counts change in the same frame as the graph (LA-PAT-APP-UX-R08).
  useLayoutEffect(() => { onCounts?.(graphSummary(graph)); }, [graph, onCounts]);

  const clearFilters = useCallback(() => update({ filters: NO_FILTERS }), [update]);
  const onPageKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && isFiltered(filters)) { e.preventDefault(); clearFilters(); }
  };
  useCommand('graphDepthUp', () => update({ depth: Math.min(MAX_DEPTH, latest.current.depth + 1) }), valid && layout === 'tree');
  useCommand('graphDepthDown', () => update({ depth: Math.max(1, latest.current.depth - 1) }), valid && layout === 'tree');
  useCommand('graphLayout', () => update({ layout: nextLayout(latest.current.layout) }), valid);
  if (!valid) {
    return (
      <div className="placeholder graph-missing">
        <p>There's no record or group <code>{focus}</code>.</p>
      </div>
    );
  }
  // The shared stage toolbar (views/StageChrome.tsx): the steps, Out, In and Frame, the Changes controls, then the layout
  // switch, the filters and, in the Map, Tidy up (primary, always in the row), and depth (secondary, folding into More). In the toolbar's
  // narrow form the layouts are one Layout menu, each still named by its word. The key is a bar along the bottom (StageKey).
  const tools = (narrow: boolean) => ({
    primary: (
      <>
        {narrow ? (
          // Too narrow for the three words (a 320 px phone): one Layout menu naming the layout shown, never a letter
          // (LA-V93-R21); the phone's own picker opens on one tap.
          <Tooltip label="Layout" command="graphLayout">
            <select className="graph-layout-pick" aria-label="Layout" value={layout} onChange={(e) => update({ layout: e.target.value as GraphLayout })}>
              {GRAPH_LAYOUTS.map((l) => <option key={l.layout} value={l.layout}>{l.label}</option>)}
            </select>
          </Tooltip>
        ) : (
          <div className="graph-depth graph-layout" role="group" aria-label="Layout">
            {GRAPH_LAYOUTS.map((l) => (
              <Tooltip key={l.layout} label={l.tip} command={l.layout !== layout ? 'graphLayout' : undefined}>
                <button type="button" aria-pressed={layout === l.layout} onClick={() => update({ layout: l.layout })}>{l.label}</button>
              </Tooltip>
            ))}
          </div>
        )}
        <FilterControls index={index} filters={filters} setFilters={setFilters} minimap={minimap} setMinimap={(on) => update({ minimap: on })} allLinks={layout === 'map' ? allLinks : null} setAllLinks={(on) => update({ allLinks: on })} reach={reachOn} setReach={setReachOn} />
        {layout === 'map' && <TidyUp />}
      </>
    ),
    // Depth is the Tree camera's alone: elsewhere the group keeps its slot, so nothing beside it moves, but is not shown or reachable (LA-PAT-APP-CODE-R21).
    secondary: (
      <div className={`graph-depth${narrow ? ' is-narrow' : ''}${layout === 'tree' ? '' : ' is-idle'}`} role="group" aria-label="Depth" aria-hidden={layout !== 'tree' || undefined} inert={layout !== 'tree' || undefined}>
        <span className="graph-depth-name">Depth</span>
        {DEPTHS.map((d) => (
          <Tooltip key={d} label={DEPTH_LABELS[d - 1]} command={d === depth + 1 ? 'graphDepthUp' : d === depth - 1 ? 'graphDepthDown' : undefined}>
            <button type="button" aria-pressed={depth === d} onClick={() => setDepth(d)}>{d}</button>
          </Tooltip>
        ))}
      </div>
    ),
  });

  return (
    <section className="graph-page" aria-label="Graph" onKeyDown={onPageKey}>
      {/* The toolbar floats at the top of the open space, one row at every width (LA-PAT-APP-UX-R08). */}
      <StageToolbar
        can={(move) => graphTarget(index, focus, layout, move) !== null}
        walkLabels={graphWalkLabels(layout)}
        bar={graphWalkBar(layout)}
        own={tools}
        measureKey={`${layout}|${filters.hiddenKinds.size}`}
      />
      <StageKey entries={keyEntries} beside={minimap ? 'minimap' : undefined} />
      <div className="graph-workspace">
        <div className="graph-canvas">
          <GraphCanvas index={index} graph={graph} layout={layout} depth={depth} filters={filters} onNavigate={onNavigate} minimap={minimap} allLinks={allLinks} reach={reach} space={space} cameraKey={cameraKey} onOpenNew={onOpenNew} />
        </div>
      </div>
    </section>
  );
}

interface FilterProps {
  index: RecordIndex;
  filters: Filters;
  setFilters: (f: Filters) => void;
  minimap: boolean;
  setMinimap: (on: boolean) => void;
  /** All links, in the Map; null in the other layouts, which draw no links. */
  allLinks: boolean | null;
  setAllLinks: (on: boolean) => void;
  /** The Change reach light (LA-V93-R78): on or off. */
  reach: boolean;
  setReach: (on: boolean) => void;
}

function FilterControls({ index, filters, setFilters, minimap, setMinimap, allLinks, setAllLinks, reach, setReach }: FilterProps) {
  const hidden = filters.hiddenKinds.size;
  const toggle = (set: ReadonlySet<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  };
  return (
    <details className="graph-filters">
      {/* In a narrow toolbar only the icon shows; the name stays the summary's text (LA-PAT-APP-UX-R08). */}
      <Tooltip label="Filters">
        <summary><Icon name="filter" size={14} /><span className="graph-filters-name">Filters</span>{hidden > 0 && <span className="section-count">{hidden} hidden</span>}</summary>
      </Tooltip>
      <div className="graph-filter-body">
        <fieldset>
          <legend>Picture</legend>
          <label>
            <input type="checkbox" role="switch" checked={minimap} onChange={(e) => setMinimap(e.target.checked)} />
            Minimap
          </label>
          {allLinks !== null && (
            <label>
              <input type="checkbox" role="switch" checked={allLinks} onChange={(e) => setAllLinks(e.target.checked)} />
              All links
            </label>
          )}
          <label>
            <input type="checkbox" role="switch" checked={reach} onChange={(e) => setReach(e.target.checked)} />
            Change reach
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
        <div className="graph-filter-actions">
          <Button onClick={() => setFilters(NO_FILTERS)} disabled={hidden === 0}>Clear filters</Button>
        </div>
        <p className="hint">Escape clears every filter.</p>
      </div>
    </details>
  );
}

/** The node the Map frames for a focus: the focus, or for a group of the Tree's the Map does not draw (a kind group), the nearest node above it the Map has. A record not on the Map yet stays itself, so the camera waits for its layout. */
function onGround(index: RecordIndex, map: PlacedMap, focus: string): string {
  if (map.nodes.has(focus) || index.byId.has(focus)) return focus;
  for (let at = treeParent(index, focus); at !== null; at = treeParent(index, at)) if (map.nodes.has(at)) return at;
  return focus;
}

/** A box on the canvas with its place and size, in world coordinates. */
export interface Box { id: string; x: number; y: number; w: number; h: number; text: number; parent: boolean }

/**
 * The drawn boxes in reading order for the keyboard: in the Tree view column by column, left to
 * right, then top to bottom; in the Nested view (given each box's place in the tree's order) a
 * parent before its children.
 */
export function keyboardOrder(boxes: readonly Pick<Box, 'id' | 'x' | 'y'>[], treeOrder?: (id: string) => number): string[] {
  const all = [...boxes];
  return (treeOrder ? all.sort((a, b) => treeOrder(a.id) - treeOrder(b.id)) : all.sort((a, b) => a.x - b.x || a.y - b.y)).map((b) => b.id);
}

/**
 * The nodes hidden by the kind filters (LA-V93-R13): a node of a hidden kind and everything
 * beneath it. The focus and its ancestors are never hidden. The map keeps their places.
 */
export function hiddenNodes(index: RecordIndex, map: PlacedMap, filters: Filters, focus: string): Set<string> {
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


/**
 * The minimap (LA-V93-R20): a true overview of the one map, its upper levels as boxes (as many
 * as stay readable, at most about 400), the focus solid, and the viewport outlined as the camera
 * moves.
 */
function MapOverview({ map, focus, hidden, view }: { map: PlacedMap; focus: string; hidden: ReadonlySet<string>; view: string }) {
  const shapeOf = (n: PlacedMap['byLevel'][number][number], className: string) => <rect key={n.id} className={className} x={n.x} y={n.y} width={n.w} height={n.h} />;
  const boxes = useMemo(() => {
    const out = [];
    for (const level of map.byLevel) {
      if (out.length + level.length > 400) break;
      out.push(...level.filter((n) => !hidden.has(n.id)));
    }
    return out;
  }, [map, hidden]);
  const [vx, vy, vw, vh] = view.split(' ').map(Number);
  const f = map.nodes.get(focus);
  const W = 200;
  const H = Math.min(200, Math.max(80, (W * map.height) / Math.max(1, map.width)));
  const pad = Math.max(map.width, map.height) * 0.02;
  return (
    // A floating panel at the bottom (openSpace.ts): the camera frames the focus above it, never under it (LA-PAT-APP-UX-R23).
    <div className="graph-minimap" data-floating="bottom">
      <svg role="img" aria-label="Minimap" width={W} height={H} viewBox={`${-pad} ${-pad} ${map.width + 2 * pad} ${map.height + 2 * pad}`} preserveAspectRatio="xMidYMid meet">
        {boxes.map((n) => shapeOf(n, 'graph-minimap-node'))}
        {f && shapeOf(f, 'graph-minimap-node is-focus')}
        <MinimapChanges map={map} pad={pad} />
        <rect className="graph-minimap-view" x={vx} y={vy} width={vw} height={vh} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}


/** Highlight changes' markers on the minimap (LA-V93-R20): a dot at each changed record's box, in the change's color, big enough to see at any size. */
function MinimapChanges({ map, pad }: { map: PlacedMap; pad: number }) {
  const { highlight, byId, live } = useChanges();
  const version = useLiveVersion();
  const marks = useMemo(() => {
    if (!highlight) return [];
    const out: { id: string; change: string; x: number; y: number }[] = [];
    const ids = new Set([...byId.keys(), ...live.all().map((m) => m.id)]);
    for (const id of ids) {
      const n = map.nodes.get(id);
      const change = byId.get(id)?.change ?? live.get(id)?.change;
      if (n && change && change !== 'removed') out.push({ id, change, x: n.x + n.w / 2, y: n.y + n.h / 2 });
    }
    return out;
  }, [highlight, byId, live, map, version]);
  const r = pad * 0.9;
  return <>{marks.map((m) => <circle key={m.id} className={`graph-minimap-change is-${m.change}`} cx={m.x} cy={m.y} r={r} />)}</>;
}

/** The spotlight's ID while it holds the Change reach light, which no record or group has. */
const REACH_SPOT = ' reach';

/** No floating panels: the frame is the whole stage. */
const NO_INSETS: Insets = { left: 0, top: 0, right: 0, bottom: 0 };
/** How far the pointer moves before a press is a drag, in CSS pixels. */

/** One drawn box in the scene the test hook reports, in the page's pixels. */
export interface SceneBox {
  id: string;
  kind: string;
  stage: string;
  shape: string;
  view: string;
  focus: boolean;
  /** Whether it is one of the focus's direct children, drawn whole with a readable label (LA-V93-R77). */
  child: boolean;
  group: boolean;
  /** Its states as drawn: under the pointer, ringed by the keyboard, lit by the spotlight (null without one). */
  hover: boolean;
  ring: boolean;
  lit: boolean | null;
  /** How strongly the focus fade draws it (LA-EXP-DS09): 1 in the focus's subtree, less outside it, eased while the fade follows a new focus. */
  strength: number;
  /** Its live mark (changes/marks.ts): new or changed as the data reloaded, or null. */
  change: 'added' | 'changed' | null;
  /** With Highlight changes on: its pill (New, Changed) and its container's roll-up, null for none (changes/marks.ts). */
  pill: 'added' | 'changed' | null;
  rollup: string | null;
  /** Its box in the map, and its text's and border's scales there: fixed by the map, never by the camera. */
  map: { x: number; y: number; w: number; h: number };
  textScale: number;
  boxScale: number;
  rect: Rect;
  /** Its outline's corners on screen, for a polygon. */
  polygon: [number, number][] | null;
  label: Rect;
  /** Whether it is drawn as a plain block, its title under the readable size on screen (LA-EXP-DS10): then no line, icon or badge of it is drawn. */
  block: boolean;
  /** Each line of its label: its text, face, font size in the map and on screen, the font it is drawn in, its place, and its width as the canvas measures it at its drawn font. */
  lines: { text: string; face: string; level: string; mapPx: number; fontPx: number; font: string; rect: Rect; drawnWidth: number }[];
  icons: { draw: string; name: string; rect: Rect }[];
  badges: { label: string; tone: string; rect: Rect }[];
  tip: string;
  name: string;
}
type Rect = { left: number; top: number; width: number; height: number };
/** What the canvas draws now, as the test hook reports it (LA-PAT-APP-UX-R12): every drawn box with its label lines and their font sizes. */
export interface Scene {
  layout: string;
  camera: { x: number; y: number; zoom: number };
  /** How many times the camera has moved since the canvas was drawn first, and how many of those moves were glides. */
  moves: number;
  glides: number;
  canvas: Rect;
  /** The title size on screen, in CSS pixels, under which a box is drawn as a plain block. */
  blockBelowPx: number;
  boxes: SceneBox[];
  bars: Rect[];
  lines: { id: string; source: string; target: string; style: string; link: boolean; lit: boolean | null; points: [number, number][] }[];
  spotlight: boolean;
  /** The removed records' ghosts drawn now, by ID. */
  ghosts: string[];
  /** The last map laid out (layout.ts): on which thread, in how many milliseconds, and how many boxes. */
  laidOut: ReturnType<typeof lastLayout>;
}
/** A camera as the scene reports it: to a hundredth of a pixel, and the zoom to nine significant digits. */
export const roundCamera = (v: Viewport) => ({ x: Math.round(v.x * 100) / 100, y: Math.round(v.y * 100) / 100, zoom: Number(v.zoom.toPrecision(9)) });

/** The canvas's element, with the hooks the tests read the drawn scene and hit-test through. */
export type SceneHost = HTMLDivElement & { graphScene?: () => Scene; graphHit?: (clientX: number, clientY: number) => string | null };

/** A tiny store of the camera, so the parts that follow it (the edge hints, the minimap) draw again only when what they show changes. */
function cameraStore() {
  const listeners = new Set<() => void>();
  return {
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
    notify: () => { for (const l of listeners) l(); },
  };
}

/**
 * The canvas, once the label's faces have loaded and the text measure is ready (fonts.ts): the maps
 * are laid out with that measure, and the canvas draws with those faces.
 */
function GraphCanvas(props: CanvasProps) {
  const theme = useThemeVersion();
  const fonts = useMemo<GraphFonts>(() => readGraphFonts(), [theme]);
  const [measure, setMeasure] = useState<TextMeasure | null>(() => { void pageMeasure(fonts); return readyMeasure(fonts); });
  useEffect(() => {
    let live = true;
    void pageMeasure(fonts).then((m) => { if (live) setMeasure(m); });
    return () => { live = false; };
  }, [fonts.body, fonts.mono]);
  if (!measure) return <div className="graph-flow" data-layout={props.layout} aria-busy="true" />;
  setTextMeasure(measure);
  return <GraphStage {...props} measure={measure} fonts={fonts} theme={theme} />;
}

interface CanvasProps {
  index: RecordIndex;
  graph: Neighborhood;
  layout: GraphLayout;
  depth: number;
  filters: Filters;
  onNavigate: (id: string) => void;
  minimap: boolean;
  allLinks: boolean;
  /** The records the Change reach light lights (the focus and what a change of it would touch), or null while it is off. */
  reach: ReadonlySet<string> | null;
  space?: OpenSpaceStore;
  cameraKey?: string;
  onOpenNew?: GraphViewProps['onOpenNew'];
}

/**
 * The focus's own product's map (no other product's nodes are in it), in any layout (LA-V93-R21): the Tree map (map.ts),
 * or the Nested map (nested.ts), under one camera. It is laid out off the main thread, and again only when what it reads
 * changes (layout.ts); until a new one is ready, the one before stays on screen with the index it was laid out from.
 */
function GraphStage(props: CanvasProps & { measure: TextMeasure; fonts: GraphFonts; theme: number }) {
  const { index, graph, layout, measure, fonts } = props;
  // The Map is always the product's ground; the Tree and Nested maps the focus's product's tree.
  const root = useMemo(() => (layout === 'map' ? index.product : mapRootOf(index, graph.focus)), [index, graph.focus, layout]);
  const input = useMemo(() => productInput(index, root, layout, measure.key), [index, root, layout, measure]);
  // Tidy up (LA-PAT-APP-UX-R22): the Map laid out afresh, by the stage's shared command and button; every later change
  // keeps its places from it. The Tree and Nested maps are laid out top-down, so they have nothing to tidy.
  const [tidy, setTidy] = useState(0);
  useCommand('stageTidy', () => { tidyGround(input); setTidy((t) => t + 1); }, layout === 'map');
  const laid = useLaidOut<GraphMap | NestedMap | GroundMap, RecordIndex>(input, index, fonts, tidy);
  if (!laid) return <div className="graph-flow" data-layout={layout} aria-busy="true" />;
  return <GraphScene {...props} map={laid.map} mapIndex={laid.of} />;
}

function GraphScene({ index: pageIndex, mapIndex: index, map, graph, layout, depth, filters, onNavigate, minimap, allLinks, reach, space, cameraKey, onOpenNew, measure, fonts, theme }: CanvasProps & { measure: TextMeasure; fonts: GraphFonts; theme: number; map: GraphMap | NestedMap | GroundMap; mapIndex: RecordIndex }) {
  const focus = graph.focus;
  const wrapper = useRef<SceneHost>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const active = useRef<string | null>(null);
  /** After a keyboard action, the node to put keyboard focus on once the camera has framed it. */
  const refocus = useRef<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const hidden = useMemo(() => hiddenNodes(index, map, filters, focus), [index, map, filters, focus]);
  /** The most the camera zooms in on this map: enough to read its smallest box (maxZoomFor). */
  const maxZoom = useMemo(() => maxZoomFor(map), [map]);
  /** The box the camera frames for the focus: the focus, or on the Map the nearest box above it the Map draws (onGround). */
  const framed = map.view === 'map' ? onGround(index, map, focus) : focus;
  /** The focus's direct children: each drawn whole, its own box with a readable label, whatever its size (LA-V93-R77). */
  /** Each child's label sits at its top where it holds others in Nested and the Map (over them), else in its middle. */
  const whole = useMemo(() => new Map<string, WholePlace>((map.nodes.get(framed)?.children ?? []).map((c) => [c, map.view !== 'tree' && (map.nodes.get(c)?.children.length ?? 0) > 0 ? 'top' : 'middle'])), [map, framed]);
  /** The focus and its direct children: drawn whatever their size. */
  const always = useMemo(() => [focus, ...whole.keys()], [focus, whole]);
  /** What a new layout moved glides from where it was (morph.ts, LA-PAT-APP-UX-R22). */
  const morph = useMorph(map);

  // ---- The camera ----
  const view = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const store = useMemo(cameraStore, []);
  const frameRequest = useRef<number | null>(null);
  const paintRef = useRef<() => void>(() => {});
  const requestPaint = useCallback(() => {
    if (frameRequest.current !== null) return;
    frameRequest.current = requestAnimationFrame(() => { frameRequest.current = null; paintRef.current(); });
  }, []);
  useEffect(() => () => { if (frameRequest.current !== null) cancelAnimationFrame(frameRequest.current); frameRequest.current = null; }, []);
  const getViewport = useCallback(() => view.current, []);
  /** How many times the camera has moved, and how many of its moves were glides: what the scene reports. */
  const moves = useRef({ moves: 0, glides: 0 });
  const setViewport = useCallback((v: Viewport) => { view.current = v; moves.current.moves++; requestPaint(); store.notify(); }, [requestPaint, store]);

  // ---- What the keyboard's layer holds: the level of detail for the camera (LA-EXP-DS10) ----
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
      ? drawnNested(map, v, size.w, size.h, always)
      : drawnFor(map, v, size.w, size.h, always, (map.nodes.get(focus)?.level ?? 0) + depth);
    return { boxes: d.boxes.filter((b) => !hidden.has(b.id)), bars: d.bars.filter((b) => !hidden.has(b.parent)) };
  }, [map, size, always, hidden, focus, depth]);
  const latestDrawnAt = useRef(drawnAt);
  latestDrawnAt.current = drawnAt;

  // The camera's glide, zoom and pointer (gestures.ts, shared with the Trace stage). Everything a glide passes over
  // joins the keyboard's layer once, as it starts, and is trimmed when it ends; a move at once shows what is there.
  const gestures = useCameraGestures({
    canvas,
    size,
    getViewport,
    setViewport,
    zoom: { min: MIN_ZOOM, max: maxZoom },
    onGlide: (path) => { show(mergeDrawn([0, 0.25, 0.5, 0.75, 1].map((t) => drawnAt(path.at(t))))); moves.current.glides++; },
    onArrive: (target) => show(latestDrawnAt.current(target)),
    onGesture: () => follow(),
    // A click on the canvas gives the graph keyboard focus, so Tab goes on from it into the boxes.
    onPress: () => { if (!wrapper.current?.contains(document.activeElement)) wrapper.current?.focus({ preventScroll: true }); },
    onHover: (x, y) => setHover(hitAt(x, y)?.id ?? null),
    onTap: (x, y, e) => { const hit = hitAt(x, y); if (hit) nodeClick.onNodeClick(e, hit.id); },
  });
  const { moveTo } = gestures;

  // The frame: the open space the floating panels leave over the stage, less the stage's own tools
  // (openSpace.ts). The camera frames the focus there, so it sits centered in what is left.
  const open = useOpenSpace(space);
  const inset: Insets = open?.frame ?? NO_INSETS;
  const insetKey = `${inset.left} ${inset.top} ${inset.right} ${inset.bottom}`;
  const frameBox = useCallback((s: { w: number; h: number }) => frameIn(s, inset), [insetKey]);

  // ---- The plates (plate.ts): each box's outline and label, made once per map ----
  const plates = useMemo(() => new Map<string, Plate>(), [map, index, measure]);
  const plateFor = useCallback((id: string): Plate | null => {
    const known = plates.get(id);
    if (known) return known;
    const n = map.nodes.get(id);
    if (!n) return null;
    const source: PlateSource = map.view === 'tree' ? { view: 'tree', node: n } : map.view === 'map' ? { view: 'map', node: n as GroundNode } : { view: 'nested', node: n as NestedNode };
    const plate = plateOf(index, id, source);
    plates.set(id, plate);
    return plate;
  }, [plates, map, index]);

  /** The camera that frames the focus: most of the frame's width, its parent's strip at the left (LA-EXP-DS09). */
  const framing = useCallback((): Viewport | null => {
    // With a host that floats panels, never before their first measure: the first picture is framed once, in place.
    // A focus the map shown does not hold yet (its new layout is still being made) leaves the camera where it is.
    // The Map draws no kind group of the Tree's: a focus on one frames the nearest box above it that the Map has.
    if (!size || (space && !open) || !map.nodes.has(framed)) return null;
    const box = frameBox(size);
    // The focus is never left without its label: where its visible part cannot hold it, the camera moves to where it can;
    // and the focused box is always whole in the frame, with its children's column in the Tree, or where its children
    // cannot read with it whole, the part of it the framing chose (keptBox, LA-PAT-APP-UX-R23).
    const plate = plateFor(framed);
    const v = map.view === 'map' ? frameGround(map, framed, box.w, box.h, maxZoom) : map.view === 'nested' ? frameNested(map, framed, box.w, box.h, maxZoom) : frameOnMap(map, framed, box.w, box.h, maxZoom);
    const at = { x: v.x + box.x, y: v.y + box.y, zoom: v.zoom };
    const kept = keptBox(map, framed, v, box.w, box.h)!;
    return wholeIn(plate ? keepLabel(plate, at, { left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h }) : at, kept, box);
  }, [size, map, framed, frameBox, space, open, plateFor]);

  // Frame the focus whenever it, the stage's size or the open space changes: a glide,
  // except the first picture, a resize of the stage and a map that has just been laid out, which
  // frame at once. A panel collapsed, opened or resized recenters the focus with a short glide
  // (at once under reduced motion, readMotion).
  const framedFor = useRef<{ w: number; h: number } | null>(null);
  /** The focus fade's move to a new focus (fade.ts): from the focus before, eased over the camera's glide to the new one. */
  const fadeShift = useRef<{ from: string | null; to: string; start: number; duration: number }>({ from: null, to: focus, start: 0, duration: 0 });
  const framedEmpty = useRef(false);

  // Each place keeps its camera (the Tab set's cameras, exploring/tab-set): as the place shown changes (another tab), the one left keeps where
  // its camera was, and the one shown takes its own back, at once, when it still frames the same focus and layout.
  const framedNow = `${focus} ${layout}`;
  const cameraPlace = useRef<{ key: string | undefined; framed: string }>({ key: cameraKey, framed: framedNow });
  /** A kept camera waiting for the stage's first measure; and the framing a camera taken back stands in for. */
  const keptView = useRef<Viewport | null>(cameraKey ? keptCamera<Viewport>(cameraKey, 'graph', framedNow) : null);
  const skipFraming = useRef<unknown>(null);
  useLayoutEffect(() => {
    const was = cameraPlace.current;
    if (was.key === cameraKey) { cameraPlace.current = { key: cameraKey, framed: framedNow }; return; }
    if (was.key && sizeRef.current) runTabSetCommand(keepCamera, { place: was.key, stage: 'graph', camera: { framed: was.framed, view: view.current } });
    cameraPlace.current = { key: cameraKey, framed: framedNow };
    const back = cameraKey ? keptCamera<Viewport>(cameraKey, 'graph', framedNow) : null;
    if (back && size) {
      moveTo(back, false);
      framedFor.current = size;
      fadeShift.current = { from: null, to: focus, start: 0, duration: 0 };
      skipFraming.current = framing;
    } else keptView.current = back;
  });
  useEffect(() => () => {
    const { key, framed } = cameraPlace.current;
    if (key && sizeRef.current) runTabSetCommand(keepCamera, { place: key, stage: 'graph', camera: { framed, view: view.current } });
  }, []);
  /**
   * What the camera last framed: the focus's box on its map, the stage's size and open space. New data that
   * leaves all of them alone leaves the camera where it is; where it moved the focus, the camera glides with it (LA-PAT-APP-UX-R22).
   */
  const lastFramed = useRef<{ key: string; box: { x: number; y: number; w: number; h: number } } | null>(null);
  const framedKey = size ? `${focus} ${map.view} ${map.roots[0]} ${size.w}x${size.h} ${insetKey}` : '';
  const rememberFraming = () => { const n = map.nodes.get(focus); lastFramed.current = n && size ? { key: framedKey, box: { x: n.x, y: n.y, w: n.w, h: n.h } } : null; };
  useLayoutEffect(() => {
    if (skipFraming.current === framing) { skipFraming.current = null; rememberFraming(); return; }
    const kept = keptView.current;
    const was = lastFramed.current;
    const node = map.nodes.get(focus);
    if (!kept && was && node && was.key === framedKey) {
      const follow = followBox(view.current, was.box, node, { min: MIN_ZOOM, max: maxZoom });
      rememberFraming();
      // Following the focus keeps it whole too, with what its framing keeps (keptBox, LA-PAT-APP-UX-R23).
      if (follow && size) {
        const box = frameBox(size);
        moveTo(wholeIn(follow, keptBox(map, focus, { x: follow.x - box.x, y: follow.y - box.y, zoom: follow.zoom }, box.w, box.h) ?? node, box), true);
      }
      return;
    }
    const target = kept ?? framing();
    if (!target || !size || (kept && !framing())) return;
    keptView.current = null;
    const resized = framedFor.current !== null && (framedFor.current.w !== size.w || framedFor.current.h !== size.h);
    const duration = moveTo(target, !kept && framedFor.current !== null && !resized && !framedEmpty.current);
    if (fadeShift.current.to !== focus) fadeShift.current = { from: fadeShift.current.to, to: focus, start: performance.now(), duration };
    framedFor.current = size;
    framedEmpty.current = map.nodes.size === 0;
    rememberFraming();
  }, [framing]);
  // What is drawn follows the filters at once.
  useEffect(() => { if (!gestures.gliding() && size) show(drawnAt(getViewport())); requestPaint(); }, [drawnAt]);

  // The pane's size, observed once for the canvas's life.
  useLayoutEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const measureBox = (box: { width: number; height: number }) => {
      if (box.width <= 0 || box.height <= 0) return;
      setSize((s) => (s && Math.round(s.w) === Math.round(box.width) && Math.round(s.h) === Math.round(box.height) ? s : { w: box.width, h: box.height }));
    };
    measureBox(el.getBoundingClientRect());
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => measureBox(entries[0]?.contentRect ?? el.getBoundingClientRect()));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The canvas's backing store: the pane's size at the screen's pixel ratio, so every line is sharp.
  const [dpr, setDpr] = useState(() => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const changed = () => setDpr(window.devicePixelRatio || 1);
    query.addEventListener?.('change', changed);
    return () => query.removeEventListener?.('change', changed);
  }, [dpr]);
  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c || !size) return;
    c.width = Math.max(1, Math.round(size.w * dpr));
    c.height = Math.max(1, Math.round(size.h * dpr));
    paintRef.current();
    store.notify();
  }, [size, dpr]);

  // Free zoom and pan (wheel, pinch, drag, the zoom buttons) move the same camera; the keyboard's
  // layer follows once a frame. A gesture during a glide takes over from it.
  const pending = useRef<number | null>(null);
  const follow = useCallback(() => {
    if (pending.current !== null) return;
    pending.current = requestAnimationFrame(() => { pending.current = null; if (!gestures.gliding()) show(latestDrawnAt.current(getViewport())); });
  }, [show, getViewport]);
  useEffect(() => () => { if (pending.current !== null) cancelAnimationFrame(pending.current); pending.current = null; }, []);

  /** The zoom buttons: about the frame's center, the middle of what the panels leave open. */
  const zoomButton = (factor: number) => () => {
    if (!size) return;
    const box = frameBox(size);
    gestures.zoomBy(box.x + box.w / 2, box.y + box.h / 2, factor);
    follow();
  };

  const frameFocus = useCallback(() => { const t = framing(); if (t) moveTo(t, true); }, [framing, moveTo]);
  useCommand('graphFit', frameFocus, !!size);
  /** The camera's Fit: the whole map in the frame. */
  const fitMap = () => {
    if (!size || map.nodes.size === 0) return;
    moveTo(frameRect({ x: 0, y: 0, w: map.width, h: map.height }, frameBox(size), { pad: 24, read: MIN_ZOOM, max: maxZoom, min: MIN_ZOOM }), true);
    follow();
  };

  // ---- The plates and lines (plate.ts, paint.ts) ----
  const look = useRef<Look>(PLAIN_LOOK);
  useLayoutEffect(() => { if (wrapper.current) look.current = readLook(wrapper.current); requestPaint(); }, [theme]);


  /** The Map's "then" arrows: each step to the next on its path, inside every journey and flow it holds. */
  const thenLines = useMemo(() => (map.view === 'map' ? [...map.nodes.values()].flatMap((n) => (n.children.length > 1 ? thenPairs(index, n.children) : [])) : []), [map, index]);

  /** The boxes, bars and lines a camera shows, in draw order: in the Nested view a parent before its children, so each child lies over its parent (LA-EXP-DS09). */
  const frameAt = useCallback((v: Viewport): { plates: Plate[]; bars: Bar[]; lines: Line[] } => {
    const drawn = drawnAt(v);
    const now = performance.now();
    const shown = drawn.boxes.map((b) => plateFor(b.id)).filter((p): p is Plate => p !== null).map((p) => morph.plate(p, now));
    if (map.view !== 'tree') shown.sort((a, b) => (map.nodes.get(a.id) as NestedNode | GroundNode).order - (map.nodes.get(b.id) as NestedNode | GroundNode).order);
    const bars: Bar[] = [];
    if (map.view === 'tree') {
      for (const bar of drawn.bars) bars.push({ parent: bar.parent, x: bar.x, y: bar.y, w: bar.w, h: bar.h });
    }
    const byId = new Map(shown.map((p) => [p.id, p]));
    const lines: Line[] = [];
    // The tree's parent lines: level, from the parent's outline to the child's, at the child's middle. Nested has none: holding is the parent link (LA-EXP-DS07).
    if (map.view === 'tree') {
      for (const b of shown) {
        const up = map.nodes.get(b.id)?.parent;
        const p = up ? byId.get(up) : undefined;
        if (!p) continue;
        const shape = (id: string) => nodeShape(index, id).shape;
        lines.push({ id: `${p.id}|${PARENT}|${b.id}`, source: p.id, target: b.id, style: 'structure', link: false, points: parentLine(p, b, shape(p.id), shape(b.id)), scale: b.text });
      }
    }
    // The Map's links, as lines (LA-V93-R74): the focus's; with All links, every link between the records drawn.
    if (map.view === 'map') {
      const has = (id: string) => map.nodes.has(id) && !hidden.has(id);
      const parentOnMap = (id: string) => map.nodes.get(id)?.parent ?? null;
          const records = allLinks ? shown.filter((p) => !p.area).map((p) => p.id) : [];
      const drawnIds = new Set(records);
      const links = [
        ...linksOf(index, has, parentOnMap, [focus]),
        ...linksOf(index, (id) => drawnIds.has(id), parentOnMap, records, MOST_LINKS),
        // A focused journey's steps' lines to what each carries out (LA-V93-R75).
        ...linksOf(index, has, parentOnMap, map.nodes.get(focus)?.children ?? []).filter((l) => l.relation === CARRIES_OUT),
      ];
      const boxOf = (id: string) => byId.get(id) ?? morph.box(id, now);
      const seen = new Set<string>();
      for (const link of links) {
        const a = boxOf(link.source);
        const b = boxOf(link.target);
        const line = a && b ? linkLine(link, a, b, v.zoom, link.target === focus ? 'target' : link.source === focus ? 'source' : undefined) : null;
        if (line && !seen.has(line.id)) { seen.add(line.id); lines.push(line); }
      }
      // Inside a journey or a flow, a "then" arrow from each step to the next on its path (sequence.ts).
      for (const [from, to] of thenLines) {
        const a = byId.get(from);
        const b = byId.get(to);
        if (!a || !b || hidden.has(from) || hidden.has(to)) continue;
        // Side by side in a row, over the boxes (its journey's or flow's box would cover it); where the steps wrap to the next row, under them.
        const row = a.y < b.y + b.h && b.y < a.y + a.h && b.x >= a.x + a.w;
        lines.push({ ...linkLine({ source: from, target: to, relation: THEN, label: '' }, a, b, v.zoom), ...(row ? { over: true } : {}) });
      }
    }
    return { plates: shown, bars, lines };
  }, [drawnAt, plateFor, map, index, focus, allLinks, hidden, thenLines]);
  const lastFrame = useRef<{ plates: Plate[]; bars: Bar[]; lines: Line[] } | null>(null);
  // What the last frame drew is stale once anything it was drawn from changes: the pointer then hit-tests a fresh frame.
  lastFrame.current = null;

  // ---- The spotlight, the pointer and the keyboard's ring ----
  const hover = useRef<string | null>(null);
  const ring = useRef<string | null>(null);
  const spotlight = useRef<{ id: string | null; lit: Set<string> | null; litLines: Set<string> | null; from: number; to: number; start: number }>({ id: null, lit: null, litLines: null, from: 0, to: 0, start: 0 });

  const camOf = (v: Viewport, s: { w: number; h: number }): Camera => ({ cx: (s.w / 2 - v.x) / v.zoom, cy: (s.h / 2 - v.y) / v.zoom, zoom: v.zoom, w: s.w, h: s.h });
  const spotNow = () => {
    const s = spotlight.current;
    const fade = look.current.fade;
    const t = fade > 0 ? Math.min(1, (performance.now() - s.start) / fade) : 1;
    return { value: s.from + (s.to - s.from) * t, done: t >= 1 };
  };
  /** The focus fade (fade.ts) for each focus, on this map and look. */
  const strengths = useMemo(() => new Map<string, (id: string) => number>(), [map]);
  const strengthOf = (f: string) => {
    const l = look.current;
    const key = `${f}|${l.focusFade}|${l.focusTrail}`;
    let at = strengths.get(key);
    if (!at) { at = focusStrength(map, f, l); strengths.set(key, at); }
    return at;
  };
  // The live marks (changes/marks.ts), the removed records' ghosts placed where the map drawn before had them; and the
  // Highlight changes, which fades everything unchanged from its baseline in place of the focus fade.
  const changes = useChanges();
  const placeOf = useCallback((id: string) => { const n = map.nodes.get(id); return n ? { x: n.x, y: n.y, w: n.w, h: n.h } : null; }, [map]);
  const tree = useMemo(() => ({ nodes: map.nodes }), [map]);
  const marks = useStageMarks(placeOf, tree);
  const dimmed = useMemo(() => (changes.highlight ? highlightFade(changes.byId) : null), [changes.highlight, changes.byId]);
  /** How strongly each box is drawn now: the new focus's fade, eased in from the old one's over the camera's glide; with Highlight changes on, Highlight changes'. */
  const strengthNow = (): { at: (id: string) => number; done: boolean } => {
    if (dimmed) return { at: dimmed, done: true };
    const shift = fadeShift.current;
    const to = strengthOf(focus);
    const t = shift.from === null || shift.to !== focus || shift.duration <= 0 ? 1 : Math.min(1, (performance.now() - shift.start) / shift.duration);
    if (t >= 1) return { at: to, done: true };
    const from = strengthOf(shift.from!);
    const e = readMotion().ease(t);
    return { at: (id) => from(id) + (to(id) - from(id)) * e, done: false };
  };
  const ctx = useRef<CanvasRenderingContext2D | null | undefined>(undefined);

  paintRef.current = () => {
    const s = sizeRef.current;
    if (!s) return;
    const frame = frameAt(view.current);
    lastFrame.current = frame;
    if (ctx.current === undefined) ctx.current = canvas.current?.getContext('2d') ?? null;
    if (!ctx.current) return;
    const spot = spotNow();
    const sp = spotlight.current;
    const fade = strengthNow();
    const live = marks.at(performance.now());
    const state: PaintState = { focus, hover: hover.current, ring: ring.current, lit: sp.lit, litLines: sp.litLines, spot: spot.value, strength: fade.at, marks: live, open: openIn(wrapper.current, space, s.w, s.h), whole };
    paint(ctx.current, dpr, camOf(view.current, s), frame, look.current, fonts, state);
    // The leader line to the wiki card (LA-V96-R24), under this camera, from the focus's box in its outline's color.
    const v = view.current;
    const node = map.nodes.get(focus);
    const focusPlate = node ? plateFor(focus) : null;
    if (wrapper.current) drawLeaderLine(ctx.current, {
      host: wrapper.current, space, dpr, color: focusPlate ? boxColors(look.current, focusPlate).edge : look.current.ink,
      box: node ? { left: node.x * v.zoom + v.x, top: node.y * v.zoom + v.y, right: (node.x + node.w) * v.zoom + v.x, bottom: (node.y + node.h) * v.zoom + v.y } : null,
    });
    if (!spot.done || !fade.done || morph.moving(performance.now()) || marksMoving(live, frame.plates.map((p) => p.id))) requestPaint();
    else if (sp.to === 0 && sp.lit) { sp.lit = null; sp.litLines = null; }
  };
  // Every render may change what is drawn: the focus, the filters, the plates, the theme, a change landing.
  useEffect(() => { requestPaint(); });
  // The wiki card moving without the camera draws its leader line again in the same frame.
  useLeaderFollow(wrapper, space, () => paintRef.current());

  /**
   * The hover spotlight: hovering or keyboard-focusing a labeled box brightens it, its lines and the
   * boxes they join, and dims the rest a step; leaving restores the picture. It fades with the
   * motion tokens (at once under reduced motion).
   */
  const reachRef = useRef(reach);
  reachRef.current = reach;
  /**
   * The Change reach light (LA-V93-R78), the spotlight's own light held while nothing is hovered: the focus and every
   * record a change of it would touch, and the lines between them, brightened, the rest dimmed a step. Off, it fades.
   */
  const lightReach = useCallback(() => {
    const s = spotlight.current;
    const value = spotNow().value;
    const lit = reachRef.current;
    if (!lit) {
      if (s.id === REACH_SPOT) { spotlight.current = { ...s, id: null, from: value, to: 0, start: performance.now() }; requestPaint(); }
      return;
    }
    const litLines = reachLitLines(lit, (lastFrame.current ?? frameAt(view.current)).lines);
    spotlight.current = { id: REACH_SPOT, lit: new Set(lit), litLines, from: s.id === null ? value : 1, to: 1, start: performance.now() };
    requestPaint();
  }, [frameAt, requestPaint]);
  const spot = useCallback((id: string | null) => {
    const root = wrapper.current;
    if (!root) return;
    const known = id !== null && (map.nodes.has(id) || graph.nodes.some((n) => n.id === id));
    const s = spotlight.current;
    const value = spotNow().value;
    if (!known) {
      root.classList.remove('has-spotlight');
      // Leaving a box gives the light back to the Change reach, when it is on.
      if (reachRef.current) { lightReach(); return; }
      if (s.id !== null) { spotlight.current = { ...s, id: null, from: value, to: 0, start: performance.now() }; requestPaint(); }
      return;
    }
    if (s.id === id) return;
    const lit = new Set([id]);
    const litLines = new Set<string>();
    for (const line of lastFrame.current?.lines ?? frameAt(view.current).lines) {
      if (line.source !== id && line.target !== id) continue;
      lit.add(line.source);
      lit.add(line.target);
      litLines.add(line.id);
    }
    // Nested, holding is the parent link: the box lights its parent and everything inside it, as the Tree view's parent lines light theirs.
    const held = map.view !== 'tree' ? map.nodes.get(id!) : undefined;
    if (held) {
      if (held.parent) lit.add(held.parent);
      const within = (n: string) => { for (const c of map.nodes.get(n)?.children ?? []) { lit.add(c); within(c); } };
      within(held.id);
    }
    root.classList.add('has-spotlight');
    spotlight.current = { id, lit, litLines, from: s.id === null ? value : 1, to: 1, start: performance.now() };
    requestPaint();
  }, [map, graph, frameAt, requestPaint, lightReach]);
  // A new focus starts without a spotlight.
  useEffect(() => () => spot(null), [focus]);
  // The Change reach light follows its records and the map, unless a box is hovered or ringed.
  useEffect(() => {
    const s = spotlight.current;
    if (s.id === null || s.id === REACH_SPOT) lightReach();
  }, [reach, map, lightReach]);

  /** Whether a box can be focused by a click: a record or a group, not the focus. */
  const canOpen = useCallback((id: string) => id !== focus && isGraphNode(pageIndex, id), [focus, pageIndex]);
  // A click, or a tap with a finger, opens a node at once.
  const nodeClick = useNodeClick(onNavigate, canOpen, focus, onOpenNew);

  // ---- The keyboard's layer ----
  const boxIds = useMemo((): string[] => {
    if (!drawn) return [];
    // What was drawn for the map before this one (the other layout's, say) may name nodes this one lacks.
    return drawn.boxes.filter((b) => map.nodes.has(b.id)).map((b) => b.id);
  }, [drawn, map]);
  const order = useMemo(() => {
    const placed = boxIds.map((id) => plateFor(id)).filter((p): p is Plate => p !== null);
    if (map.view === 'tree') return keyboardOrder(placed);
    return keyboardOrder(placed, (id) => (map.nodes.get(id) as NestedNode | undefined)?.order ?? Infinity);
  }, [boxIds, plateFor, map]);
  const domNode = (id: string) => [...(layer.current?.querySelectorAll<HTMLElement>('.graph-box') ?? [])].find((el) => el.dataset.id === id) ?? null;

  // After a keyboard action, put focus back on the right box once it is in the layer: when the boxes drawn change, or
  // when the focus does (a child framed with its parent's children's column draws the same boxes, LA-EXP-DS09).
  useEffect(() => {
    if (!refocus.current) return;
    const id = refocus.current;
    const el = domNode(id);
    if (!el) return;
    refocus.current = null;
    el.focus({ preventScroll: true });
    active.current = id;
  }, [order, focus]);

  /** A click or Enter on a box: it becomes the focus, at its own address. */
  const activate = (id: string, fromKeyboard: boolean) => {
    if (!canOpen(id)) return;
    if (fromKeyboard) refocus.current = id;
    onNavigate(id);
  };
  // The stage walk moves through the tree from anywhere on the page but a control that uses arrows itself (the commands
  // layer's walk, steps.ts), each move moving the graph's focus: Out and In to the parent and the first child, the arrows
  // by the view's keys (in the Tree view Left to the parent, Right to the first child, Up and Down across the siblings; in
  // the Nested view Up to the parent, Down to the first child, Left and Right across). From a box with
  // keyboard focus, keyboard focus follows to the new focus's box (and is read out there); from anywhere else it stays,
  // and the step is announced.
  const followFromBox = useCallback((to: string) => {
    if (!layer.current?.contains(document.activeElement) || !document.activeElement?.closest('.graph-box')) return false;
    refocus.current = to;
    return true;
  }, []);
  useGraphWalk(pageIndex, focus, layout, onNavigate, followFromBox);
  // Enter focuses the box with keyboard focus; on the focus's own box it is left to the commands layer, where it shows or
  // collapses the wiki card (LA-V102-R02). Tab and Shift+Tab step through the boxes, as the page's own focus order.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === 'Enter' && active.current && canOpen(active.current) && target.closest?.('.graph-box')) {
      e.preventDefault();
      activate(active.current, true);
    }
  };

  // ---- The pointer: hover and click (drag, wheel and pinch are gestures.ts's) ----
  const hitAt = useCallback((x: number, y: number): Plate | null => {
    const v = view.current;
    const frame = lastFrame.current ?? frameAt(v);
    return hitPlate(frame.plates, { x: (x - v.x) / v.zoom, y: (y - v.y) / v.zoom });
  }, [frameAt]);
  const setHover = (id: string | null) => {
    if (hover.current === id) return;
    hover.current = id;
    const c = canvas.current;
    const p = id ? plateFor(id) : null;
    if (c) {
      c.style.cursor = p && canOpen(p.id) ? 'pointer' : '';
      c.title = p ? plateTip(p) : '';
    }
    spot(id);
    requestPaint();
  };
  // The minimap's view rectangle, in map units, as one key.
  const minimapView = useSyncExternalStore(store.subscribe, () => {
    const s = sizeRef.current;
    const v = view.current;
    if (!minimap || !s) return '0 0 0 0';
    return `${-v.x / v.zoom} ${-v.y / v.zoom} ${s.w / v.zoom} ${s.h / v.zoom}`;
  });

  // ---- The test hook: the drawn scene, in the page's pixels ----
  useEffect(() => {
    const host = wrapper.current;
    if (!host) return;
    host.graphHit = (clientX, clientY) => {
      const r = canvas.current!.getBoundingClientRect();
      return hitAt(clientX - r.left, clientY - r.top)?.id ?? null;
    };
    host.graphScene = () => {
      const s = sizeRef.current ?? { w: 0, h: 0 };
      const v = view.current;
      const r = canvas.current!.getBoundingClientRect();
      const frame = frameAt(v);
      const X = (x: number) => r.left + x * v.zoom + v.x;
      const Y = (y: number) => r.top + y * v.zoom + v.y;
      const rect = (x: number, y: number, w: number, h: number): Rect => ({ left: X(x), top: Y(y), width: w * v.zoom, height: h * v.zoom });
      const measureCtx = canvas.current!.getContext?.('2d') ?? null;
      const sp = spotlight.current;
      const strength = strengthNow().at;
      return {
        layout,
        camera: roundCamera(v),
        moves: moves.current.moves,
        glides: moves.current.glides,
        canvas: { left: r.left, top: r.top, width: s.w, height: s.h },
        blockBelowPx: BLOCK_BELOW_PX,
        laidOut: lastLayout(),
        spotlight: sp.id !== null,
        ghosts: ((live) => live.reduced && !live.highlight ? [] : live.ghosts.filter((g) => live.highlight || live.now - g.t < GHOST_MS).map((g) => g.id))(marks.at(performance.now())),
        bars: frame.bars.map((b) => rect(b.x, b.y, b.w, b.h)),
        lines: frame.lines.map((l) => ({ id: l.id, source: l.source, target: l.target, style: l.style, link: l.link, lit: sp.id !== null && sp.litLines ? sp.litLines.has(l.id) : null, points: l.points.map((p) => [X(p.x), Y(p.y)] as [number, number]) })),
        boxes: frame.plates.map((p) => ({ p, label: drawnLabel(p, v.zoom, whole.get(p.id)) })).map(({ p, label }) => ({
          id: p.id, kind: p.kind, stage: p.stage, shape: p.shape, view: p.view, focus: p.id === focus, child: whole.has(p.id), group: p.group,
          hover: hover.current === p.id, ring: ring.current === p.id, lit: sp.id !== null && sp.lit ? sp.lit.has(p.id) : null, strength: strength(p.id),
          change: ((m) => (m && m.change !== 'removed' ? m.change : null))(changes.live.get(p.id)),
          pill: ((c) => (c === 'added' || c === 'changed' ? c : null))(marks.highlight?.change(p.id)),
          rollup: ((r) => (r ? rollupText(r) : null))(marks.highlight?.rolls.get(p.place)),
          map: { x: p.x, y: p.y, w: p.w, h: p.h }, textScale: p.text, boxScale: p.scale,
          rect: rect(p.x, p.y, p.w, p.h),
          polygon: p.outline.kind === 'polygon' ? p.outline.points.map(([x, y]) => [X(x), Y(y)] as [number, number]) : null,
          label: ((l) => rect(l.x, l.y, l.w, l.h))(label.plate.label),
          block: label.block,
          lines: label.plate.lines.map((l) => {
            const fontPx = l.size * v.zoom;
            const font = fontFor(fonts, l.face, fontPx);
            let drawnWidth = l.width * v.zoom;
            if (measureCtx && !label.block) { measureCtx.font = font; drawnWidth = measureCtx.measureText(l.text.trimEnd()).width; }
            return { text: l.text, face: l.face, level: l.level, mapPx: l.size, fontPx, font, rect: rect(l.x, l.top, l.width, l.height), drawnWidth };
          }),
          icons: label.plate.icons.map((i) => ({ draw: i.draw, name: i.name, rect: rect(i.x, i.y, i.w, i.h) })),
          badges: p.badges.map((b) => ({ label: b.label, tone: b.tone, rect: rect(b.x, b.y, b.w, b.h) })),
          tip: plateTip(p),
          name: plateName(p, p.id === focus),
        })),
      };
    };
  });

  return (
    <div
      ref={wrapper}
      className={`graph-flow${layout === 'nested' ? ' is-nested' : layout === 'map' ? ' is-map' : ''}`}
      data-layout={layout}
      data-ready={size ? 'true' : undefined}
      tabIndex={-1}
      role="group"
      aria-label="Graph canvas: the arrow keys step through the tree"
      onKeyDown={onKeyDown}
    >
      <canvas
        ref={canvas}
        className="graph-canvas-draw"
        aria-hidden="true"
        {...gestures.handlers}
        onAuxClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const hit = hitAt(e.clientX - r.left, e.clientY - r.top);
          if (hit) nodeClick.onNodeAuxClick(e, hit.id);
        }}
        onPointerLeave={(e) => { if (!gestures.pressed(e.pointerId)) setHover(null); }}
      />
      <div
        ref={layer}
        className="graph-access"
        onFocus={(e) => {
          const el = (e.target as HTMLElement).closest?.<HTMLElement>('.graph-box');
          const id = el?.dataset.id ?? null;
          if (id) active.current = id;
          ring.current = el && el.matches(':focus-visible') ? id : null;
          spot(id);
          requestPaint();
        }}
        onBlur={() => { ring.current = null; spot(null); requestPaint(); }}
      >
        {order.map((id) => {
          const p = plateFor(id);
          if (!p) return null;
          return (
            <div
              key={id}
              className={`graph-box${id === focus ? ' is-focus' : ''}`}
              data-id={id}
              role="group"
              aria-roledescription="node"
              aria-label={plateName(p, id === focus)}
              tabIndex={0}
              onClick={(e) => nodeClick.onNodeClick(e, id)}
              onAuxClick={(e) => nodeClick.onNodeAuxClick(e, id)}
            />
          );
        })}
      </div>
      <StageCamera onZoomIn={zoomButton(ZOOM_STEP)} onZoomOut={zoomButton(1 / ZOOM_STEP)} onFit={fitMap} />
      {minimap && <MapOverview map={map} focus={focus} hidden={hidden} view={minimapView} />}
    </div>
  );
}
