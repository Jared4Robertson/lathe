// The Trace stage drawn as columns (LA-V98-R13): the product's tree (tree.ts) along the focus's path, a column per level
// (columns.ts), drawn by the graph's renderer (paint.ts, plate.ts) under the graph's camera gestures (gestures.ts).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import type { Viewport } from '../graph/camera';
import { faintest, fadeTween, type FadeLook } from '../graph/fade';
import { fontFor, pageMeasure, readGraphFonts, readyMeasure, type GraphFonts } from '../graph/fonts';
import { useCameraGestures, useWheelMove, wheelLatch } from '../graph/gestures';
import { hitPlate } from '../graph/hit';
import { PLAIN_LOOK, readLook, useThemeVersion, type Look } from '../graph/look';
import type { MapNode } from '../graph/map';
import { readMotion } from '../graph/motion';
import { boxColors, GAP_KIND, paint, type Camera, type PaintState } from '../graph/paint';
import { plateName, plateOf, plateTip, type Plate, type PlainBox } from '../graph/plate';
import { BORDER, LABEL_PAD, largestFit, linesIn, setTextMeasure, titleWidth, type MapLabel, type TextMeasure, type WrappedLabel } from '../graph/text';
import { outlineInset, SHAPES } from '../graph/shapes';
import { TapCard, useTapToOpen } from '../graph/touch';
import { useCommand } from '../shell/commands';
import { keepCamera } from '../exploring/tab-set/commands/keep-camera';
import { keptCamera } from '../exploring/tab-set/reads';
import { runTabSetCommand } from '../exploring/tab-set/run';
import { useOpenSpace, type Insets, type OpenSpaceStore } from '../views/openSpace';
import { drawLeaderLine, useLeaderFollow } from '../views/leaderLine';
import { StageCamera, ZOOM_STEP } from '../views/StageChrome';
import { useChanges } from '../changes/changes';
import { highlightFade, marksMoving, useStageMarks } from '../changes/marks';
import {
  BOX_HEIGHT, clampScroll, COLUMN_GAP, COLUMN_WIDTH, columnBoxes, columnHeight, columnLefts, columnScrolls, columnSizes, columnsView, columnView,
  COLUMNS_PAD, COMPACT_HEIGHT, COMPACT_WIDTH, COUNT_ROOM, holds, scrollToShow, traceColumns, type ColumnSize, type TraceColumn,
} from './columns';
import { copyInChain, nodeLabel, traceFade, type TraceMap, type TraceNode } from './tree';
import type { TraceHost, TraceScene, TraceSceneBox } from './TraceCanvas';

// The focus's column, its parent's and its children's are full width, every box in them one size with its kind line,
// title and a count of what it holds at its right; the columns further up the path are compact, each box its title
// alone in two lines at the same size (cut with an ellipsis, whole in its tooltip), so the whole path from the product
// fits. The chosen box in each column (the focus's path) is ringed and joined to the column it opens, the focus ringed
// as on the tree. Labels are always placed as the column lays them out: no sticky label moves under a panel. The camera
// opens at zoom 1 with every column when they fit, else the last one ending at the frame's right; a column taller than the stage scrolls on its own under the wheel, its chosen box
// scrolled into view as the focus moves. Drag and the wheel (across the gaps, or a zoom) move the camera as on the tree,
// Scroll to zoom included. Gaps only and Highlight changes fade as on the tree; the focus fades nothing, since the path is the point.
//
// The canvas is hidden from assistive technology: the Trace stage's table (TraceView.tsx) stays its accessible layer.

/** The kinds and names of the nodes that are no record, as on the tree. */
const PLAIN: Record<Exclude<TraceNode['role'], 'record'>, { kind: string; label: string; dashed: boolean }> = {
  file: { kind: 'file', label: 'File', dashed: false },
  gap: { kind: GAP_KIND, label: 'Gap', dashed: true },
  outside: { kind: 'outside', label: 'Branch', dashed: false },
  untraced: { kind: GAP_KIND, label: 'Untraced', dashed: true },
};
const NO_INSETS: Insets = { left: 0, top: 0, right: 0, bottom: 0 };
const MIN_FRAME = 120;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
/** The count's font size at zoom 1; it sits at the bottom right of the box's label room, inside its shape. */
const COUNT_FONT = 11;
const COUNT_PAD = 10;
/** The ring round a chosen box, outside its outline, at zoom 1. */
const CHOSEN_RING = 2;

/** One drawn box as the test hook reports it: the tree's, with its column, whether it is on the focus's path, and its count. */
export interface ColumnSceneBox extends TraceSceneBox { column: number; compact: boolean; chosen: boolean; count: number }
export interface ColumnScene extends Omit<TraceScene, 'boxes'> { boxes: ColumnSceneBox[]; columns: { parent: string; compact: boolean; scroll: number; height: number }[] }
export type ColumnsHost = HTMLDivElement & { traceScene?: (whole?: boolean) => ColumnScene; traceHit?: TraceHost['traceHit'] };

export interface TraceColumnsProps {
  index: RecordIndex;
  focus: string;
  map: TraceMap;
  /** The node the focus stands on (tree.ts focusKey): the columns run to it. */
  at: string;
  gapsOnly: boolean;
  onNavigate: (id: string, at?: string) => void;
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  space?: OpenSpaceStore;
  /** The node the keyboard is on, ringed and scrolled into view when it is in a column; null for none. */
  ring: string | null;
  cameraKey?: string;
  onOpenNew?: (id: string, background: boolean) => void;
}

/** The columns, once the label's faces have loaded and the text measure is ready (graph/fonts.ts). */
export function TraceColumns(props: TraceColumnsProps) {
  const theme = useThemeVersion();
  const fonts = useMemo<GraphFonts>(() => readGraphFonts(), [theme]);
  const [measure, setMeasure] = useState<TextMeasure | null>(() => { void pageMeasure(fonts); return readyMeasure(fonts); });
  useEffect(() => {
    let live = true;
    void pageMeasure(fonts).then((m) => { if (live) setMeasure(m); });
    return () => { live = false; };
  }, [fonts.body, fonts.mono]);
  if (!measure) return <div className="graph-flow trace-flow" data-layout="columns" aria-busy="true" />;
  setTextMeasure(measure);
  return <ColumnsScene {...props} measure={measure} fonts={fonts} theme={theme} />;
}

/** A plate made at the origin moved to its place in its column, scrolled. */
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

/** A compact box's lines (LA-V98-R13): its title alone in at most two lines, the second cut with an ellipsis when it runs on. */
function compactLines(label: MapLabel, width: number): WrappedLabel {
  const full = linesIn({ ...label, meta: '', marks: 0, marked: false }, width, false);
  let title = full.title;
  if (title.length > 2) {
    const room = label.shape ? SHAPES[label.shape].room : { l: 0, r: 0 };
    const inner = width - 2 * LABEL_PAD - room.l - room.r;
    let second = title.slice(1).join('').trimEnd();
    while (second.length > 1 && titleWidth(`${second}…`) > inner) second = second.slice(0, -1).trimEnd();
    title = [title[0], `${second}…`];
  }
  return full.pad ? { title, meta: [], pad: full.pad } : { title, meta: [] };
}

/** No panel cuts a column's label: every label is drawn where its column placed it (no sticky label, graph/sticky.ts). */
const NO_CUT = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };

/** What one frame draws: the plates in view, scrolled, with each one's column, whether it is compact or chosen, and its count. */
interface Drawn { plate: Plate; column: number; compact: boolean; chosen: boolean; count: number }

function ColumnsScene({ index, focus, map, at, gapsOnly, onNavigate, onPeek, space, ring: ringAt, cameraKey, onOpenNew, fonts, theme }: TraceColumnsProps & { measure: TextMeasure; fonts: GraphFonts; theme: number }) {
  const wrapper = useRef<ColumnsHost>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const columns = useMemo(() => traceColumns(map, at), [map, at]);
  const sizes = useMemo(() => columnSizes(columns, at), [columns, at]);
  const lefts = useMemo(() => columnLefts(sizes), [sizes]);
  const columnsRef = useRef({ columns, sizes, lefts });
  columnsRef.current = { columns, sizes, lefts };

  // ---- The camera and each column's scroll ----
  const view = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const scrolls = useRef(new Map<string, number>());
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
    onTap: (x, y, e) => { const hit = hitAt(x, y); tapped.current = hit; const opens = hit ? map.nodes.get(hit.place)?.opens : null; if (opens) tapToOpen.onNodeClick(e, opens); else tapToOpen.clear(); },
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
  /** The height a column shows of itself now. */
  const viewHeight = useCallback(() => (sizeRef.current ? columnView(frameBox(sizeRef.current).h, view.current.zoom) : BOX_HEIGHT), [frameBox]);
  const scrollOf = useCallback((c: TraceColumn, size: ColumnSize) => clampScroll(scrolls.current.get(c.parent) ?? 0, c.keys.length, viewHeight(), size.h), [viewHeight]);

  /** The camera that shows the path (every column, or the last ending at the frame's right), and the scrolls that show each chosen box. */
  const framing = useCallback((): { v: Viewport; scrolls: Map<string, number> } | null => {
    if (!size || (space && !open)) return null;
    const box = frameBox(size);
    return { v: columnsView(sizes, box), scrolls: columnScrolls(columns, sizes, columnView(box.h, 1), scrolls.current) };
  }, [size, columns, sizes, frameBox, space, open]);

  // Each place keeps its camera and scrolls (the Tab set's cameras, exploring/tab-set), as the tree does.
  type Kept = { v: Viewport; scrolls: [string, number][] };
  const framedNow = `${focus} ${at}`;
  const cameraPlace = useRef<{ key: string | undefined; framed: string }>({ key: cameraKey, framed: framedNow });
  const keptView = useRef<Kept | null>(cameraKey ? keptCamera<Kept>(cameraKey, 'trace-columns', framedNow) : null);
  const keepNow = (): Kept => ({ v: view.current, scrolls: [...scrolls.current] });
  useLayoutEffect(() => {
    const was = cameraPlace.current;
    if (was.key === cameraKey) { cameraPlace.current = { key: cameraKey, framed: framedNow }; return; }
    if (was.key && sizeRef.current) runTabSetCommand(keepCamera, { place: was.key, stage: 'trace-columns', camera: { framed: was.framed, view: keepNow() } });
    cameraPlace.current = { key: cameraKey, framed: framedNow };
    keptView.current = cameraKey ? keptCamera<Kept>(cameraKey, 'trace-columns', framedNow) : null;
  });
  useEffect(() => () => {
    const { key, framed: what } = cameraPlace.current;
    if (key && sizeRef.current) runTabSetCommand(keepCamera, { place: key, stage: 'trace-columns', camera: { framed: what, view: keepNow() } });
  }, []);

  // Frame the path whenever the focus's node, the stage's size or the open space changes: a glide, except the first
  // picture and a resize. New data with the same focus leaves the camera and the scrolls where they are.
  const framed = useRef<{ w: number; h: number; at: string; focus: string; map: TraceMap } | null>(null);
  useLayoutEffect(() => {
    const target = framing();
    if (!target || !size) return;
    const kept = keptView.current;
    keptView.current = null;
    const was = framed.current;
    framed.current = { w: size.w, h: size.h, at, focus, map };
    if (kept) { scrolls.current = new Map(kept.scrolls); moveTo(kept.v, false); return; }
    const resized = was !== null && (was.w !== size.w || was.h !== size.h);
    if (was && !resized && was.focus === focus && was.at === at && was.map !== map) return;
    scrolls.current = target.scrolls;
    moveTo(target.v, was !== null && !resized);
  }, [framing]);
  const frameFocus = useCallback(() => { const t = framing(); if (t) { scrolls.current = t.scrolls; moveTo(t.v, true); } }, [framing, moveTo]);
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

  // ---- The look, the fade and the plates ----
  const look = useRef<Look>(PLAIN_LOOK);
  useLayoutEffect(() => { if (wrapper.current) look.current = readLook(wrapper.current); requestPaint(); }, [theme]);
  const fadeLook = useMemo<Pick<FadeLook, 'focusFade'>>(() => ({ get focusFade() { return look.current.focusFade; } }), []);
  const changes = useChanges();
  const fade = useMemo(() => (changes.highlight
    ? faintest(traceFade(map, null, gapsOnly, fadeLook), highlightFade(changes.byId, (place) => map.nodes.get(place)?.id ?? place))
    : traceFade(map, null, gapsOnly, fadeLook)), [map, gapsOnly, fadeLook, changes.highlight, changes.byId]);
  const tween = useMemo(() => fadeTween((t) => readMotion().ease(t)), []);
  useLayoutEffect(() => { tween.send(fade, look.current.fade); requestPaint(); }, [fade]);

  /** Each box's plate at the origin, full or compact, made once per map; frameAt moves it to its place. */
  const plates = useMemo(() => new Map<string, Plate>(), [map, index, fonts]);
  const plateFor = useCallback((key: string, compact: boolean): Plate | null => {
    const known = plates.get(`${compact ? 'c' : 'f'}|${key}`);
    if (known) return known;
    const n = map.nodes.get(key);
    const node = map.tree.get(key);
    if (!n || !node || node.parent === null) return null;
    const label = nodeLabel(index, n);
    const border = (s: number) => BORDER * s;
    const room = COLUMN_WIDTH - COUNT_ROOM;
    const text = compact ? 1 : largestFit(label, false, room, BOX_HEIGHT, 1, border) || 1;
    const home: MapNode = {
      id: key, parent: node.parent, children: node.children, level: node.level, x: 0, y: 0,
      w: compact ? COMPACT_WIDTH : COLUMN_WIDTH, h: compact ? COMPACT_HEIGHT : BOX_HEIGHT, text, centered: false,
      lines: compact ? compactLines(label, COMPACT_WIDTH - 2 * border(1)) : linesIn(label, (room - 2 * border(text)) / text, false),
    };
    const role = n.role === 'record' ? null : PLAIN[n.role];
    const plain: PlainBox | undefined = role ? { kind: role.kind, kindLabel: role.label, title: n.words!.title, meta: n.words!.meta, dashed: role.dashed, stage: 'structural' } : undefined;
    const made = plateOf(index, n.id, { view: 'tree', node: home, place: key, plain });
    const plate = compact ? { ...made, badges: [] } : made;
    plates.set(`${compact ? 'c' : 'f'}|${key}`, plate);
    return plate;
  }, [plates, map, index]);

  /** What a camera shows: the boxes of each column in view, scrolled; `whole`, every box of every column. */
  const frameAt = useCallback((v: Viewport, s: { w: number; h: number }, whole = false): Drawn[] => {
    const rows = whole ? undefined : { top: -v.y / v.zoom - BOX_HEIGHT, bottom: (s.h - v.y) / v.zoom };
    const left = -v.x / v.zoom - COLUMN_WIDTH;
    const right = (s.w - v.x) / v.zoom;
    const scrollBy = new Map(columns.map((c, i) => [c.parent, scrollOf(c, sizes[i])]));
    const out: Drawn[] = [];
    for (const b of columnBoxes(columns, sizes, (p) => scrollBy.get(p) ?? 0, rows)) {
      if (!whole && (b.x < left || b.x > right)) continue;
      const compact = sizes[b.column].compact;
      const home = plateFor(b.key, compact);
      if (!home) continue;
      out.push({ plate: shifted(home, b.x, b.y), column: b.column, compact, chosen: columns[b.column].chosen === b.key, count: holds(map, b.key) });
    }
    return out;
  }, [columns, sizes, scrollOf, plateFor, map]);

  // ---- The pointer, the keyboard's ring and a tap's selection ----
  const hover = useRef<string | null>(null);
  const ring = useRef<string | null>(null);
  const ctx = useRef<CanvasRenderingContext2D | null | undefined>(undefined);
  const tap = useRef<ReturnType<typeof useTapToOpen> | null>(null);
  const lastFrame = useRef<Drawn[] | null>(null);
  lastFrame.current = null;
  // The live marks: each record's on its box in view; a removed record's ghost where its box was last drawn.
  const placeOf = useCallback((id: string) => {
    const d = lastFrame.current?.find((x) => x.plate.id === id);
    return d ? { x: d.plate.x, y: d.plate.y, w: d.plate.w, h: d.plate.h } : null;
  }, []);
  const marks = useStageMarks(placeOf);

  paintRef.current = () => {
    const s = sizeRef.current;
    if (!s) return;
    const frame = frameAt(view.current, s);
    lastFrame.current = frame;
    if (ctx.current === undefined) ctx.current = canvas.current?.getContext('2d') ?? null;
    const g = ctx.current;
    if (!g) return;
    const faded = tween.now();
    const live = marks.at(performance.now());
    const state: PaintState = { focus, hover: hover.current, ring: ring.current, armed: tap.current?.armed ?? null, lit: null, litLines: null, spot: 0, strength: faded.at, marks: live, open: NO_CUT };
    const v = view.current;
    const cam: Camera = { cx: (s.w / 2 - v.x) / v.zoom, cy: (s.h / 2 - v.y) / v.zoom, zoom: v.zoom, w: s.w, h: s.h };
    paint(g, dpr, cam, { plates: frame.map((d) => d.plate), bars: [], lines: [] }, look.current, fonts, state);
    paintPath(g, frame, v, look.current, fonts, faded.at, focus);
    // The leader line to the wiki card (LA-V96-R24), from the focus's box in view, in its outline's color.
    const own = map.nodes.get(at)?.id === focus ? frame.find((d) => d.plate.place === at)?.plate : undefined;
    const box = (p: Plate) => ({ left: p.x * v.zoom + v.x, top: p.y * v.zoom + v.y, right: (p.x + p.w) * v.zoom + v.x, bottom: (p.y + p.h) * v.zoom + v.y });
    if (wrapper.current) drawLeaderLine(g, {
      host: wrapper.current, space, dpr, color: own ? boxColors(look.current, own).edge : look.current.ink,
      box: own ? box(own) : null,
    });
    if (!faded.done || marksMoving(live, frame.map((d) => d.plate.id))) requestPaint();
  };
  useEffect(() => { requestPaint(); });
  useLeaderFollow(wrapper, space, () => paintRef.current());

  const canOpen = useCallback((id: string) => id !== focus && index.byId.has(id), [focus, index]);
  const tapped = useRef<Plate | null>(null);
  const openFrom = useCallback((id: string) => {
    const n = tapped.current ? map.nodes.get(tapped.current.place) : undefined;
    const own = !n ? undefined : n.id === id ? n.key : copyInChain(map, id, n.chain);
    onNavigate(id, own);
  }, [map, onNavigate]);
  const tapToOpen = useTapToOpen(openFrom, canOpen, wrapper, focus, onOpenNew);
  tap.current = tapToOpen;
  useEffect(() => { onPeek?.('selected', tapToOpen.armed); requestPaint(); }, [tapToOpen.armed, onPeek]);

  // The keyboard's ring: the node the table's focused link or the walk stands for, its column scrolled to show it.
  useEffect(() => {
    ring.current = ringAt ? map.nodes.get(ringAt)?.id ?? null : null;
    const parent = ringAt ? map.tree.get(ringAt)?.parent : null;
    const i = parent ? columns.findIndex((x) => x.parent === parent) : -1;
    const c = columns[i];
    if (c && ringAt) scrolls.current.set(c.parent, scrollToShow(c.keys.length, c.keys.indexOf(ringAt), viewHeight(), scrollOf(c, sizes[i]), sizes[i].h));
    requestPaint();
  }, [ringAt, columns, sizes]);

  const hitAt = useCallback((x: number, y: number): Plate | null => {
    const v = view.current;
    const s = sizeRef.current;
    if (!s) return null;
    const frame = lastFrame.current ?? frameAt(v, s);
    return hitPlate(frame.map((d) => d.plate), { x: (x - v.x) / v.zoom, y: (y - v.y) / v.zoom });
  }, [frameAt]);
  const setHover = (hit: Plate | null) => {
    const id = hit?.id ?? null;
    if (hover.current === id) return;
    hover.current = id;
    const c = canvas.current;
    const opens = hit ? map.nodes.get(hit.place)?.opens : null;
    if (c) {
      c.style.cursor = opens && canOpen(opens) ? 'pointer' : '';
      c.title = hit ? (hit.kind === 'file' || hit.kind === 'outside' || hit.kind === GAP_KIND ? `${hit.title} (${hit.meta})` : plateTip(hit)) : '';
    }
    onPeek?.('hover', id && index.byId.has(id) ? id : null);
    requestPaint();
  };

  // A column taller than the stage scrolls on its own under a wheel that pans down it, before the camera's own wheel
  // (gestures.ts) sees it; scroll across, over the gaps or over a column that fits pans the camera, and a wheel that
  // zooms (wheelMove, with the person's Scroll to zoom) zooms it.
  const readWheel = useWheelMove();
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const latch = wheelLatch();
    const onWheel = (e: WheelEvent) => {
      const c0 = canvas.current;
      if (!c0 || e.target !== c0) return;
      const move = readWheel(e, sizeRef.current);
      if (latch({ zoom: 'zoom' in move, deltaX: e.deltaX, deltaY: e.deltaY }, e.timeStamp) === 'drop' || 'zoom' in move) return;
      if (Math.abs(move.dy) < Math.abs(move.dx)) return;
      const v = view.current;
      const r = c0.getBoundingClientRect();
      const x = (e.clientX - r.left - v.x) / v.zoom;
      const now = columnsRef.current;
      const i = now.lefts.findIndex((l, j) => x >= l && x <= l + now.sizes[j].w);
      const c = now.columns[i];
      if (!c) return;
      const size = now.sizes[i];
      const h = viewHeight();
      if (columnHeight(c.keys.length, size.h) <= h) return;
      e.preventDefault();
      e.stopPropagation();
      scrolls.current.set(c.parent, clampScroll(scrollOf(c, size) + move.dy / v.zoom, c.keys.length, h, size.h));
      requestPaint();
    };
    el.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [viewHeight, scrollOf, requestPaint, readWheel]);

  const zoomButton = (factor: number) => () => {
    if (!size) return;
    const box = frameBox(size);
    gestures.zoomBy(box.x + box.w / 2, box.y + box.h / 2, factor);
  };
  /** The camera's Fit: every column, its whole height, in the frame. */
  const fitAll = () => {
    if (!size) return;
    const box = frameBox(size);
    const width = lefts[columns.length - 1] + sizes[columns.length - 1].w;
    const height = Math.max(BOX_HEIGHT, ...columns.map((c, i) => columnHeight(c.keys.length, sizes[i].h)));
    const zoom = Math.max(MIN_ZOOM, Math.min(1, (box.w - 2 * COLUMNS_PAD) / width, (box.h - 2 * COLUMNS_PAD) / height));
    scrolls.current = new Map();
    moveTo({ x: box.x + COLUMNS_PAD, y: box.y + COLUMNS_PAD, zoom }, true);
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
      const strength = tween.now().at;
      return {
        camera: { ...v },
        canvas: { left: r.left, top: r.top, width: s.w, height: s.h },
        bars: 0,
        lines: [],
        columns: columns.map((c, i) => ({ parent: c.parent, compact: sizes[i].compact, scroll: scrollOf(c, sizes[i]), height: columnHeight(c.keys.length, sizes[i].h) })),
        boxes: frameAt(v, s, whole).map(({ plate: p, column, compact, chosen, count }) => {
          const n = map.nodes.get(p.place)!;
          return {
            key: p.place, id: p.id, role: n.role, parent: map.tree.get(p.place)?.parent ?? null, opens: n.opens, focus: p.id === focus, hover: hover.current === p.id, ring: ring.current === p.id,
            lit: null, strength: strength(p.place), change: ((m) => (m && m.change !== 'removed' ? m.change : null))(changes.live.get(p.id)),
            dashed: p.dashed, kind: p.kind, stage: p.stage, meta: p.lines.filter((l) => l.face === 'meta').map((l) => l.text).join(''), name: plateName(p, p.id === focus), textScale: p.text,
            rect: { left: r.left + p.x * v.zoom + v.x, top: r.top + p.y * v.zoom + v.y, width: p.w * v.zoom, height: p.h * v.zoom },
            column, compact, chosen, count,
          };
        }),
      };
    };
  });

  const armedKey = tapToOpen.armed ? map.copies.get(tapToOpen.armed)?.[0] : undefined;
  const armedPlate = armedKey ? plateFor(armedKey, false) : null;
  return (
    <div ref={wrapper} className="graph-flow trace-flow" data-layout="columns" data-ready={size ? 'true' : undefined}>
      <canvas
        ref={canvas}
        className="graph-canvas-draw"
        aria-hidden="true"
        {...gestures.handlers}
        onAuxClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const hit = hitAt(e.clientX - r.left, e.clientY - r.top);
          const opens = hit ? map.nodes.get(hit.place)?.opens : null;
          if (opens) tapToOpen.onNodeAuxClick(e, opens);
        }}
        onPointerLeave={(e) => { if (!gestures.pressed(e.pointerId)) setHover(null); }}
      />
      <StageCamera onZoomIn={zoomButton(ZOOM_STEP)} onZoomOut={zoomButton(1 / ZOOM_STEP)} onFit={fitAll} />
      {armedPlate && <TapCard kind={armedPlate.kindLabel} name={armedPlate.title} onOpen={tapToOpen.openArmed} onDismiss={tapToOpen.clear} />}
    </div>
  );
}

/**
 * Over the boxes the renderer drew: each chosen box ringed (the focus keeps its own ring) and joined to the column it
 * opens by a bracket in the gap, a stub to each of its children in view; and each box's count of what it holds.
 */
function paintPath(g: CanvasRenderingContext2D, frame: readonly Drawn[], v: Viewport, look: Look, fonts: GraphFonts, strength: (place: string) => number, focus: string) {
  const X = (x: number) => x * v.zoom + v.x;
  const Y = (y: number) => y * v.zoom + v.y;
  const z = v.zoom;
  g.save();
  for (const d of frame) {
    if (!d.chosen) continue;
    const p = d.plate;
    if (d.count > 0) {
    const children = frame.filter((c) => c.column === d.column + 1);
    // The bracket: from the chosen box's right to the middle of the gap, down (or up) the column it opens, a stub into each child.
    g.globalAlpha = 0.6 * strength(p.place);
    g.strokeStyle = look.ink;
    g.lineWidth = Math.max(1, 1.5 * z);
    const mid = p.y + p.h / 2;
    const gapX = p.x + p.w + COLUMN_GAP / 2;
    const ys = [mid, ...children.map((c) => c.plate.y + c.plate.h / 2)];
    g.beginPath();
    g.moveTo(X(p.x + p.w), Y(mid));
    g.lineTo(X(gapX), Y(mid));
    g.moveTo(X(gapX), Y(Math.min(...ys)));
    g.lineTo(X(gapX), Y(Math.max(...ys)));
    for (const c of children) { const y = c.plate.y + c.plate.h / 2; g.moveTo(X(gapX), Y(y)); g.lineTo(X(c.plate.x), Y(y)); }
    g.stroke();
    }
    if (p.id === focus) continue;
    g.globalAlpha = strength(p.place);
    g.strokeStyle = look.steel;
    g.lineWidth = Math.max(1.5, CHOSEN_RING * z);
    g.beginPath();
    const grow = 3 * z + g.lineWidth / 2;
    g.roundRect(X(p.x) - grow, Y(p.y) - grow, p.w * z + 2 * grow, p.h * z + 2 * grow, 6 * z);
    g.stroke();
  }
  // The counts of the full columns' boxes, at the right of the middle, inside the shape's straight part (clear of a
  // chevron's point or a hexagon's side), in the kind and ID line's face.
  const px = COUNT_FONT * z;
  if (px >= 4) {
    g.font = fontFor(fonts, 'meta', px);
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (const d of frame) {
      if (d.count === 0 || d.compact) continue;
      const p = d.plate;
      const mid = p.y + p.h / 2;
      const inset = Math.max(outlineInset(p, p.shape, p.scale, mid - COUNT_FONT, 'right'), outlineInset(p, p.shape, p.scale, mid + COUNT_FONT, 'right'));
      g.globalAlpha = strength(p.place);
      g.fillStyle = look.muted;
      g.fillText(String(d.count), X(p.x + p.w - inset - (SHAPES[p.shape].room.r + COUNT_PAD) * p.text), Y(mid));
    }
  }
  g.restore();
}
