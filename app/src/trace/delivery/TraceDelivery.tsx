// The Trace stage's Delivery view on the canvas (LA-V98): one row per use case (delivery.ts), ordered off the main
// thread (delivery-order.ts), placed on the page (delivery-layout.ts) and drawn by the graph's renderer (paint.ts,
// plate.ts) under the graph's camera gestures (gestures.ts).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { frameRect, MIN_ZOOM, wholeIn, type Viewport } from '../../graph/camera';
import { faintest, fadeTween, keptFade, type FadeLook } from '../../graph/fade';
import { fontFor, pageMeasure, readGraphFonts, readyMeasure, type GraphFonts } from '../../graph/fonts';
import { useCameraGestures } from '../../graph/gestures';
import { hitPlate } from '../../graph/hit';
import { PLAIN_LOOK, readLook, useThemeVersion, type Look } from '../../graph/look';
import type { MapNode } from '../../graph/map';
import type { BoxStage } from '../../graph/model';
import { readMotion } from '../../graph/motion';
import { followBox, useMorph } from '../../graph/morph';
import { boxColors, GAP_KIND, isBlock, paint, stageColors, type Bar, type Camera, type PaintState } from '../../graph/paint';
import { plateName, plateOf, plateTip, type Plate, type PlainBox } from '../../graph/plate';
import { BORDER, LABEL_PAD, labelHeight, largestFit, linesIn, setTextMeasure, titleWidth, treeLabel, type MapLabel, type TextMeasure, type WrappedLabel } from '../../graph/text';
import { SHAPES } from '../../graph/shapes';
import { TapCard, useTapToOpen } from '../../graph/touch';
import { stageFor } from '../../graph/model';
import { useCommand } from '../../shell/commands';
import { keepCamera } from '../../exploring/tab-set/commands/keep-camera';
import { keptCamera } from '../../exploring/tab-set/reads';
import { runTabSetCommand } from '../../exploring/tab-set/run';
import { useOpenSpace, type Insets, type OpenSpaceStore } from '../../views/openSpace';
import { drawLeaderLine, openIn, useLeaderFollow } from '../../views/leaderLine';
import { StageCamera, ZOOM_STEP } from '../../views/StageChrome';
import { useChanges } from '../../changes/changes';
import { highlightFade, marksMoving, useStageMarks, type MarkTree } from '../../changes/marks';
import { anchorOf, rollupText, totalChanges, type ChangeCounts } from '../../changes/rollup';
import { DELIVERY_COLUMN_LABELS, DELIVERY_COLUMNS, DELIVERY_STAGES, isOpen, type DeliveryGraph, type DeliveryStage, type Item, type Openness } from './delivery';
import { lastDeliveryOrder, useDeliveryOrder } from './delivery-order';
import { columnLeft, ITEM_HEIGHT, ITEM_WIDTH, layOutDelivery, OUTSIDE_GAP, type BoxPlace, type DeliveryLaid } from './delivery-layout';
import { litBy, type Lit } from './delivery-path';

// Every box is one height, its kind and ID line and its title at a readable size; a box with children carries a ▸ at
// its right (▾ when open), which opens it. A column is drawn only where the camera shows it: each box in view (a tenth
// of the pane to spare), and when its boxes are under 3 px tall or past the budget of 260, each run of them as one bar,
// the lit path still marked on it. A box whose title would draw under 5 px is a plain block (graph/camera.ts
// BLOCK_BELOW_PX). The serves links are drawn as curves from each outcome to the use cases it is served by, under the
// boxes; the selection's path in its row is drawn the same way, from each record on it to the next across the columns,
// and lit, the rest of the view faded. The columns' names stay at the top of the frame, a ▸ beside each stage's name
// opening it in every row (Expand all). The camera frames the focus's row; opening a box, a new order (Tidy up) or a
// data change moves no camera, and what moved glides from its old place to its new one. The canvas is hidden from
// assistive technology: the stage's list (DeliveryList.tsx) is its accessible layer.

const NO_INSETS: Insets = { left: 0, top: 0, right: 0, bottom: 0 };
const MIN_FRAME = 120;
const MAX_ZOOM = 4;
/** A box drawn under this many CSS pixels tall is a bar with its run; past this many boxes in view, every column is bars. */
const BAR_BELOW_PX = 3;
const BOX_BUDGET = 260;
/** The least zoom the framing of a row goes to, so its boxes read; and the keyboard ring's. */
const ROW_ZOOM = 0.8;
const READ_ZOOM = 0.55;
/** The most a box's text grows to fill its box, and the least it shrinks to (a longer title is cut). */
const MOST_TEXT = 1.5;
const LEAST_TEXT = 1;
/** The height of the columns' names at the top of the frame, in CSS pixels. */
const HEAD_PX = 30;
/** The frame below the columns' names: where the camera frames a box. */
const belowHead = (box: { x: number; y: number; w: number; h: number }) => ({ ...box, y: box.y + HEAD_PX, h: Math.max(MIN_FRAME, box.h - HEAD_PX) });
const HEAD_FONT = 12;
/** The toggle at a box's right, in map units: its size, and the room its box's text leaves for it. */
const TOGGLE = 18;
const TOGGLE_ROOM = TOGGLE + 10;

/** The stage of each column's own boxes that are no record: a status in its stage's color. */
const COLUMN_STAGE: readonly BoxStage[] = ['discovery', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan'];

/** One drawn box as the test hook reports it, in the page's pixels. */
export interface DeliverySceneBox {
  key: string; id: string | null; row: string | null; role: Item['role']; column: number; depth: number; opens: boolean; open: boolean;
  focus: boolean; ring: boolean; lit: boolean | null; strength: number; change: 'added' | 'changed' | null; pill: 'added' | 'changed' | null; rollup: string | null; dashed: boolean; block: boolean;
  kind: string; title: string; meta: string; name: string;
  rect: { left: number; top: number; width: number; height: number };
  /** Its toggle's middle, in the page's pixels, for a box with children. */
  toggle: { x: number; y: number } | null;
}
/** What the view draws now: its camera, boxes, bars and lines; or, `whole`, every box shown. */
export interface DeliveryScene {
  camera: Viewport;
  canvas: { left: number; top: number; width: number; height: number };
  boxes: DeliverySceneBox[];
  bars: number;
  lines: { from: string; to: string; kind: 'serves' | 'path'; lit: boolean }[];
  columns: { name: string; count: number; open: boolean; rollup: string | null }[];
  rows: string[];
  outsideTop: number | null;
  ordered: ReturnType<typeof lastDeliveryOrder>;
}
/** The canvas's element, with the hooks the tests read the drawn scene and hit-test through. */
export type DeliveryHost = HTMLDivElement & { deliveryScene?: (whole?: boolean) => DeliveryScene; deliveryHit?: (clientX: number, clientY: number) => string | null };

export interface TraceDeliveryProps {
  index: RecordIndex;
  focus: string;
  graph: DeliveryGraph;
  open: Openness;
  /** The box the walk or a click stands on (a record may show in several boxes), for its focus; null for the focus's first. */
  at: string | null;
  /** Whether every row has a stage open (Expand all), by stage. */
  every: Readonly<Record<DeliveryStage, boolean>>;
  /** A count the Tidy up button raises: the rows are ordered afresh once for each. */
  tidy: number;
  /** Opens or closes a box's children. */
  onToggle: (opens: string) => void;
  /** Opens or closes a stage in every row (a column's name). */
  onEvery: (stage: DeliveryStage) => void;
  /** A box was clicked: the box the walk stands on from now (a record's is navigated to). */
  onBox: (key: string) => void;
  onNavigate: (id: string) => void;
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  space?: OpenSpaceStore;
  /** The box the keyboard is on, ringed and brought into view; null for none. */
  ring: string | null;
  cameraKey?: string;
  onOpenNew?: (id: string, background: boolean) => void;
}

/** The view, once the label's faces have loaded and the text measure is ready, and the rows are ordered. */
export function TraceDelivery(props: TraceDeliveryProps) {
  const theme = useThemeVersion();
  const fonts = useMemo<GraphFonts>(() => readGraphFonts(), [theme]);
  const [measure, setMeasure] = useState<TextMeasure | null>(() => { void pageMeasure(fonts); return readyMeasure(fonts); });
  useEffect(() => {
    let live = true;
    void pageMeasure(fonts).then((m) => { if (live) setMeasure(m); });
    return () => { live = false; };
  }, [fonts.body, fonts.mono]);
  const ordered = useDeliveryOrder(props.graph, props.tidy);
  const laid = useMemo(() => (ordered ? layOutDelivery(ordered.graph, ordered.order, props.open) : null), [ordered, props.open]);
  if (!measure || !ordered || !laid) return <div className="graph-flow trace-flow" data-view="delivery" aria-busy="true" />;
  setTextMeasure(measure);
  return <DeliveryScene {...props} graph={ordered.graph} laid={laid} fonts={fonts} theme={theme} />;
}

/** A label's lines cut to a box `height` tall (at text scale 1): its title's last lines dropped, the last kept ending with an ellipsis. */
function cutToFit(lines: WrappedLabel, label: MapLabel, width: number, height: number): WrappedLabel {
  if (labelHeight(lines) <= height || lines.title.length <= 1) return lines;
  const room = label.shape ? SHAPES[label.shape].room : { l: 0, r: 0 };
  const inner = width - 2 * LABEL_PAD - room.l - room.r;
  const title = [...lines.title];
  while (title.length > 1 && labelHeight({ ...lines, title }) > height) title.pop();
  let last = title[title.length - 1].trimEnd();
  while (last.length > 1 && titleWidth(`${last}…`) > inner) last = last.slice(0, -1).trimEnd();
  title[title.length - 1] = `${last}…`;
  return { ...lines, title };
}

/** A plate made at the origin moved to its place. */
function shifted(p: Plate, dx: number, dy: number): Plate {
  return {
    ...p,
    x: p.x + dx,
    y: p.y + dy,
    outline: p.outline.kind === 'polygon' ? { kind: 'polygon', points: p.outline.points.map(([x, y]) => [x + dx, y + dy]) } : p.outline,
    label: { ...p.label, x: p.label.x + dx, y: p.label.y + dy },
    lines: p.lines.map((l) => ({ ...l, x: l.x + dx, baseline: l.baseline + dy, top: l.top + dy })),
    icons: p.icons.map((i) => ({ ...i, x: i.x + dx, y: i.y + dy })),
    badges: p.badges.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy })),
  };
}

/** The first index in a column whose box reaches down to `top` (its tops ascend). */
function firstFrom(order: readonly string[], places: ReadonlyMap<string, BoxPlace>, top: number): number {
  let lo = 0;
  let hi = order.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (places.get(order[mid])!.y + ITEM_HEIGHT < top) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** Where a box's toggle is, in map units: at the right of its label's room, clear of its shape's point. */
const toggleAt = (p: Plate) => ({ x: p.label.x + p.label.w - TOGGLE, y: p.y + (p.h - TOGGLE) / 2, w: TOGGLE, h: TOGGLE });

/** The record a box shows, or the box's own key for a box that is no record (a status, a gap, a heading). */
const recordAt = (graph: DeliveryGraph, key: string) => { const item = graph.items.get(key); return item?.role === 'record' && item.id ? item.id : key; };

/** What a non-record box looks like. */
function plainOf(item: Item): PlainBox {
  const words = item.words!;
  const gap = item.role === 'gap';
  return { kind: gap ? GAP_KIND : `delivery-${item.role}`, kindLabel: words.kind, title: words.title, meta: words.meta, dashed: gap || item.role === 'hint', stage: item.role === 'hint' ? 'structural' : COLUMN_STAGE[item.column] };
}

/** What one frame draws. */
interface DeliveryFrame { plates: Plate[]; bars: Bar[]; barred: boolean; serves: number[]; marks: { key: string; x: number; y: number }[] }

function DeliveryScene({ index, focus, graph, laid, open, at, every, onToggle, onEvery, onBox, onNavigate, onPeek, space, ring: ringAt, cameraKey, onOpenNew, fonts, theme }: Omit<TraceDeliveryProps, 'tidy'> & { laid: DeliveryLaid; fonts: GraphFonts; theme: number }) {
  const wrapper = useRef<DeliveryHost>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  /** The focus's box: the one the walk or a click stands on, else its first shown (or the box standing in for it). */
  const lit = useMemo<Lit>(() => litBy(graph, laid, focus, at), [graph, laid, focus, at]);
  const focusKey = lit.box;

  // ---- The camera ----
  const view = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const frameRequest = useRef<number | null>(null);
  const paintRef = useRef<() => void>(() => {});
  const requestPaint = useCallback(() => {
    if (frameRequest.current !== null) return;
    frameRequest.current = requestAnimationFrame(() => { frameRequest.current = null; paintRef.current(); });
  }, []);
  useEffect(() => () => { if (frameRequest.current !== null) cancelAnimationFrame(frameRequest.current); frameRequest.current = null; }, []);
  const setViewport = useCallback((v: Viewport) => { view.current = v; requestPaint(); }, [requestPaint]);
  const getViewport = useCallback(() => view.current, []);
  const gestures = useCameraGestures({
    canvas,
    size,
    getViewport,
    setViewport,
    zoom: { min: MIN_ZOOM, max: MAX_ZOOM },
    onHover: (x, y) => setHover(hitAt(x, y)),
    onTap: (x, y, e) => tapAt(x, y, e),
  });
  const { moveTo } = gestures;

  const openSpace = useOpenSpace(space);
  const inset: Insets = openSpace?.frame ?? NO_INSETS;
  const insetKey = `${inset.left} ${inset.top} ${inset.right} ${inset.bottom}`;
  const frameBox = useCallback((s: { w: number; h: number }) => {
    const w = s.w - inset.left - inset.right;
    const h = s.h - inset.top - inset.bottom;
    return w < MIN_FRAME || h < MIN_FRAME ? { x: 0, y: 0, w: s.w, h: s.h } : { x: inset.left, y: inset.top, w, h };
  }, [insetKey]);

  /**
   * The camera for the focus: its row's height (each row it shows in, for a record several use cases share) at a zoom
   * its boxes read at, every column across when they fit, else from the column before the focus's on; the focus's box
   * always in the frame. With no box, the top of the view.
   */
  const framing = useCallback((): Viewport | null => {
    if (!size || (space && !openSpace)) return null;
    const box = frameBox(size);
    const head = belowHead(box);
    const own = focusKey ? laid.places.get(focusKey) : undefined;
    const across = head.w - 48;
    const fits = Math.min(1, across / laid.width);
    if (!own) {
      const zoom = Math.max(ROW_ZOOM, fits);
      return { x: head.x + Math.max(24, (head.w - laid.width * zoom) / 2), y: head.y + 16, zoom };
    }
    let top = own.y;
    let bottom = own.y + own.h;
    for (const r of lit.rows) { const band = laid.rows.get(r); if (band) { top = Math.min(top, band.y); bottom = Math.max(bottom, band.y + band.h); } }
    const tall = (head.h - 48) / Math.max(1, bottom - top);
    // As large as reads, up to every column from the Use case column on fitting across.
    const fromUseCase = laid.width - columnLeft(1);
    const zoom = Math.max(ROW_ZOOM, Math.min(1, Math.max(fits, across / fromUseCase), tall));
    // Down: the row's top near the frame's top, the focus's box kept in the frame.
    let y = head.y + 24 - top * zoom;
    const atY = own.y * zoom + y;
    if (atY + own.h * zoom > head.y + head.h - 24) y -= atY + own.h * zoom - (head.y + head.h - 24);
    // Across: every column when they fit, else from the column before the focus's (the Use case column's for a row's
    // own boxes: the outcomes sit where their rows are, rarely beside this one).
    const column = graph.items.get(focusKey!)?.column ?? 0;
    const x = laid.width * zoom <= across ? head.x + (head.w - laid.width * zoom) / 2 : head.x + 24 - columnLeft(column === 0 ? 0 : Math.max(1, column - 1)) * zoom;
    // The focused box always whole in the frame (LA-PAT-APP-UX-R23).
    return wholeIn({ x, y, zoom }, own, head);
  }, [size, laid, lit, focusKey, frameBox, space, openSpace, graph]);

  // Each place keeps its camera (the Tab set's cameras, exploring/tab-set): taken back at once when it still frames the
  // same focus in the same order.
  const framedNow = `${focus} ${laid.order.key}`;
  const cameraPlace = useRef<{ key: string | undefined; framed: string }>({ key: cameraKey, framed: framedNow });
  const keptView = useRef<Viewport | null>(cameraKey ? keptCamera<Viewport>(cameraKey, 'trace-delivery', framedNow) : null);
  useLayoutEffect(() => {
    const was = cameraPlace.current;
    if (was.key === cameraKey) { cameraPlace.current = { key: cameraKey, framed: framedNow }; return; }
    if (was.key && sizeRef.current) runTabSetCommand(keepCamera, { place: was.key, stage: 'trace-delivery', camera: { framed: was.framed, view: view.current } });
    cameraPlace.current = { key: cameraKey, framed: framedNow };
    keptView.current = cameraKey ? keptCamera<Viewport>(cameraKey, 'trace-delivery', framedNow) : null;
  });
  useEffect(() => () => {
    const { key, framed: what } = cameraPlace.current;
    if (key && sizeRef.current) runTabSetCommand(keepCamera, { place: key, stage: 'trace-delivery', camera: { framed: what, view: view.current } });
  }, []);

  // Frame the focus whenever it, the stage's size or the open space changes: a glide, except the first picture and a
  // resize. Opening a box, a new order or a data change with the same focus leaves the camera (layout stability).
  const framed = useRef<{ w: number; h: number; inset: string; focus: string } | null>(null);
  const glideMs = useRef<number | null>(null);
  useLayoutEffect(() => {
    const kept = keptView.current;
    const target = kept ?? framing();
    if (!target || !size) return;
    keptView.current = null;
    const was = framed.current;
    framed.current = { w: size.w, h: size.h, inset: insetKey, focus };
    const resized = was !== null && (was.w !== size.w || was.h !== size.h || was.inset !== insetKey);
    if (was && !resized && was.focus === focus) return;
    const ms = moveTo(target, !kept && was !== null && !resized);
    if (was && was.focus !== focus) glideMs.current = ms;
  }, [framing]);
  const frameFocus = useCallback(() => { const t = framing(); if (t) moveTo(t, true); }, [framing, moveTo]);
  useCommand('graphFit', frameFocus, !!size);

  // The pane's size, observed once for the canvas's life; the backing store at the screen's pixel ratio.
  useLayoutEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const measureBox = (b: { width: number; height: number }) => {
      if (b.width <= 0 || b.height <= 0) return;
      setSize((s) => (s && Math.round(s.w) === Math.round(b.width) && Math.round(s.h) === Math.round(b.height) ? s : { w: b.width, h: b.height }));
    };
    measureBox(el.getBoundingClientRect());
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => measureBox(entries[0]?.contentRect ?? el.getBoundingClientRect()));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c || !size) return;
    c.width = Math.max(1, Math.round(size.w * dpr));
    c.height = Math.max(1, Math.round(size.h * dpr));
    paintRef.current();
  }, [size, dpr]);

  // ---- What moved glides from its old place (layout stability, LA-PAT-APP-UX-R22, graph/morph.ts) ----
  const morphMap = useMemo(() => ({ view: 'delivery', roots: [graph.product], nodes: laid.places }), [laid, graph.product]);
  const morph = useMorph(morphMap);
  const placeAt = (key: string, now: number): BoxPlace | undefined => morph.box(key, now) ?? undefined;
  // A new layout leaves the camera where it is, unless the focus's own box moved: then it glides with it.
  const laidBefore = useRef({ laid, focusKey });
  useLayoutEffect(() => {
    const was = laidBefore.current;
    laidBefore.current = { laid, focusKey };
    if (was.laid === laid || !focusKey || was.focusKey !== focusKey) return;
    const a = was.laid.places.get(focusKey);
    const b = laid.places.get(focusKey);
    const v = a && b ? followBox(view.current, a, b, { min: MIN_ZOOM, max: MAX_ZOOM }) : null;
    // Following the focus keeps it whole too (LA-PAT-APP-UX-R23).
    const s = sizeRef.current;
    if (v && b) moveTo(s ? wholeIn(v, b, belowHead(frameBox(s))) : v, true);
  }, [laid]);

  // ---- The look, the fade and the plates ----
  const look = useRef<Look>(PLAIN_LOOK);
  useLayoutEffect(() => { if (wrapper.current) look.current = readLook(wrapper.current); requestPaint(); }, [theme]);
  const fadeLook = useMemo<Pick<FadeLook, 'focusFade'>>(() => ({ get focusFade() { return look.current.focusFade; } }), []);
  const changes = useChanges();
  const counts = useMemo(() => [graph.outcomes.length, graph.rows.length, ...DELIVERY_STAGES.slice(1).map((s) => graph.rows.filter((r) => graph.items.get(r.cells[DELIVERY_STAGES.indexOf(s) + 1])!.role === 'gap').length)], [graph]);
  const fade = useMemo(() => {
    const own = lit.keys ? keptFade((key) => lit.keys!.has(key), fadeLook) : () => 1;
    return changes.highlight ? faintest(own, highlightFade(changes.byId, (key) => recordAt(graph, key))) : own;
  }, [lit, graph, fadeLook, changes.highlight, changes.byId]);
  const tween = useMemo(() => fadeTween((t) => readMotion().ease(t)), []);
  useLayoutEffect(() => {
    tween.send(fade, glideMs.current ?? look.current.fade);
    glideMs.current = null;
    requestPaint();
  }, [fade]);

  /** Each box's plate at the origin, made when first drawn, once per graph and size. */
  const plates = useMemo(() => new Map<string, Plate>(), [graph, index, fonts, laid]);
  const plateFor = useCallback((key: string): Plate | null => {
    const known = plates.get(key);
    if (known) return known;
    const item = graph.items.get(key);
    const at = laid.places.get(key);
    if (!item || !at) return null;
    const plain = item.role === 'record' && item.id ? undefined : plainOf(item);
    const id = plain ? key : item.id!;
    const label: MapLabel = plain ? { title: plain.title, meta: plain.meta, shape: 'box' } : treeLabel(index, id);
    const border = (s: number) => BORDER * s;
    // Its text as large as its label fits, beside its toggle when it opens, and never under LEAST_TEXT (a longer title is cut, whole in its tooltip).
    const room = at.w - (item.opens ? TOGGLE_ROOM : 0);
    const text = Math.max(LEAST_TEXT, largestFit(label, false, room, ITEM_HEIGHT, MOST_TEXT, border) || LEAST_TEXT);
    const width = (room - 2 * border(text)) / text;
    const home: MapNode = { id: key, parent: null, children: [], level: item.column, x: 0, y: 0, w: at.w, h: ITEM_HEIGHT, text, centered: false, lines: cutToFit(linesIn(label, width, false), label, width, ITEM_HEIGHT / text) };
    const plate = plateOf(index, id, { view: 'tree', node: home, place: key, plain });
    plates.set(key, plate);
    return plate;
  }, [plates, graph, index, laid]);

  // ---- The spotlight (a hover's path), the pointer, the keyboard's ring and a tap's selection ----
  const hover = useRef<string | null>(null);
  const ring = useRef<string | null>(null);
  const spotlight = useRef<{ key: string | null; lit: Lit | null; from: number; to: number; start: number }>({ key: null, lit: null, from: 0, to: 0, start: 0 });
  const spotNow = () => {
    const s = spotlight.current;
    const ms = look.current.fade;
    const t = ms > 0 ? Math.min(1, (performance.now() - s.start) / ms) : 1;
    return { value: s.from + (s.to - s.from) * t, done: t >= 1 };
  };
  const ctx = useRef<CanvasRenderingContext2D | null | undefined>(undefined);
  const tap = useRef<ReturnType<typeof useTapToOpen> | null>(null);
  const lastFrame = useRef<DeliveryFrame | null>(null);
  lastFrame.current = null;

  /** What a camera shows: the boxes in view as plates (or bars past the budget), the serves links to draw, and the path's marks on bars; `whole`, every box. */
  const frameAt = useCallback((v: Viewport, s: { w: number; h: number }, now: number, whole = false): DeliveryFrame => {
    const spare = { x: s.w / 10, y: s.h / 10 };
    const top = (-v.y - spare.y) / v.zoom;
    const bottom = (s.h - v.y + spare.y) / v.zoom;
    const left = (-v.x - spare.x) / v.zoom;
    const right = (s.w - v.x + spare.x) / v.zoom;
    const shown: { key: string; column: number }[] = [];
    laid.columns.forEach((order, column) => {
      const x = columnLeft(column);
      if (!whole && (x + ITEM_WIDTH < left || x > right)) return;
      for (let i = whole ? 0 : firstFrom(order, laid.places, top); i < order.length; i++) {
        const key = order[i];
        if (!whole && laid.places.get(key)!.y > bottom) break;
        shown.push({ key, column });
      }
    });
    const barred = !whole && (ITEM_HEIGHT * v.zoom < BAR_BELOW_PX || shown.length > BOX_BUDGET);
    const out: DeliveryFrame = { plates: [], bars: [], barred, serves: [], marks: [] };
    if (!barred) {
      for (const { key } of shown) {
        const home = plateFor(key);
        const p = placeAt(key, now);
        if (home && p) out.plates.push(shifted(home, p.x, p.y));
      }
    } else {
      let run: Bar | null = null;
      let runColumn = -1;
      for (const { key, column } of shown) {
        const p = laid.places.get(key)!;
        if (run && runColumn === column && (p.y - (run.y + run.h)) * v.zoom < 1.5) { run.h = p.y + p.h - run.y; run.w = Math.max(run.w, p.x + p.w - run.x); continue; }
        if (run) out.bars.push(run);
        run = { parent: `column:${column}`, x: columnLeft(column), y: p.y, w: ITEM_WIDTH, h: p.h };
        runColumn = column;
      }
      if (run) out.bars.push(run);
      const sp = spotlight.current;
      const keys = sp.key !== null && sp.lit ? sp.lit.keys : lit.keys;
      if (keys) for (const { key } of shown) if (keys.has(key)) { const p = laid.places.get(key)!; out.marks.push({ key, x: p.x, y: p.y }); }
    }
    // The serves links in view: each outcome's to the rows it is served by.
    graph.serves.forEach(([o, u], i) => {
      const a = laid.places.get(`outcome/${o}`);
      const b = laid.places.get(`${u}|use-case`);
      if (!a || !b) return;
      if (!whole && (Math.max(a.y, b.y) + ITEM_HEIGHT < top || Math.min(a.y, b.y) > bottom)) return;
      out.serves.push(i);
    });
    return out;
  }, [laid, graph, plateFor, lit]);

  paintRef.current = () => {
    const s = sizeRef.current;
    if (!s) return;
    const now = performance.now();
    const frame = frameAt(view.current, s, now);
    lastFrame.current = frame;
    if (ctx.current === undefined) ctx.current = canvas.current?.getContext('2d') ?? null;
    const g = ctx.current;
    if (!g) return;
    const spot = spotNow();
    const sp = spotlight.current;
    const faded = tween.now();
    const live = marks.at(now);
    const strength = (place: string) => (place.startsWith('column:') ? 1 : faded.at(place));
    const state: PaintState = { focus: focusKey ?? focus, hover: hover.current, ring: ring.current, armed: tap.current?.armed ?? null, lit: sp.lit?.keys ?? null, litLines: null, spot: spot.value, strength, marks: live, open: openIn(wrapper.current, space, s.w, s.h) };
    const v = view.current;
    const cam: Camera = { cx: (s.w / 2 - v.x) / v.zoom, cy: (s.h / 2 - v.y) / v.zoom, zoom: v.zoom, w: s.w, h: s.h };
    const lk = look.current;
    const spotLit = sp.key !== null ? sp.lit : null;
    const wires = (c: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number) => {
      paintRows(c, laid, graph, lk, fonts, X, Y, v.zoom);
      const curve = (a: BoxPlace, b: BoxPlace) => {
        const [x0, y0, x1, y1] = [X(a.x + a.w), Y(a.y + a.h / 2), X(b.x), Y(b.y + b.h / 2)];
        const bend = (x1 - x0) / 2;
        c.moveTo(x0, y0);
        c.bezierCurveTo(x0 + bend, y0, x1 - bend, y1, x1, y1);
      };
      // The serves links: lit on the path, faint off it.
      const onPath = (o: string, u: string) => (spotLit ?? lit).serves.has(`${o}>${u}`);
      const anyLit = !!(spotLit ?? lit).keys;
      for (const strong of [false, true]) {
        c.globalAlpha = strong ? 0.9 : anyLit ? 0.18 : 0.4;
        c.strokeStyle = lk.discoveryEdge;
        c.lineWidth = Math.max(0.75, Math.min(2.5, (strong ? 2 : 1.25) * v.zoom));
        c.beginPath();
        for (const i of frame.serves) {
          const [o, u] = graph.serves[i];
          if (onPath(o, u) !== strong) continue;
          const a = placeAt(`outcome/${o}`, now);
          const b = placeAt(`${u}|use-case`, now);
          if (a && b) curve(a, b);
        }
        c.stroke();
      }
      // The selection's path across its row, and the hover's: from each box on it to the next, column to column.
      for (const path of [lit, ...(spotLit ? [spotLit] : [])]) {
        c.globalAlpha = path === lit ? 0.9 : 0.9 * spot.value;
        c.strokeStyle = lk.ink;
        c.lineWidth = Math.max(0.75, Math.min(2.5, 1.75 * v.zoom));
        c.beginPath();
        for (const [from, to] of path.lines) {
          const a = placeAt(from, now);
          const b = placeAt(to, now);
          if (a && b) curve(a, b);
        }
        c.stroke();
      }
      if (frame.marks.length > 0) {
        c.globalAlpha = 1;
        for (const m of frame.marks) {
          const item = graph.items.get(m.key)!;
          const stage = item.id && item.role === 'record' ? stageFor(index, item.id, index.byId.get(item.id)?.kind ?? '') : COLUMN_STAGE[item.column];
          c.fillStyle = item.role === 'gap' ? lk.warn : stageColors(lk, stage).edge;
          c.fillRect(X(m.x), Y(m.y), ITEM_WIDTH * v.zoom, Math.max(1.5, ITEM_HEIGHT * v.zoom));
        }
      }
      c.globalAlpha = 1;
    };
    paint(g, dpr, cam, { plates: frame.plates, bars: frame.bars, lines: [], wires }, lk, fonts, state);
    paintToggles(g, frame.plates, graph, open, lk, fonts, v, dpr, strength);
    paintHeads(g, counts, rolls, every, lk, fonts, v, frameBox(s), dpr);
    // The leader line to the wiki card (LA-V96-R24), from the focus's box, in its outline's color.
    const own = focusKey ? placeAt(focusKey, now) : undefined;
    const p = own ? plateFor(focusKey!) : null;
    if (wrapper.current) drawLeaderLine(g, {
      host: wrapper.current, space, dpr, color: p ? boxColors(lk, p).edge : lk.ink,
      box: own ? { left: own.x * v.zoom + v.x, top: own.y * v.zoom + v.y, right: (own.x + own.w) * v.zoom + v.x, bottom: (own.y + own.h) * v.zoom + v.y } : null,
    });
    if (morph.moving(now) || !spot.done || !faded.done || marksMoving(live, frame.plates.map((x) => x.id))) requestPaint();
    else if (sp.to === 0 && sp.lit) sp.lit = null;
  };
  useEffect(() => { requestPaint(); });
  useLeaderFollow(wrapper, space, () => paintRef.current());

  // The live marks: each record's on its box; a removed record's ghost where the layout before had it. With Highlight
  // changes on, each box's roll-up counts what changed in its children, and a row's use case what changed in its row.
  const placeOf = useCallback((id: string) => { const keys = graph.boxesOf.get(id); const k = keys?.find((x) => laid.places.has(x)); return k ? laid.places.get(k)! : null; }, [laid, graph]);
  const tree = useMemo<MarkTree>(() => markTree(graph), [graph]);
  const marks = useStageMarks(placeOf, tree);
  // With Highlight changes on, each column's header says how many records in it are new, changed and removed; a removed record counts in the column of the record its ID names.
  const rolls = useMemo<(ChangeCounts | undefined)[]>(() => {
    const hl = marks.highlight;
    if (!hl) return [];
    const out: ChangeCounts[] = DELIVERY_COLUMNS.map(() => ({ added: 0, changed: 0, removed: 0 }));
    const counted = new Set<string>();
    for (const [id, keys] of graph.boxesOf) {
      const c = hl.change(id);
      if (!c || c === 'removed') continue;
      for (const k of keys) { const column = graph.items.get(k)!.column; if (!counted.has(`${column} ${id}`)) { counted.add(`${column} ${id}`); out[column]![c]++; } }
    }
    for (const id of new Set([...changes.byId.keys(), ...changes.live.all().map((m) => m.id)])) {
      if (hl.change(id) !== 'removed') continue;
      const up = anchorOf(id, (x) => graph.boxesOf.has(x));
      const key = up === null ? undefined : graph.boxesOf.get(up)?.[0];
      if (key !== undefined) out[graph.items.get(key)!.column]!.removed++;
    }
    return out.map((c) => (totalChanges(c) > 0 ? c : undefined));
  }, [marks.highlight, graph, changes.byId, changes.live]);

  /** Lights a box's path while the pointer is on it; null lets go. */
  const spot = useCallback((key: string | null) => {
    const item = key ? graph.items.get(key) : undefined;
    onPeek?.('hover', item?.id && index.byId.has(item.id) ? item.id : null);
    const s = spotlight.current;
    const value = spotNow().value;
    if (!key || !item?.id || item.role === 'hint') {
      if (s.key !== null) { spotlight.current = { ...s, key: null, from: value, to: 0, start: performance.now() }; requestPaint(); }
      return;
    }
    if (s.key === key) return;
    spotlight.current = { key, lit: litBy(graph, laid, item.id, key), from: s.key === null ? value : 1, to: 1, start: performance.now() };
    requestPaint();
  }, [graph, laid, index, onPeek, requestPaint]);
  useEffect(() => () => spot(null), [focus, graph]);

  const canOpen = useCallback((id: string) => id !== focus && index.byId.has(id), [focus, index]);
  const tapToOpen = useTapToOpen(onNavigate, canOpen, wrapper, focus, onOpenNew);
  tap.current = tapToOpen;
  useEffect(() => { onPeek?.('selected', tapToOpen.armed); requestPaint(); }, [tapToOpen.armed, onPeek]);

  // The keyboard's ring: the box the walk stands on, brought into view when it is not.
  useEffect(() => {
    ring.current = ringAt && laid.places.has(ringAt) ? ringAt : null;
    requestPaint();
    const s = sizeRef.current;
    const p = ring.current ? laid.places.get(ring.current) : undefined;
    if (!p || !s) return;
    const v = view.current;
    const box = frameBox(s);
    const leftAt = p.x * v.zoom + v.x;
    const topAt = p.y * v.zoom + v.y;
    if (leftAt >= box.x && leftAt + p.w * v.zoom <= box.x + box.w && topAt >= box.y + HEAD_PX && topAt + p.h * v.zoom <= box.y + box.h) return;
    const zoom = Math.max(READ_ZOOM, Math.min(1, v.zoom));
    moveTo({ x: box.x + box.w / 2 - (p.x + p.w / 2) * zoom, y: box.y + (box.h + HEAD_PX) / 2 - (p.y + p.h / 2) * zoom, zoom }, true);
  }, [ringAt, laid]);

  // ---- The pointer: hover, click and the toggles (drag, wheel and pinch are graph/gestures.ts's) ----
  const hitAt = useCallback((x: number, y: number): Plate | null => {
    const v = view.current;
    const s = sizeRef.current;
    if (!s) return null;
    const frame = lastFrame.current ?? frameAt(v, s, performance.now());
    return hitPlate(frame.plates, { x: (x - v.x) / v.zoom, y: (y - v.y) / v.zoom });
  }, [frameAt]);
  /** A tap or click: a column's name opens its stage in every row; a box's toggle opens it; a record opens; another box is stood on (a status opens). */
  const tapAt = (x: number, y: number, e: Parameters<typeof tapToOpen.onNodeClick>[0]) => {
    const s = sizeRef.current;
    const box = s ? frameBox(s) : null;
    const v = view.current;
    if (box && y >= box.y && y <= box.y + HEAD_PX) {
      const column = DELIVERY_COLUMNS.findIndex((_, i) => { const l = columnLeft(i) * v.zoom + v.x; return x >= l && x <= l + ITEM_WIDTH * v.zoom; });
      if (column >= 1) onEvery(DELIVERY_STAGES[column - 1]);
      return;
    }
    const hit = hitAt(x, y);
    if (!hit) { tapToOpen.clear(); return; }
    const item = graph.items.get(hit.place)!;
    const at = { x: (x - v.x) / v.zoom, y: (y - v.y) / v.zoom };
    const t = toggleAt(hit);
    const onToggleZone = !!item.opens && at.x >= t.x - 4 && at.x <= t.x + t.w + 4 && at.y >= t.y - 4 && at.y <= t.y + t.h + 4;
    if (onToggleZone || (item.opens && item.role !== 'record' && !(item.role === 'heading' && item.id))) { onToggle(item.opens!); return; }
    onBox(hit.place);
    if (item.role === 'record' && item.id) tapToOpen.onNodeClick(e, item.id);
    else if (item.role === 'heading' && item.id) tapToOpen.onNodeClick(e, item.id);
    else tapToOpen.clear();
  };
  const setHover = (hit: Plate | null) => {
    const key = hit?.place ?? null;
    if (hover.current === key) return;
    hover.current = key;
    const c = canvas.current;
    if (c) {
      const item = key ? graph.items.get(key) : undefined;
      c.style.cursor = item && (item.opens || (item.id && canOpen(item.id))) ? 'pointer' : '';
      c.title = hit ? (item?.role === 'record' ? plateTip(hit) : `${hit.title} (${hit.meta})`) : '';
    }
    spot(key);
    requestPaint();
  };
  const zoomButton = (factor: number) => () => {
    if (!size) return;
    const box = frameBox(size);
    gestures.zoomBy(box.x + box.w / 2, box.y + box.h / 2, factor);
  };
  /** The camera's Fit: every column, its whole height, in the frame. */
  const fitAll = () => {
    if (!size) return;
    const box = frameBox(size);
    moveTo(frameRect({ x: 0, y: 0, w: laid.width, h: laid.height }, belowHead(box), { pad: 24, read: MIN_ZOOM, max: 1, min: MIN_ZOOM }), true);
  };

  // ---- The test hook: the drawn scene, in the page's pixels ----
  useEffect(() => {
    const host = wrapper.current;
    if (!host) return;
    host.deliveryHit = (clientX, clientY) => {
      const r = canvas.current!.getBoundingClientRect();
      return hitAt(clientX - r.left, clientY - r.top)?.place ?? null;
    };
    host.deliveryScene = (whole = false) => {
      const s = sizeRef.current ?? { w: 0, h: 0 };
      const v = view.current;
      const r = canvas.current!.getBoundingClientRect();
      const frame = frameAt(v, s, performance.now(), whole);
      const sp = spotlight.current;
      const strength = tween.now().at;
      const path = sp.key !== null && sp.lit ? sp.lit : lit;
      return {
        camera: { ...v },
        canvas: { left: r.left, top: r.top, width: s.w, height: s.h },
        bars: frame.bars.length,
        outsideTop: laid.outsideTop,
        ordered: lastDeliveryOrder(),
        rows: [...laid.rows.keys()],
        columns: DELIVERY_COLUMNS.map((c, i) => ({ name: DELIVERY_COLUMN_LABELS[c], count: counts[i] ?? 0, open: i > 0 && every[DELIVERY_STAGES[i - 1]], rollup: rolls[i] ? rollupText(rolls[i]!) : null })),
        lines: [
          ...frame.serves.map((i) => ({ from: `outcome/${graph.serves[i][0]}`, to: `${graph.serves[i][1]}|use-case`, kind: 'serves' as const, lit: path.serves.has(`${graph.serves[i][0]}>${graph.serves[i][1]}`) })),
          ...path.lines.map(([from, to]) => ({ from, to, kind: 'path' as const, lit: true })),
        ],
        boxes: frame.plates.map((p) => {
          const item = graph.items.get(p.place)!;
          return {
            key: p.place, id: item.id, row: item.row, role: item.role, column: item.column, depth: item.depth, opens: !!item.opens, open: isOpen(item, open),
            focus: p.place === focusKey, ring: ring.current === p.place, lit: path.keys ? path.keys.has(p.place) : null, strength: strength(p.place),
            change: ((m) => (m && m.change !== 'removed' ? m.change : null))(item.id ? changes.live.get(item.id) : undefined),
            pill: ((c) => (c === 'added' || c === 'changed' ? c : null))(item.id ? marks.highlight?.change(item.id) : undefined),
            rollup: ((r) => (r ? rollupText(r) : null))(marks.highlight?.rolls.get(p.place)),
            dashed: p.dashed, block: isBlock(p, v.zoom), kind: p.kind, title: p.title, meta: p.lines.filter((l) => l.face === 'meta').map((l) => l.text).join(''), name: plateName(p, p.place === focusKey),
            rect: { left: r.left + p.x * v.zoom + v.x, top: r.top + p.y * v.zoom + v.y, width: p.w * v.zoom, height: p.h * v.zoom },
            toggle: item.opens ? ((t) => ({ x: r.left + (t.x + t.w / 2) * v.zoom + v.x, y: r.top + (t.y + t.h / 2) * v.zoom + v.y }))(toggleAt(p)) : null,
          };
        }),
      };
    };
  });

  const armedPlate = tapToOpen.armed ? plateFor(graph.boxesOf.get(tapToOpen.armed)?.find((k) => laid.places.has(k)) ?? '') : null;
  return (
    <div ref={wrapper} className="graph-flow trace-flow" data-view="delivery" data-ready={size ? 'true' : undefined}>
      <canvas
        ref={canvas}
        className="graph-canvas-draw"
        aria-hidden="true"
        {...gestures.handlers}
        onAuxClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const hit = hitAt(e.clientX - r.left, e.clientY - r.top);
          const id = hit ? graph.items.get(hit.place)?.id : null;
          if (hit && id && hit.kind !== GAP_KIND) tapToOpen.onNodeAuxClick(e, id);
        }}
        onPointerLeave={(e) => { if (!gestures.pressed(e.pointerId)) setHover(null); }}
      />
      <StageCamera onZoomIn={zoomButton(ZOOM_STEP)} onZoomOut={zoomButton(1 / ZOOM_STEP)} onFit={fitAll} />
      {armedPlate && <TapCard kind={armedPlate.kindLabel} name={armedPlate.title} onOpen={tapToOpen.openArmed} onDismiss={tapToOpen.clear} />}
    </div>
  );
}

/**
 * The view's boxes as the change marks roll them up (changes/marks.ts): each box under its parent, and each stage's cell
 * under its row's use case, so a closed cell's status counts what changed in it and the use case what changed in its row.
 */
const treeCache = new WeakMap<DeliveryGraph, MarkTree>();
function markTree(graph: DeliveryGraph): MarkTree {
  const known = treeCache.get(graph);
  if (known) return known;
  const nodes = new Map<string, { parent: string | null }>();
  for (const [key, item] of graph.items) nodes.set(key, { parent: item.parent ?? (item.row && item.column > 1 ? `${item.row}|use-case` : null) });
  const tree: MarkTree = { nodes, idOf: (place) => recordAt(graph, place), placeOfId: (id) => graph.boxesOf.get(id)?.[0] ?? null };
  treeCache.set(graph, tree);
  return tree;
}

/** The rows' bands: a rule between each two, and the mark over the rows serving no outcome. */
function paintRows(g: CanvasRenderingContext2D, laid: DeliveryLaid, graph: DeliveryGraph, look: Look, fonts: GraphFonts, X: (x: number) => number, Y: (y: number) => number, zoom: number) {
  g.save();
  g.globalAlpha = 0.6;
  g.strokeStyle = look.rule;
  g.lineWidth = 1;
  g.beginPath();
  const left = X(columnLeft(1) - 12);
  const right = X(laid.width + 12);
  for (const band of laid.rows.values()) {
    const y = Y(band.y + band.h + 11);
    if (y < -2 || y > g.canvas.height) continue;
    g.moveTo(left, y);
    g.lineTo(right, y);
  }
  g.stroke();
  if (laid.outsideTop !== null) {
    const y = Y(laid.outsideTop - OUTSIDE_GAP / 3);
    g.globalAlpha = 0.8;
    g.strokeStyle = look.muted;
    g.setLineDash([6, 4]);
    g.beginPath();
    g.moveTo(X(-24), y);
    g.lineTo(X(laid.width + 24), y);
    g.stroke();
    g.setLineDash([]);
    const px = 14 * zoom;
    if (px >= 5) {
      g.globalAlpha = 1;
      g.fillStyle = look.muted;
      g.font = fontFor(fonts, 'title', px);
      g.textBaseline = 'bottom';
      g.textAlign = 'left';
      g.fillText(`No outcome · ${graph.counts.outside} use ${graph.counts.outside === 1 ? 'case serves' : 'cases serve'} no business outcome`, X(0), y - 8 * zoom);
    }
  }
  g.restore();
}

/** Each drawn box's toggle at its right: ▸ while closed, ▾ while open, in its box's edge color. */
function paintToggles(g: CanvasRenderingContext2D, plates: readonly Plate[], graph: DeliveryGraph, open: Openness, look: Look, fonts: GraphFonts, v: Viewport, dpr: number, strength: (place: string) => number) {
  g.save();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const p of plates) {
    const item = graph.items.get(p.place);
    if (!item?.opens || isBlock(p, v.zoom)) continue;
    const t = toggleAt(p);
    const x = t.x * v.zoom + v.x;
    const y = t.y * v.zoom + v.y;
    const s = t.w * v.zoom;
    const shut = !isOpen(item, open);
    g.globalAlpha = strength(p.place);
    g.fillStyle = look.sheet;
    g.strokeStyle = boxColors(look, p).edge;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(x, y, s, s, 3 * v.zoom);
    g.fill();
    g.stroke();
    g.beginPath();
    const c = { x: x + s / 2, y: y + s / 2 };
    const r = s * 0.24;
    // A chevron: pointing right while closed, down while open.
    g.strokeStyle = look.ink;
    g.lineWidth = Math.max(1, 1.6 * v.zoom);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (shut) { g.moveTo(c.x - r * 0.45, c.y - r); g.lineTo(c.x + r * 0.55, c.y); g.lineTo(c.x - r * 0.45, c.y + r); }
    else { g.moveTo(c.x - r, c.y - r * 0.45); g.lineTo(c.x, c.y + r * 0.55); g.lineTo(c.x + r, c.y - r * 0.45); }
    g.stroke();
  }
  void fonts;
  g.restore();
}

/** The columns' names and counts, kept at the top of the frame over each column; a stage's with its Expand all toggle. */
function paintHeads(g: CanvasRenderingContext2D, counts: readonly number[], rolls: readonly (ChangeCounts | undefined)[], every: Readonly<Record<DeliveryStage, boolean>>, look: Look, fonts: GraphFonts, v: Viewport, box: { x: number; y: number; w: number; h: number }, dpr: number) {
  g.save();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalAlpha = 1;
  g.fillStyle = look.paper;
  g.fillRect(box.x, box.y, box.w, HEAD_PX);
  g.strokeStyle = look.rule;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(box.x, box.y + HEAD_PX - 0.5);
  g.lineTo(box.x + box.w, box.y + HEAD_PX - 0.5);
  g.stroke();
  g.beginPath();
  g.rect(box.x, box.y, box.w, HEAD_PX);
  g.clip();
  g.textBaseline = 'middle';
  DELIVERY_COLUMNS.forEach((c, i) => {
    const mid = (columnLeft(i) + ITEM_WIDTH / 2) * v.zoom + v.x;
    const name = DELIVERY_COLUMN_LABELS[c];
    // A stage's count is its rows with a gap; the outcomes' and use cases' their own.
    const countText = i >= 2 ? (counts[i] ? `${counts[i]} with gaps` : 'no gaps') : String(counts[i] ?? 0);
    g.font = fontFor(fonts, 'title', HEAD_FONT);
    const nameW = g.measureText(name).width;
    g.font = fontFor(fonts, 'meta', HEAD_FONT - 1);
    const countW = g.measureText(countText).width;
    const glyph = i >= 1 ? 14 : 0;
    const start = mid - (glyph + nameW + 6 + countW) / 2;
    const roll = rolls[i];
    const line = box.y + (roll ? 9 : HEAD_PX / 2);
    g.textAlign = 'left';
    if (glyph) {
      const open = every[DELIVERY_STAGES[i - 1]];
      const cx = start + 5;
      const cy = line;
      g.fillStyle = look.muted;
      g.beginPath();
      if (!open) { g.moveTo(cx - 3, cy - 5); g.lineTo(cx + 4, cy); g.lineTo(cx - 3, cy + 5); }
      else { g.moveTo(cx - 5, cy - 3); g.lineTo(cx + 5, cy - 3); g.lineTo(cx, cy + 4); }
      g.closePath();
      g.fill();
    }
    g.fillStyle = look.ink;
    g.font = fontFor(fonts, 'title', HEAD_FONT);
    g.fillText(name, start + glyph, line);
    g.fillStyle = i >= 2 && counts[i] ? look.warn : look.muted;
    g.font = fontFor(fonts, 'meta', HEAD_FONT - 1);
    g.fillText(countText, start + glyph + nameW + 6, line);
    if (roll) {
      // The column's roll-up: all three counts when they fit across the column, else how many changes in all.
      g.font = fontFor(fonts, 'badge', 10);
      const room = ITEM_WIDTH * v.zoom - 4;
      const full = rollupText(roll);
      const total = `${totalChanges(roll)} ${totalChanges(roll) === 1 ? 'change' : 'changes'}`;
      const text = g.measureText(full).width + 10 <= room ? full : total;
      const w = g.measureText(text).width + 10;
      g.beginPath();
      g.roundRect(mid - w / 2, box.y + 16, w, 12, 6);
      g.fillStyle = look.sheet;
      g.fill();
      g.strokeStyle = look.ink;
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = look.ink;
      g.textAlign = 'center';
      g.fillText(text, mid, box.y + 22.5);
      g.textAlign = 'left';
    }
  });
  g.restore();
}
