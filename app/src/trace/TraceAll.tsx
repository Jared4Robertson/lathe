// The Trace stage's All-at-once view (LA-V98): the product's whole trace in five fixed columns (all.ts), each record once,
// laid out off the main thread (all-laid.ts) and drawn by the graph's renderer (paint.ts, plate.ts) under the graph's
// camera gestures (gestures.ts), with its links as lines between the columns.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { frameRect, MIN_ZOOM, type Viewport } from '../graph/camera';
import { faintest, fadeTween, keptFade, type FadeLook } from '../graph/fade';
import { fontFor, pageMeasure, readGraphFonts, readyMeasure, type GraphFonts } from '../graph/fonts';
import { useCameraGestures } from '../graph/gestures';
import { hitPlate } from '../graph/hit';
import { PLAIN_LOOK, readLook, useThemeVersion, type Look } from '../graph/look';
import type { MapNode } from '../graph/map';
import { readMotion } from '../graph/motion';
import { followBox, useMorph } from '../graph/morph';
import { boxColors, GAP_KIND, isBlock, paint, stageColors, type Bar, type Camera, type PaintState } from '../graph/paint';
import { plateName, plateOf, plateTip, type Plate, type PlainBox } from '../graph/plate';
import { BORDER, LABEL_PAD, labelHeight, largestFit, linesIn, setTextMeasure, titleWidth, treeLabel, type MapLabel, type TextMeasure, type WrappedLabel } from '../graph/text';
import { SHAPES } from '../graph/shapes';
import { TapCard, useTapToOpen } from '../graph/touch';
import { stageFor } from '../graph/model';
import { useCommand } from '../shell/commands';
import { keepCamera } from '../exploring/tab-set/commands/keep-camera';
import { keptCamera } from '../exploring/tab-set/reads';
import { runTabSetCommand } from '../exploring/tab-set/run';
import { useOpenSpace, type Insets, type OpenSpaceStore } from '../views/openSpace';
import { drawLeaderLine, openIn, useLeaderFollow } from '../views/leaderLine';
import { StageCamera, ZOOM_STEP } from '../views/StageChrome';
import { useChanges } from '../changes/changes';
import { lensFade, marksMoving, useStageMarks } from '../changes/marks';
import { ALL_COLUMN_LABELS, ALL_COLUMNS, GAP_WORDS, keptBy, pathOf, type AllGraph, type LinkKind } from './all';
import { BOX_HEIGHT, BOX_WIDTH, columnLeft, OUTSIDE_GAP } from './all-layout';
import { lastAllLayout, useAllLaidOut, type AllLaid, type BoxPlace } from './all-laid';

// Every box is the same size, its kind and ID line and its title at a readable size. A column is drawn only where the
// camera shows it: each box in view (a tenth of the pane to spare), and when its boxes are under 3 px tall or past the
// budget of 260, each run of them as one bar, the focus's path still marked on it. A box whose title would draw under
// 5 px is a plain block (graph/camera.ts BLOCK_BELOW_PX). The links are drawn as curves from a box's right to the linked
// box's left, under the boxes, in the colors of their kinds: serves, reaches, built by, proved by (which passes behind
// the Built by column); a frame draws those touching a box drawn, and while the boxes are bars only the lit ones.
//
// Focusing a record (a click, the walk, the address) lights its whole path, back along its links to the outcomes it
// serves and on to its tests, fading the rest; hovering a box lights its path the same way while the pointer is on it.
// Gaps only keeps each obligation with a gap and its path. The columns' names stay at the top of the frame. The camera
// frames the focus with what it links to; a new layout (a data change) moves no camera, and what moved glides from its
// old place to its new one. The canvas is hidden from assistive technology: the stage's table (TraceView.tsx) is its
// accessible layer.

const NO_INSETS: Insets = { left: 0, top: 0, right: 0, bottom: 0 };
const MIN_FRAME = 120;
const MAX_ZOOM = 4;
/** A box drawn under this many CSS pixels tall is a bar with its run; past this many boxes in view, every column is bars. */
const BAR_BELOW_PX = 3;
const BOX_BUDGET = 260;
/** The most lines a frame draws while the boxes are bars. */
const LINE_BUDGET = 4000;
/** The least zoom the framing of a focus's path goes to, so its boxes read; and the keyboard ring's. */
const PATH_ZOOM = 0.6;
const READ_ZOOM = 0.55;
/** The most a box's text grows to fill its box (its title of one or two lines), so it reads further out. */
const MOST_TEXT = 1.6;
/** The least a box's text shrinks to: a title too long for it at this size is cut instead. */
const LEAST_TEXT = 1.1;
/** The least zoom the product's overview opens at: its titles still read, the columns past the frame a pan away. */
const OVERVIEW_ZOOM = 0.6;
/** The height of the columns' names at the top of the frame, in CSS pixels. */
const HEAD_PX = 30;
const HEAD_FONT = 12;
/** The view's own name for a gap box's look. */
const GAP_PLAIN = (missing: keyof typeof GAP_WORDS, obligation: string): PlainBox => ({ kind: GAP_KIND, kindLabel: 'Gap', title: GAP_WORDS[missing], meta: `Gap · ${obligation}`, dashed: true, stage: 'structural' });

/** One drawn box as the test hook reports it, in the page's pixels. */
export interface AllSceneBox {
  key: string; id: string; role: 'record' | 'gap'; column: number; under: boolean; focus: boolean; hover: boolean; ring: boolean;
  lit: boolean | null; strength: number; change: 'added' | 'changed' | null; dashed: boolean; block: boolean; kind: string; stage: string; meta: string; name: string;
  rect: { left: number; top: number; width: number; height: number };
}
/** What the view draws now: its camera, boxes, bars and lines; or, `whole`, every box and link. */
export interface AllScene {
  camera: Viewport;
  canvas: { left: number; top: number; width: number; height: number };
  boxes: AllSceneBox[];
  bars: number;
  lines: { from: string; to: string; kind: LinkKind; lit: boolean }[];
  columns: { name: string; count: number }[];
  outsideTop: number | null;
  laidOut: ReturnType<typeof lastAllLayout>;
}
/** The canvas's element, with the hooks the tests read the drawn scene and hit-test through. */
export type AllHost = HTMLDivElement & { traceScene?: (whole?: boolean) => AllScene; traceHit?: (clientX: number, clientY: number) => string | null };

export interface TraceAllProps {
  index: RecordIndex;
  focus: string;
  graph: AllGraph;
  gapsOnly: boolean;
  /** A count the Tidy up button raises: the columns are ordered afresh once for each. */
  tidy: number;
  /** Opens a record. */
  onNavigate: (id: string) => void;
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  space?: OpenSpaceStore;
  /** The box the keyboard is on (the table's focused link, or the walk's gap), ringed and brought into view; null for none. */
  ring: string | null;
  cameraKey?: string;
  onOpenNew?: (id: string, background: boolean) => void;
}

/** The view, once the label's faces have loaded and the text measure is ready (graph/fonts.ts). */
export function TraceAll(props: TraceAllProps) {
  const theme = useThemeVersion();
  const fonts = useMemo<GraphFonts>(() => readGraphFonts(), [theme]);
  const [measure, setMeasure] = useState<TextMeasure | null>(() => { void pageMeasure(fonts); return readyMeasure(fonts); });
  useEffect(() => {
    let live = true;
    void pageMeasure(fonts).then((m) => { if (live) setMeasure(m); });
    return () => { live = false; };
  }, [fonts.body, fonts.mono]);
  const laid = useAllLaidOut(props.graph, props.tidy);
  if (!measure || !laid) return <div className="graph-flow trace-flow" data-view="all-at-once" aria-busy="true" />;
  setTextMeasure(measure);
  return <AllScene {...props} graph={laid.graph} laid={laid.laid} fonts={fonts} theme={theme} />;
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

/** A link's color, by its kind: the color of the stage that makes the link (discovery's serves, the use cases' reach, the technical spec's builds, the test plan's proofs). */
export function linkColor(look: Look, kind: LinkKind): string {
  switch (kind) {
    case 'serves': return look.discoveryEdge;
    case 'reaches': return look.useCasesEdge;
    case 'built': return look.technicalSpecificationEdge;
    case 'proved': return look.testPlanEdge;
  }
}

/** The first index in a column whose box reaches down to `top` (its tops ascend). */
function firstFrom(order: readonly string[], places: ReadonlyMap<string, BoxPlace>, top: number): number {
  let lo = 0;
  let hi = order.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (places.get(order[mid])!.y + BOX_HEIGHT < top) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** What one frame draws. */
interface AllFrame { plates: Plate[]; bars: Bar[]; barred: boolean; lines: number[]; marks: { key: string; x: number; y: number }[] }

function AllScene({ index, focus, graph, laid, gapsOnly, onNavigate, onPeek, space, ring: ringAt, cameraKey, onOpenNew, fonts, theme }: Omit<TraceAllProps, 'tidy'> & { laid: AllLaid; fonts: GraphFonts; theme: number }) {
  const wrapper = useRef<AllHost>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const focusKey = graph.nodes.has(focus) ? focus : null;

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
    onTap: (x, y, e) => { const hit = hitAt(x, y); const opens = hit && hit.kind !== GAP_KIND ? hit.id : null; if (opens) tapToOpen.onNodeClick(e, opens); else tapToOpen.clear(); },
  });
  const { moveTo } = gestures;

  const open = useOpenSpace(space);
  const inset: Insets = open?.frame ?? NO_INSETS;
  const insetKey = `${inset.left} ${inset.top} ${inset.right} ${inset.bottom}`;
  const frameBox = useCallback((s: { w: number; h: number }) => {
    const w = s.w - inset.left - inset.right;
    const h = s.h - inset.top - inset.bottom;
    return w < MIN_FRAME || h < MIN_FRAME ? { x: 0, y: 0, w: s.w, h: s.h } : { x: inset.left, y: inset.top, w, h };
  }, [insetKey]);

  /**
   * The camera for the focus: every column across and its whole path's height, at a zoom its boxes read at, the focus
   * always in the frame (a path taller than that shows the part about the focus); with no box
   * (the product, or a record the view does not draw), the columns' tops across the frame's width.
   */
  const framing = useCallback((): Viewport | null => {
    if (!size || (space && !open)) return null;
    const box = frameBox(size);
    const head = { ...box, y: box.y + HEAD_PX, h: Math.max(MIN_FRAME, box.h - HEAD_PX) };
    const own = focusKey ? laid.places.get(focusKey) : undefined;
    if (focusKey && !own) return null;
    if (!own) {
      // From the first outcome down, so the overview reads left to right from it.
      const zoom = Math.min(1, Math.max(OVERVIEW_ZOOM, (head.w - 48) / laid.width));
      const first = laid.order[0]?.[0];
      const top = first ? laid.places.get(first)!.y - 24 : 0;
      return { x: head.x + Math.max(24, (head.w - laid.width * zoom) / 2), y: head.y + 16 - top * zoom, zoom };
    }
    let top = own.y;
    let bottom = own.y + own.h;
    for (const k of pathOf(graph, focusKey!).keys) {
      const p = laid.places.get(k);
      if (p) { top = Math.min(top, p.y); bottom = Math.max(bottom, p.y + p.h); }
    }
    // Every column across, the path's height when it fits at a zoom the path reads at (else as much of it as does).
    const v = frameRect({ x: 0, y: top, w: laid.width, h: bottom - top }, head, { pad: 24, read: PATH_ZOOM, max: 1, min: PATH_ZOOM });
    // The focus kept in the frame, a box's height from its edge.
    const at = own.y * v.zoom + v.y;
    const room = { top: head.y + own.h * v.zoom, bottom: head.y + head.h - 2 * own.h * v.zoom };
    const y = at < room.top ? v.y + room.top - at : at > room.bottom ? v.y + room.bottom - at : v.y;
    const right = (own.x + own.w) * v.zoom + v.x;
    const x = right > head.x + head.w - 24 ? v.x + head.x + head.w - 24 - right : v.x;
    return { x, y, zoom: v.zoom };
  }, [size, laid, graph, focusKey, frameBox, space, open]);

  // Each place keeps its camera (the Tab set's cameras, exploring/tab-set): taken back at once when it still frames the
  // same focus on the same layout.
  const framedNow = `${focus} ${laid.key}`;
  const cameraPlace = useRef<{ key: string | undefined; framed: string }>({ key: cameraKey, framed: framedNow });
  const keptView = useRef<Viewport | null>(cameraKey ? keptCamera<Viewport>(cameraKey, 'trace-all', framedNow) : null);
  useLayoutEffect(() => {
    const was = cameraPlace.current;
    if (was.key === cameraKey) { cameraPlace.current = { key: cameraKey, framed: framedNow }; return; }
    if (was.key && sizeRef.current) runTabSetCommand(keepCamera, { place: was.key, stage: 'trace-all', camera: { framed: was.framed, view: view.current } });
    cameraPlace.current = { key: cameraKey, framed: framedNow };
    keptView.current = cameraKey ? keptCamera<Viewport>(cameraKey, 'trace-all', framedNow) : null;
  });
  useEffect(() => () => {
    const { key, framed: what } = cameraPlace.current;
    if (key && sizeRef.current) runTabSetCommand(keepCamera, { place: key, stage: 'trace-all', camera: { framed: what, view: view.current } });
  }, []);

  // Frame the focus whenever it, the stage's size or the open space changes: a glide, except the first picture and a
  // resize. A new layout with the same focus (a data change, Tidy up) leaves the camera where it is (layout stability).
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
  const morphMap = useMemo(() => ({ view: 'all-at-once', roots: [graph.product], nodes: laid.places }), [laid, graph.product]);
  const morph = useMorph(morphMap);
  /** A box's place this frame: its layout's, or on its way there from the one before. */
  const placeAt = (key: string, now: number): BoxPlace | undefined => morph.box(key, now) ?? undefined;
  // A new layout with the same focus leaves the camera where it is, unless the focus's own box moved: then it glides with it.
  const laidBefore = useRef(laid);
  useLayoutEffect(() => {
    const was = laidBefore.current;
    laidBefore.current = laid;
    if (was === laid || !focusKey) return;
    const a = was.places.get(focusKey);
    const b = laid.places.get(focusKey);
    const v = a && b ? followBox(view.current, a, b, { min: MIN_ZOOM, max: MAX_ZOOM }) : null;
    if (v) moveTo(v, true);
  }, [laid]);

  // ---- The look, the fade and the plates ----
  const look = useRef<Look>(PLAIN_LOOK);
  useLayoutEffect(() => { if (wrapper.current) look.current = readLook(wrapper.current); requestPaint(); }, [theme]);
  const fadeLook = useMemo<Pick<FadeLook, 'focusFade'>>(() => ({ get focusFade() { return look.current.focusFade; } }), []);
  const changes = useChanges();
  /** The focus's path (and Gaps only's), kept at full strength; null keeps everything. */
  const kept = useMemo(() => keptBy(graph, focusKey, gapsOnly), [graph, focusKey, gapsOnly]);
  /** Each column's count of records, for its name at the top. */
  const counts = useMemo(() => laid.order.map((c) => c.filter((k) => graph.nodes.get(k)?.role === 'record').length), [laid, graph]);
  const fade = useMemo(() => {
    const own = kept ? keptFade((key) => kept.keys.has(key), fadeLook) : () => 1;
    return changes.lens ? faintest(own, lensFade(changes.byId, fadeLook, (key) => graph.nodes.get(key)?.gap?.obligation ?? key)) : own;
  }, [kept, graph, fadeLook, changes.lens, changes.byId]);
  const tween = useMemo(() => fadeTween((t) => readMotion().ease(t)), []);
  useLayoutEffect(() => {
    tween.send(fade, glideMs.current ?? look.current.fade);
    glideMs.current = null;
    requestPaint();
  }, [fade]);

  /** Each box's plate at the origin, made when first drawn, once per graph. */
  const plates = useMemo(() => new Map<string, Plate>(), [graph, index, fonts]);
  const plateFor = useCallback((key: string): Plate | null => {
    const known = plates.get(key);
    if (known) return known;
    const n = graph.nodes.get(key);
    if (!n) return null;
    const plain = n.gap ? GAP_PLAIN(n.gap.missing, n.gap.obligation) : undefined;
    const label = plain ? { title: plain.title, meta: plain.meta, shape: 'box' as const } : treeLabel(index, key);
    const border = (s: number) => BORDER * s;
    // Its text as large as its label fits, up to MOST_TEXT, and never under LEAST_TEXT: a longer title is cut with an ellipsis (whole in its tooltip).
    const text = Math.max(LEAST_TEXT, largestFit(label, false, BOX_WIDTH, BOX_HEIGHT, MOST_TEXT, border) || LEAST_TEXT);
    const width = (BOX_WIDTH - 2 * border(text)) / text;
    const home: MapNode = { id: key, parent: null, children: [], level: n.column, x: 0, y: 0, w: BOX_WIDTH, h: BOX_HEIGHT, text, centered: false, lines: cutToFit(linesIn(label, width, false), label, width, BOX_HEIGHT / text) };
    const plate = plateOf(index, key, { view: 'tree', node: home, place: key, plain });
    plates.set(key, plate);
    return plate;
  }, [plates, graph, index]);

  // ---- The spotlight (a hover's path), the pointer, the keyboard's ring and a tap's selection ----
  const hover = useRef<string | null>(null);
  const ring = useRef<string | null>(null);
  const spotlight = useRef<{ key: string | null; lit: ReadonlySet<string> | null; links: ReadonlySet<number> | null; from: number; to: number; start: number }>({ key: null, lit: null, links: null, from: 0, to: 0, start: 0 });
  const spotNow = () => {
    const s = spotlight.current;
    const ms = look.current.fade;
    const t = ms > 0 ? Math.min(1, (performance.now() - s.start) / ms) : 1;
    return { value: s.from + (s.to - s.from) * t, done: t >= 1 };
  };
  const ctx = useRef<CanvasRenderingContext2D | null | undefined>(undefined);
  const tap = useRef<ReturnType<typeof useTapToOpen> | null>(null);
  const lastFrame = useRef<AllFrame | null>(null);
  lastFrame.current = null;

  /** What a camera shows: the boxes in view as plates (or bars past the budget), the links to draw, and the path's marks on bars; `whole`, every box. */
  const frameAt = useCallback((v: Viewport, s: { w: number; h: number }, now: number, whole = false): AllFrame => {
    const spare = { x: s.w / 10, y: s.h / 10 };
    const top = (-v.y - spare.y) / v.zoom;
    const bottom = (s.h - v.y + spare.y) / v.zoom;
    const left = (-v.x - spare.x) / v.zoom;
    const right = (s.w - v.x + spare.x) / v.zoom;
    const shown: { key: string; column: number }[] = [];
    laid.order.forEach((order, column) => {
      const x = columnLeft(column);
      if (!whole && (x + BOX_WIDTH < left || x > right)) return;
      for (let i = whole ? 0 : firstFrom(order, laid.places, top); i < order.length; i++) {
        const key = order[i];
        if (!whole && laid.places.get(key)!.y > bottom) break;
        shown.push({ key, column });
      }
    });
    const barred = !whole && (BOX_HEIGHT * v.zoom < BAR_BELOW_PX || shown.length > BOX_BUDGET);
    const out: AllFrame = { plates: [], bars: [], barred, lines: [], marks: [] };
    if (!barred) {
      for (const { key } of shown) {
        const home = plateFor(key);
        const at = placeAt(key, now);
        if (home && at) out.plates.push(shifted(home, at.x, at.y));
      }
    } else {
      // Each run of boxes closer than a pixel and a half apart on screen as one bar.
      let run: Bar | null = null;
      let runColumn = -1;
      for (const { key, column } of shown) {
        const p = laid.places.get(key)!;
        if (run && runColumn === column && (p.y - (run.y + run.h)) * v.zoom < 1.5) { run.h = p.y + p.h - run.y; continue; }
        if (run) out.bars.push(run);
        run = { parent: `column:${column}`, x: p.x, y: p.y, w: p.w, h: p.h };
        runColumn = column;
      }
      if (run) out.bars.push(run);
    }
    // The links: those touching a box drawn; while the boxes are bars, only the lit ones (the focus's path, Gaps only's,
    // the hover's), within the budget.
    const sp = spotlight.current;
    if (!barred) {
      const seen = new Set<number>();
      for (const p of out.plates) for (const l of [...(graph.out.get(p.place) ?? []), ...(graph.into.get(p.place) ?? [])]) if (!seen.has(l)) { seen.add(l); out.lines.push(l); }
    } else {
      const lit = new Set<number>([...(kept?.links ?? []), ...(sp.key !== null && sp.links ? sp.links : [])]);
      for (const l of lit) {
        if (out.lines.length >= LINE_BUDGET) break;
        const link = graph.links[l];
        const a = laid.places.get(link.from);
        const b = laid.places.get(link.to);
        if (!a || !b || Math.max(a.y, b.y) + BOX_HEIGHT < top || Math.min(a.y, b.y) > bottom) continue;
        out.lines.push(l);
      }
      // The path's boxes marked on their bars.
      const keys = sp.key !== null && sp.lit ? sp.lit : kept?.keys;
      if (keys) for (const { key } of shown) if (keys.has(key)) { const p = laid.places.get(key)!; out.marks.push({ key, x: p.x, y: p.y }); }
    }
    return out;
  }, [laid, graph, plateFor, kept]);

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
    const state: PaintState = { focus, hover: hover.current, ring: ring.current, armed: tap.current?.armed ?? null, lit: sp.lit, litLines: null, spot: spot.value, strength, marks: live, open: openIn(wrapper.current, space, s.w, s.h) };
    const v = view.current;
    const cam: Camera = { cx: (s.w / 2 - v.x) / v.zoom, cy: (s.h / 2 - v.y) / v.zoom, zoom: v.zoom, w: s.w, h: s.h };
    const lk = look.current;
    const wires = (c: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number) => {
      paintOutsideMark(c, laid, graph, lk, fonts, X, Y, v.zoom);
      // The lines, in one path per kind and strength: those on a lit path strong, the rest faint, a faded end fainter.
      const groups = new Map<string, { kind: LinkKind; alpha: number; width: number; segs: number[] }>();
      const litLinks = sp.key !== null && sp.links ? sp.links : null;
      for (const l of frame.lines) {
        const link = graph.links[l];
        const a = placeAt(link.from, now);
        const b = placeAt(link.to, now);
        if (!a || !b) continue;
        const onPath = (kept?.links.has(l) ?? false) || (litLinks?.has(l) ?? false);
        const weak = Math.min(strength(link.from), strength(link.to));
        const dim = litLinks && !litLinks.has(l) ? lk.spotlightDim + (1 - lk.spotlightDim) * (1 - spot.value) : 1;
        const alpha = (onPath && (kept || litLinks) ? 0.9 : 0.4 * weak) * dim;
        const width = onPath && (kept || litLinks) ? 2 : 1.25;
        const id = `${link.kind}|${alpha.toFixed(2)}|${width}`;
        const group = groups.get(id) ?? groups.set(id, { kind: link.kind, alpha, width, segs: [] }).get(id)!;
        group.segs.push(a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2);
      }
      for (const group of groups.values()) {
        c.globalAlpha = group.alpha;
        c.strokeStyle = linkColor(lk, group.kind);
        c.lineWidth = Math.max(0.75, Math.min(2.5, group.width * v.zoom));
        c.beginPath();
        for (let i = 0; i < group.segs.length; i += 4) {
          const [x0, y0, x1, y1] = [X(group.segs[i]), Y(group.segs[i + 1]), X(group.segs[i + 2]), Y(group.segs[i + 3])];
          const bend = (x1 - x0) / 2;
          c.moveTo(x0, y0);
          c.bezierCurveTo(x0 + bend, y0, x1 - bend, y1, x1, y1);
        }
        c.stroke();
      }
      // On bars, the path's boxes as marks in their stage's color.
      if (frame.marks.length > 0) {
        c.globalAlpha = 1;
        for (const m of frame.marks) {
          const n = graph.nodes.get(m.key)!;
          c.fillStyle = n.gap ? lk.warn : stageColors(lk, stageFor(index, m.key, index.byId.get(m.key)?.kind ?? '')).edge;
          c.fillRect(X(m.x), Y(m.y), BOX_WIDTH * v.zoom, Math.max(1.5, BOX_HEIGHT * v.zoom));
        }
      }
      c.globalAlpha = 1;
    };
    paint(g, dpr, cam, { plates: frame.plates, bars: frame.bars, lines: [], wires }, lk, fonts, state);
    paintHeads(g, counts, lk, fonts, v, frameBox(s), dpr);
    // The leader line to the wiki card (LA-V96-R24), from the focus's box, in its outline's color.
    const own = focusKey ? placeAt(focusKey, now) : undefined;
    const p = own ? plateFor(focusKey!) : null;
    if (wrapper.current) drawLeaderLine(g, {
      host: wrapper.current, space, dpr, color: p ? boxColors(lk, p).edge : lk.ink,
      box: own ? { left: own.x * v.zoom + v.x, top: own.y * v.zoom + v.y, right: (own.x + own.w) * v.zoom + v.x, bottom: (own.y + own.h) * v.zoom + v.y } : null,
    });
    const moving = morph.moving(now);
    if (moving || !spot.done || !faded.done || marksMoving(live, frame.plates.map((x) => x.id))) requestPaint();
    else if (sp.to === 0 && sp.lit) { sp.lit = null; sp.links = null; }
  };
  useEffect(() => { requestPaint(); });
  useLeaderFollow(wrapper, space, () => paintRef.current());

  // The live marks: each record's on its box; a removed record's ghost where the layout before had it.
  const placeOf = useCallback((id: string) => laid.places.get(id) ?? null, [laid]);
  const marks = useStageMarks(placeOf);

  /** Lights a box's whole path while the pointer is on it; null lets go. */
  const spot = useCallback((key: string | null) => {
    onPeek?.('hover', key && index.byId.has(key) ? key : null);
    const s = spotlight.current;
    const value = spotNow().value;
    if (key === null) {
      if (s.key !== null) { spotlight.current = { ...s, key: null, from: value, to: 0, start: performance.now() }; requestPaint(); }
      return;
    }
    if (s.key === key) return;
    const path = pathOf(graph, key);
    spotlight.current = { key, lit: path.keys, links: path.links, from: s.key === null ? value : 1, to: 1, start: performance.now() };
    requestPaint();
  }, [graph, index, onPeek, requestPaint]);
  useEffect(() => () => spot(null), [focus, graph]);

  const canOpen = useCallback((id: string) => id !== focus && index.byId.has(id), [focus, index]);
  const tapToOpen = useTapToOpen(onNavigate, canOpen, wrapper, focus, onOpenNew);
  tap.current = tapToOpen;
  useEffect(() => { onPeek?.('selected', tapToOpen.armed); requestPaint(); }, [tapToOpen.armed, onPeek]);

  // The keyboard's ring: the box the table's focused link or the walk stands on, its path lit, brought into view when it is not.
  useEffect(() => {
    ring.current = ringAt && graph.nodes.has(ringAt) ? ringAt : null;
    spot(ring.current);
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
  }, [ringAt]);

  // ---- The pointer: hover and click (drag, wheel and pinch are graph/gestures.ts's) ----
  const hitAt = useCallback((x: number, y: number): Plate | null => {
    const v = view.current;
    const s = sizeRef.current;
    if (!s) return null;
    const frame = lastFrame.current ?? frameAt(v, s, performance.now());
    return hitPlate(frame.plates, { x: (x - v.x) / v.zoom, y: (y - v.y) / v.zoom });
  }, [frameAt]);
  const setHover = (hit: Plate | null) => {
    const key = hit?.place ?? null;
    if (hover.current === key) return;
    hover.current = key;
    const c = canvas.current;
    if (c) {
      c.style.cursor = hit && hit.kind !== GAP_KIND && canOpen(hit.id) ? 'pointer' : '';
      c.title = hit ? (hit.kind === GAP_KIND ? `${hit.title} (${hit.meta})` : plateTip(hit)) : '';
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
    moveTo(frameRect({ x: 0, y: 0, w: laid.width, h: laid.height }, { ...box, y: box.y + HEAD_PX, h: Math.max(MIN_FRAME, box.h - HEAD_PX) }, { pad: 24, read: MIN_ZOOM, max: 1, min: MIN_ZOOM }), true);
  };

  // ---- The test hook: the drawn scene, in the page's pixels ----
  useEffect(() => {
    const host = wrapper.current;
    if (!host) return;
    host.traceHit = (clientX, clientY) => {
      const r = canvas.current!.getBoundingClientRect();
      return hitAt(clientX - r.left, clientY - r.top)?.place ?? null;
    };
    host.traceScene = (whole = false) => {
      const s = sizeRef.current ?? { w: 0, h: 0 };
      const v = view.current;
      const r = canvas.current!.getBoundingClientRect();
      const frame = frameAt(v, s, performance.now(), whole);
      const sp = spotlight.current;
      const strength = tween.now().at;
      const litLinks = sp.key !== null ? sp.links : kept?.links ?? null;
      return {
        camera: { ...v },
        canvas: { left: r.left, top: r.top, width: s.w, height: s.h },
        bars: frame.bars.length,
        outsideTop: laid.outsideTop,
        laidOut: lastAllLayout(),
        columns: ALL_COLUMNS.map((c, i) => ({ name: ALL_COLUMN_LABELS[c], count: counts[i] ?? 0 })),
        lines: (whole ? graph.links.map((_, i) => i) : frame.lines).map((l) => ({ from: graph.links[l].from, to: graph.links[l].to, kind: graph.links[l].kind, lit: litLinks?.has(l) ?? false })),
        boxes: (whole ? [...laid.places.keys()].map((k) => { const at = laid.places.get(k)!; return shifted(plateFor(k)!, at.x, at.y); }) : frame.plates).map((p) => {
          const n = graph.nodes.get(p.place)!;
          return {
            key: p.place, id: p.id, role: n.role, column: n.column, under: n.under, focus: p.id === focus, hover: hover.current === p.place, ring: ring.current === p.place,
            lit: sp.key !== null && sp.lit ? sp.lit.has(p.place) : kept ? kept.keys.has(p.place) : null, strength: strength(p.place),
            change: ((m) => (m && m.change !== 'removed' ? m.change : null))(changes.live.get(p.id)),
            dashed: p.dashed, block: isBlock(p, v.zoom), kind: p.kind, stage: p.stage, meta: p.lines.filter((l) => l.face === 'meta').map((l) => l.text).join(''), name: plateName(p, p.id === focus),
            rect: { left: r.left + p.x * v.zoom + v.x, top: r.top + p.y * v.zoom + v.y, width: p.w * v.zoom, height: p.h * v.zoom },
          };
        }),
      };
    };
  });

  const armedPlate = tapToOpen.armed ? plateFor(tapToOpen.armed) : null;
  return (
    <div ref={wrapper} className="graph-flow trace-flow" data-view="all-at-once" data-ready={size ? 'true' : undefined}>
      <canvas
        ref={canvas}
        className="graph-canvas-draw"
        aria-hidden="true"
        {...gestures.handlers}
        onAuxClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const hit = hitAt(e.clientX - r.left, e.clientY - r.top);
          if (hit && hit.kind !== GAP_KIND) tapToOpen.onNodeAuxClick(e, hit.id);
        }}
        onPointerLeave={(e) => { if (!gestures.pressed(e.pointerId)) setHover(null); }}
      />
      <StageCamera onZoomIn={zoomButton(ZOOM_STEP)} onZoomOut={zoomButton(1 / ZOOM_STEP)} onFit={fitAll} />
      {armedPlate && <TapCard kind={armedPlate.kindLabel} name={armedPlate.title} onOpen={tapToOpen.openArmed} onDismiss={tapToOpen.clear} />}
    </div>
  );
}

/** The mark over the boxes under no outcome: a dashed rule across the columns, named, with their count. */
function paintOutsideMark(g: CanvasRenderingContext2D, laid: AllLaid, graph: AllGraph, look: Look, fonts: GraphFonts, X: (x: number) => number, Y: (y: number) => number, zoom: number) {
  if (laid.outsideTop === null) return;
  const y = laid.outsideTop - OUTSIDE_GAP / 3;
  g.save();
  g.globalAlpha = 0.8;
  g.strokeStyle = look.muted;
  g.lineWidth = 1;
  g.setLineDash([6, 4]);
  g.beginPath();
  g.moveTo(X(-24), Y(y));
  g.lineTo(X(laid.width + 24), Y(y));
  g.stroke();
  g.setLineDash([]);
  const px = 14 * zoom;
  if (px >= 5) {
    g.globalAlpha = 1;
    g.fillStyle = look.muted;
    g.font = fontFor(fonts, 'title', px);
    g.textBaseline = 'bottom';
    g.textAlign = 'left';
    g.fillText(`Not under an outcome · ${graph.counts.outside} ${graph.counts.outside === 1 ? 'record' : 'records'} no outcome reaches`, X(0), Y(y - 8));
  }
  g.restore();
}

/** The columns' names and counts, kept at the top of the frame over each column. */
function paintHeads(g: CanvasRenderingContext2D, counts: readonly number[], look: Look, fonts: GraphFonts, v: Viewport, box: { x: number; y: number; w: number; h: number }, dpr: number) {
  g.save();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalAlpha = 0.94;
  g.fillStyle = look.paper;
  g.fillRect(box.x, box.y, box.w, HEAD_PX);
  g.globalAlpha = 1;
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
  g.textAlign = 'center';
  ALL_COLUMNS.forEach((c, i) => {
    const count = counts[i] ?? 0;
    const mid = (columnLeft(i) + BOX_WIDTH / 2) * v.zoom + v.x;
    g.font = fontFor(fonts, 'title', HEAD_FONT);
    const name = ALL_COLUMN_LABELS[c];
    const nameW = g.measureText(name).width;
    g.font = fontFor(fonts, 'meta', HEAD_FONT - 1);
    const countText = String(count);
    const countW = g.measureText(countText).width;
    const start = mid - (nameW + 6 + countW) / 2;
    g.textAlign = 'left';
    g.fillStyle = look.ink;
    g.font = fontFor(fonts, 'title', HEAD_FONT);
    g.fillText(name, start, box.y + HEAD_PX / 2);
    g.fillStyle = look.muted;
    g.font = fontFor(fonts, 'meta', HEAD_FONT - 1);
    g.fillText(countText, start + nameW + 6, box.y + HEAD_PX / 2);
  });
  g.restore();
}
