// The Trace stage drawn on the canvas (LA-V98): the product's tree (tree.ts) drawn as the Graph's Tree is, by the
// graph's renderer (paint.ts, plate.ts), camera (camera.ts), level of detail and pointer.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { CHILD_READ_PX, drawnFor, frameOnMap, frameRect, maxZoomFor, MIN_ZOOM, type Viewport } from '../graph/camera';
import { labelStrip } from '../graph/sticky';
import { fadeTween, faintest, type FadeLook } from '../graph/fade';
import { pageMeasure, readGraphFonts, readyMeasure, type GraphFonts } from '../graph/fonts';
import { hitPlate } from '../graph/hit';
import { PLAIN_LOOK, readLook, useThemeVersion, type Look } from '../graph/look';
import { parentLine } from '../graph/map';
import { readMotion } from '../graph/motion';
import { followBox, useMorph } from '../graph/morph';
import { boxColors, GAP_KIND, paint, type Bar, type Camera, type Line, type PaintState } from '../graph/paint';
import { plateName, plateOf, plateTip, type Plate, type PlainBox } from '../graph/plate';
import { setTextMeasure, type TextMeasure } from '../graph/text';
import { TapCard, useTapToOpen } from '../graph/touch';
import { keepCamera } from '../exploring/tab-set/commands/keep-camera';
import { keptCamera } from '../exploring/tab-set/reads';
import { runTabSetCommand } from '../exploring/tab-set/run';
import { useCameraGestures } from '../graph/gestures';
import { useCommand } from '../shell/commands';
import { StageCamera, ZOOM_STEP } from '../views/StageChrome';
import { useOpenSpace, type Insets, type OpenSpaceStore } from '../views/openSpace';
import { drawLeaderLine, openIn, useLeaderFollow } from '../views/leaderLine';
import { copyInChain, lineKey, linesAt, traceFade, traceInput, type TraceMap, type TraceNode } from './tree';
import { useLaidOut } from '../graph/layout';
import type { GraphMap } from '../graph/map';
import { useChanges } from '../changes/changes';
import { highlightFade, marksMoving, useStageMarks } from '../changes/marks';

// The product's one tree, laid out once (LA-PAT-APP-UX-R19): focusing a record glides the camera to frame its node and
// its children, as the Graph's Tree frames a focus at depth 1, and fades what is not under it; Gaps only fades the
// complete branches. No box ever moves. Every frame draws what the camera shows, as the Graph's Tree does: the boxes in
// view, each in its kind's shape and its stage's colors with its label, a parent's line to each child (an arrow where it
// is a link of a chain); a run of children too small to see is a bar, and past the budget a level is bars. A record
// repeated in several chains shares its ID across its copies: the focus is drawn on every copy, and hovering one, or
// focusing it from the keyboard, lights every copy and their lines.
//
// The canvas is hidden from assistive technology: the Trace stage's table (TraceView.tsx) is its accessible layer,
// visually hidden on a wide screen. Its links carry keyboard focus, and the box a link stands for gets the drawn focus
// ring, the camera bringing it into view (`ring`).

/** The kinds and names of the nodes that are no record. */
const PLAIN: Record<Exclude<TraceNode['role'], 'record'>, { kind: string; label: string; dashed: boolean }> = {
  file: { kind: 'file', label: 'File', dashed: false },
  gap: { kind: GAP_KIND, label: 'Gap', dashed: true },
  outside: { kind: 'outside', label: 'Branch', dashed: false },
  untraced: { kind: GAP_KIND, label: 'Untraced', dashed: true },
};

/** The depth the camera frames below the focus: its children, as the Graph's Tree by default. */
const FRAME_DEPTH = 1;
/** How tall the map's smallest box may be drawn on screen at the most zoom, in CSS pixels: the zoom's ceiling. */
const NO_INSETS: Insets = { left: 0, top: 0, right: 0, bottom: 0 };
const MIN_FRAME = 120;

/** One drawn box as the test hook reports it, in the page's pixels. */
export interface TraceSceneBox { key: string; id: string; role: TraceNode['role']; parent: string | null; opens: string | null; focus: boolean; hover: boolean; ring: boolean; lit: boolean | null; strength: number; change: 'added' | 'changed' | null; dashed: boolean; kind: string; stage: string; meta: string; name: string; textScale: number; rect: { left: number; top: number; width: number; height: number } }
/** What the canvas draws now (LA-PAT-APP-UX-R12): its camera, boxes, bars and lines; or, `whole`, every box and line of the map. */
export interface TraceScene {
  camera: Viewport;
  canvas: { left: number; top: number; width: number; height: number };
  boxes: TraceSceneBox[];
  bars: number;
  lines: { key: string; source: string; target: string; link: boolean; lit: boolean | null }[];
}
/** The canvas's element, with the hooks the tests read the drawn scene and hit-test through. */
export type TraceHost = HTMLDivElement & { traceScene?: (whole?: boolean) => TraceScene; traceHit?: (clientX: number, clientY: number) => string | null };

export interface TraceCanvasProps {
  index: RecordIndex;
  focus: string;
  map: TraceMap;
  /** The node the focus stands on (tree.ts focusKey): what the camera frames. */
  at: string;
  /** The keys kept at full strength (tree.ts keptFor): null for all. */
  kept: ReadonlySet<string> | null;
  /** Gaps only: the complete branches faded back. */
  gapsOnly: boolean;
  /** Opens a record, with the node it was opened from. */
  onNavigate: (id: string, at?: string) => void;
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  space?: OpenSpaceStore;
  /** The node the keyboard is on (the table's focused link, or the walk's node that is no record), drawn with the focus ring and brought into view; null for none. */
  ring: string | null;
  /** The place shown (the Tab set's cameras, exploring/tab-set), whose camera is kept and taken back. */
  cameraKey?: string;
  /** Opens a record in a new place, when the host has places. */
  onOpenNew?: (id: string, background: boolean) => void;
}

/** The canvas, once the label's faces have loaded and the text measure is ready (graph/fonts.ts). */
export function TraceCanvas(props: TraceCanvasProps) {
  const theme = useThemeVersion();
  const fonts = useMemo<GraphFonts>(() => readGraphFonts(), [theme]);
  const [measure, setMeasure] = useState<TextMeasure | null>(() => { void pageMeasure(fonts); return readyMeasure(fonts); });
  useEffect(() => {
    let live = true;
    void pageMeasure(fonts).then((m) => { if (live) setMeasure(m); });
    return () => { live = false; };
  }, [fonts.body, fonts.mono]);
  if (!measure) return <div className="graph-flow trace-flow" aria-busy="true" />;
  setTextMeasure(measure);
  return <TraceLaidOut {...props} measure={measure} fonts={fonts} theme={theme} />;
}

/**
 * The map's boxes, laid out off the main thread as the Graph's Tree map, and again only when what it reads changes
 * (graph/layout.ts); until a new layout is ready, the one before stays on screen with the Trace map it was laid out from.
 */
function TraceLaidOut(props: TraceCanvasProps & { measure: TextMeasure; fonts: GraphFonts; theme: number }) {
  const { map, index, measure, fonts } = props;
  const input = useMemo(() => traceInput(map, index, measure.key), [map, index, measure]);
  const laid = useLaidOut<GraphMap, { map: TraceMap; index: RecordIndex }>(input, useMemo(() => ({ map, index }), [map, index]), fonts);
  if (!laid) return <div className="graph-flow trace-flow" aria-busy="true" />;
  return <TraceScene {...props} map={laid.of.map} index={laid.of.index} laid={laid.map} />;
}

/** What one frame draws: the nodes in view as plates, bars for the runs too small to see, and the lines between the plates. */
interface TraceFrame { plates: Plate[]; bars: Bar[]; lines: Line[] }

function TraceScene({ index, focus, map, laid, at, kept, gapsOnly, onNavigate, onPeek, space, ring: ringAt, cameraKey, onOpenNew, fonts, theme }: TraceCanvasProps & { measure: TextMeasure; fonts: GraphFonts; theme: number; laid: GraphMap }) {
  const wrapper = useRef<TraceHost>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  /** The most the camera zooms in: enough to read the map's smallest box. */
  const maxZoom = useMemo(() => maxZoomFor(laid), [laid]);
  /** What a new layout moved glides from where it was (graph/morph.ts, LA-PAT-APP-UX-R22). */
  const morph = useMorph(laid);

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
  // The camera's glide, zoom and pointer, as the graph's (graph/gestures.ts).
  const gestures = useCameraGestures({
    canvas,
    size,
    getViewport,
    setViewport,
    zoom: { min: MIN_ZOOM, max: maxZoom },
    onHover: (x, y) => setHover(hitAt(x, y)),
    onTap: (x, y, e) => { const hit = hitAt(x, y); tapped.current = hit; const opens = hit ? map.nodes.get(hit.place)?.opens : null; if (opens) tapToOpen.onNodeClick(e, opens); else tapToOpen.clear(); },
  });
  const { moveTo } = gestures;

  // The frame: the open space less the stage's tools (openSpace.ts).
  const open = useOpenSpace(space);
  const inset: Insets = open?.frame ?? NO_INSETS;
  const insetKey = `${inset.left} ${inset.top} ${inset.right} ${inset.bottom}`;
  const frameBox = useCallback((s: { w: number; h: number }) => {
    const w = s.w - inset.left - inset.right;
    const h = s.h - inset.top - inset.bottom;
    return w < MIN_FRAME || h < MIN_FRAME ? { x: 0, y: 0, w: s.w, h: s.h } : { x: inset.left, y: inset.top, w, h };
  }, [insetKey]);

  /** The plates (made below, once per map), for the framing. */
  const platesRef = useRef<(key: string) => Plate | null>(() => null);
  /** The camera that frames the focus's node and its children, as the Graph's Tree frames a focus (camera.ts frameOnMap). */
  const framing = useCallback((): Viewport | null => {
    // A node the map shown does not hold yet (its new layout is still being made) leaves the camera where it is.
    if (!size || (space && !open) || !laid.nodes.has(at)) return null;
    const box = frameBox(size);
    // Framed as a strip beside its children, the focus's strip is as wide as its label needs to read (camera.ts frameOnMap).
    const plate = platesRef.current(at);
    const v = frameOnMap(laid, at, FRAME_DEPTH, box.w, box.h, maxZoom, plate ? labelStrip(plate, box.h, CHILD_READ_PX) : undefined);
    return { x: v.x + box.x, y: v.y + box.y, zoom: v.zoom };
  }, [size, map, laid, at, frameBox, space, open, maxZoom]);

  // Frame the focus whenever its node, the stage's size or the open space changes: a glide, except the first picture (a
  // stage switch lands on the focus at once) and a resize. New data with the same focus leaves the camera where it is, or
  // glides it with the focus's box where the new layout moved that (LA-PAT-APP-UX-R22).
  type Framed = { w: number; h: number; at: string; focus: string; map: TraceMap; box: { x: number; y: number; w: number; h: number } | null };
  const framed = useRef<Framed | null>(null);
  const boxOf = (key: string) => { const n = laid.nodes.get(key); return n ? { x: n.x, y: n.y, w: n.w, h: n.h } : null; };
  /** How long the glide to a new focus takes, for the fade to follow it. */
  const glideMs = useRef<number | null>(null);

  // Each place keeps its camera (the Tab set's cameras, exploring/tab-set): as the place shown changes (another tab), the one left keeps where
  // its camera was, and the one shown takes its own back, at once, when it still frames the same node.
  const framedNow = `${focus} ${at}`;
  const cameraPlace = useRef<{ key: string | undefined; framed: string }>({ key: cameraKey, framed: framedNow });
  /** A kept camera waiting for the stage's first measure; and the framing a camera taken back stands in for. */
  const keptView = useRef<Viewport | null>(cameraKey ? keptCamera<Viewport>(cameraKey, 'trace', framedNow) : null);
  const skipFraming = useRef<unknown>(null);
  useLayoutEffect(() => {
    const was = cameraPlace.current;
    if (was.key === cameraKey) { cameraPlace.current = { key: cameraKey, framed: framedNow }; return; }
    if (was.key && sizeRef.current) runTabSetCommand(keepCamera, { place: was.key, stage: 'trace', camera: { framed: was.framed, view: view.current } });
    cameraPlace.current = { key: cameraKey, framed: framedNow };
    const back = cameraKey ? keptCamera<Viewport>(cameraKey, 'trace', framedNow) : null;
    if (back && size) {
      moveTo(back, false);
      framed.current = { w: size.w, h: size.h, at, focus, map, box: boxOf(at) };
      skipFraming.current = framing;
    } else keptView.current = back;
  });
  useEffect(() => () => {
    const { key, framed: what } = cameraPlace.current;
    if (key && sizeRef.current) runTabSetCommand(keepCamera, { place: key, stage: 'trace', camera: { framed: what, view: view.current } });
  }, []);
  useLayoutEffect(() => {
    if (skipFraming.current === framing) { skipFraming.current = null; return; }
    const kept = keptView.current;
    const target = kept ?? framing();
    if (!target || !size || (kept && !framing())) return;
    keptView.current = null;
    const was = framed.current;
    const box = boxOf(at);
    framed.current = { w: size.w, h: size.h, at, focus, map, box };
    const resized = was !== null && (was.w !== size.w || was.h !== size.h);
    if (was && !resized && was.focus === focus && was.map !== map) {
      const follow = was.at === at && was.box && box ? followBox(view.current, was.box, box, { min: MIN_ZOOM, max: maxZoom }) : null;
      if (follow) moveTo(follow, true);
      return;
    }
    const ms = moveTo(target, !kept && was !== null && !resized);
    if (!was || was.at !== at) glideMs.current = ms;
  }, [framing]);
  const frameFocus = useCallback(() => { const t = framing(); if (t) moveTo(t, true); }, [framing, moveTo]);
  // `.` frames the focus again, as on the graph: one command, whichever stage is drawn.
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

  // ---- The look, the fade and the plates (made when first drawn, once per map) ----
  const look = useRef<Look>(PLAIN_LOOK);
  useLayoutEffect(() => { if (wrapper.current) look.current = readLook(wrapper.current); requestPaint(); }, [theme]);
  /** The look's fade strength, read when drawn, so a theme change takes effect without a new fade. */
  const fadeLook = useMemo<Pick<FadeLook, 'focusFade'>>(() => ({ get focusFade() { return look.current.focusFade; } }), []);
  // What the focus and Gaps only keep at full strength, the rest faded (fade.ts): eased in over the glide to a new focus,
  // or the spotlight's fade for the filter. With Highlight changes on, what changed from its baseline is kept in place of
  // the focus's branch (changes/marks.ts).
  const changes = useChanges();
  const fade = useMemo(() => (changes.highlight
    ? faintest(traceFade(map, null, gapsOnly, fadeLook), highlightFade(changes.byId, (place) => map.nodes.get(place)?.id ?? place))
    : traceFade(map, kept, gapsOnly, fadeLook)), [map, kept, gapsOnly, fadeLook, changes.highlight, changes.byId]);
  // The live marks: each record's on every copy; a removed record's ghost on its first copy in the map drawn before.
  const placeOf = useCallback((id: string) => { const k = map.copies.get(id)?.[0]; const n = k ? laid.nodes.get(k) : undefined; return n ? { x: n.x, y: n.y, w: n.w, h: n.h } : null; }, [map, laid]);
  const tree = useMemo(() => ({ nodes: map.tree, idOf: (place: string) => map.nodes.get(place)?.id ?? place, placeOfId: (id: string) => map.copies.get(id)?.[0] ?? null }), [map]);
  const marks = useStageMarks(placeOf, tree);
  const tween = useMemo(() => fadeTween((t) => readMotion().ease(t)), []);
  useLayoutEffect(() => {
    tween.send(fade, glideMs.current ?? look.current.fade);
    glideMs.current = null;
    requestPaint();
  }, [fade]);

  const plates = useMemo(() => new Map<string, Plate>(), [map, laid, index, fonts]);
  const plateFor = useCallback((key: string): Plate | null => {
    const known = plates.get(key);
    if (known) return known;
    const n = map.nodes.get(key);
    const node = laid.nodes.get(key);
    if (!n || !node) return null;
    const role = n.role === 'record' ? null : PLAIN[n.role];
    const plain: PlainBox | undefined = role ? {
      kind: role.kind, kindLabel: role.label, title: n.words!.title, meta: n.words!.meta, dashed: role.dashed, stage: 'structural',
    } : undefined;
    const plate = plateOf(index, n.id, { view: 'tree', node, place: key, plain });
    plates.set(key, plate);
    return plate;
  }, [plates, map, index]);
  platesRef.current = plateFor;

  /** What a camera shows (camera.ts drawnFor, as the Graph's Tree): the nodes in view as plates, the runs too small as bars, and each drawn child's line from its drawn parent. */
  const frameAt = useCallback((v: Viewport, s: { w: number; h: number }, whole = false): TraceFrame => {
    const keys = whole ? [...laid.nodes.keys()] : null;
    const drawn = keys ? { boxes: keys.map((id) => ({ id })), bars: [] } : drawnFor(laid, v, s.w, s.h, [at]);
    const now = performance.now();
    const shown = drawn.boxes.map((b) => plateFor(b.id)).filter((p): p is Plate => p !== null).map((p) => morph.plate(p, now));
    const byKey = new Map(shown.map((p) => [p.place, p]));
    const lines: Line[] = [];
    for (const b of shown) {
      const up = laid.nodes.get(b.place)?.parent;
      const p = up ? byKey.get(up) : undefined;
      if (!p) continue;
      const link = map.links.has(b.place);
      lines.push({ id: lineKey(p.place, b.place), source: p.place, target: b.place, style: link ? 'trace' : 'structure', link, points: parentLine(p, b, p.shape, b.shape), scale: b.text });
    }
    return { plates: shown, bars: drawn.bars.map((b) => ({ parent: b.parent, x: b.x, y: b.y, w: b.w, h: b.h })), lines };
  }, [map, laid, plateFor, at]);

  // ---- The spotlight, the pointer, the keyboard's ring and a tap's selection ----
  const hover = useRef<string | null>(null);
  const ring = useRef<string | null>(null);
  const spotlight = useRef<{ id: string | null; lit: Set<string> | null; litLines: Set<string> | null; from: number; to: number; start: number }>({ id: null, lit: null, litLines: null, from: 0, to: 0, start: 0 });
  const spotNow = () => {
    const s = spotlight.current;
    const ms = look.current.fade;
    const t = ms > 0 ? Math.min(1, (performance.now() - s.start) / ms) : 1;
    return { value: s.from + (s.to - s.from) * t, done: t >= 1 };
  };
  const ctx = useRef<CanvasRenderingContext2D | null | undefined>(undefined);
  const tap = useRef<ReturnType<typeof useTapToOpen> | null>(null);
  const lastFrame = useRef<TraceFrame | null>(null);
  lastFrame.current = null;

  paintRef.current = () => {
    const s = sizeRef.current;
    if (!s) return;
    const frame = frameAt(view.current, s);
    lastFrame.current = frame;
    if (ctx.current === undefined) ctx.current = canvas.current?.getContext('2d') ?? null;
    if (!ctx.current) return;
    const spot = spotNow();
    const sp = spotlight.current;
    const faded = tween.now();
    const live = marks.at(performance.now());
    const state: PaintState = { focus, hover: hover.current, ring: ring.current, armed: tap.current?.armed ?? null, lit: sp.lit, litLines: sp.litLines, spot: spot.value, strength: faded.at, marks: live, open: openIn(wrapper.current, space, s.w, s.h) };
    const v = view.current;
    const cam: Camera = { cx: (s.w / 2 - v.x) / v.zoom, cy: (s.h / 2 - v.y) / v.zoom, zoom: v.zoom, w: s.w, h: s.h };
    paint(ctx.current, dpr, cam, frame, look.current, fonts, state);
    // The leader line to the wiki card (LA-V96-R24), under this camera, from the focus's node in its outline's color.
    const n = map.nodes.get(at)?.id === focus ? laid.nodes.get(at) : undefined;
    const p = n ? plateFor(at) : null;
    if (wrapper.current) drawLeaderLine(ctx.current, {
      host: wrapper.current, space, dpr, color: p ? boxColors(look.current, p).edge : look.current.ink,
      box: n ? { left: n.x * v.zoom + v.x, top: n.y * v.zoom + v.y, right: (n.x + n.w) * v.zoom + v.x, bottom: (n.y + n.h) * v.zoom + v.y } : null,
    });
    if (!spot.done || !faded.done || morph.moving(performance.now()) || marksMoving(live, frame.plates.map((x) => x.id))) requestPaint();
    else if (sp.to === 0 && sp.lit) { sp.lit = null; sp.litLines = null; }
  };
  useEffect(() => { requestPaint(); });
  // The wiki card moving without the camera draws its leader line again in the same frame.
  useLeaderFollow(wrapper, space, () => paintRef.current());

  /** Lights a record's every copy, the lines touching them and the nodes at their other ends; null lets go. */
  const spot = useCallback((id: string | null) => {
    onPeek?.('hover', id && index.byId.has(id) ? id : null);
    const s = spotlight.current;
    const value = spotNow().value;
    if (id === null) {
      if (s.id !== null) { spotlight.current = { ...s, id: null, from: value, to: 0, start: performance.now() }; requestPaint(); }
      return;
    }
    if (s.id === id) return;
    const copies = map.copies.get(id) ?? [];
    const lit = new Set(copies);
    const litLines = new Set<string>();
    for (const line of linesAt(map, copies)) { lit.add(line.from); lit.add(line.to); litLines.add(line.key); }
    spotlight.current = { id, lit, litLines, from: s.id === null ? value : 1, to: 1, start: performance.now() };
    requestPaint();
  }, [map, index, onPeek, requestPaint]);
  useEffect(() => () => spot(null), [focus, map]);

  const canOpen = useCallback((id: string) => id !== focus && index.byId.has(id), [focus, index]);
  /** The plate a tap was on, so opening its record keeps its place: a record's own node, a file's naming record in its chain. */
  const tapped = useRef<Plate | null>(null);
  const openFrom = useCallback((id: string) => {
    const n = tapped.current ? map.nodes.get(tapped.current.place) : undefined;
    const own = !n ? undefined : n.id === id ? n.key : copyInChain(map, id, n.chain);
    onNavigate(id, own);
  }, [map, onNavigate]);
  const tapToOpen = useTapToOpen(openFrom, canOpen, wrapper, focus, onOpenNew);
  tap.current = tapToOpen;
  useEffect(() => { onPeek?.('selected', tapToOpen.armed); requestPaint(); }, [tapToOpen.armed, onPeek]);

  // The keyboard's ring: the node the table's focused link or the walk stands for, framed when it is not wholly in view (a
  // focus's frame keeps its children reading, camera.ts frameOnMap).
  useEffect(() => {
    const id = ringAt ? map.nodes.get(ringAt)?.id ?? null : null;
    ring.current = id;
    spot(id);
    requestPaint();
    const s = sizeRef.current;
    const n = ringAt ? laid.nodes.get(ringAt) : undefined;
    if (!n || !s) return;
    const v = view.current;
    const frame = frameBox(s);
    const left = n.x * v.zoom + v.x;
    const top = n.y * v.zoom + v.y;
    const inside = left >= frame.x && left + n.w * v.zoom <= frame.x + frame.w && top >= frame.y && top + n.h * v.zoom <= frame.y + frame.h;
    if (inside) return;
    const t = frameOnMap(laid, ringAt!, 0, frame.w, frame.h, maxZoom);
    moveTo({ x: t.x + frame.x, y: t.y + frame.y, zoom: t.zoom }, true);
  }, [ringAt]);

  // ---- The pointer: hover and click (drag, wheel and pinch are graph/gestures.ts's) ----
  const hitAt = useCallback((x: number, y: number): Plate | null => {
    const v = view.current;
    const s = sizeRef.current;
    if (!s) return null;
    const frame = lastFrame.current ?? frameAt(v, s);
    return hitPlate(frame.plates, { x: (x - v.x) / v.zoom, y: (y - v.y) / v.zoom });
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
    spot(id);
    requestPaint();
  };
  const zoomButton = (factor: number) => () => {
    if (!size) return;
    const box = frameBox(size);
    gestures.zoomBy(box.x + box.w / 2, box.y + box.h / 2, factor);
  };
  /** The camera's Fit: the whole map in the frame. */
  const fitMap = () => {
    if (!size) return;
    moveTo(frameRect({ x: 0, y: 0, w: laid.width, h: laid.height }, frameBox(size), { pad: 24, read: MIN_ZOOM, max: maxZoom, min: MIN_ZOOM }), true);
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
      const frame = frameAt(v, s, whole);
      const sp = spotlight.current;
      const strength = tween.now().at;
      return {
        camera: { ...v },
        canvas: { left: r.left, top: r.top, width: s.w, height: s.h },
        bars: frame.bars.length,
        lines: frame.lines.map((l) => ({ key: l.id, source: l.source, target: l.target, link: l.link, lit: sp.id !== null && sp.litLines ? sp.litLines.has(l.id) : null })),
        boxes: frame.plates.map((p) => {
          const n = map.nodes.get(p.place)!;
          return {
            key: p.place, id: p.id, role: n.role, parent: laid.nodes.get(p.place)?.parent ?? null, opens: n.opens, focus: p.id === focus, hover: hover.current === p.id, ring: ring.current === p.id,
            lit: sp.id !== null && sp.lit ? sp.lit.has(p.place) : null, strength: strength(p.place), change: ((m) => (m && m.change !== 'removed' ? m.change : null))(changes.live.get(p.id)),
            dashed: p.dashed, kind: p.kind, stage: p.stage, meta: p.lines.filter((l) => l.face === 'meta').map((l) => l.text).join(''), name: plateName(p, p.id === focus), textScale: p.text,
            rect: { left: r.left + p.x * v.zoom + v.x, top: r.top + p.y * v.zoom + v.y, width: p.w * v.zoom, height: p.h * v.zoom },
          };
        }),
      };
    };
  });

  const armedKey = tapToOpen.armed ? map.copies.get(tapToOpen.armed)?.[0] : undefined;
  const armedPlate = armedKey ? plateFor(armedKey) : null;
  return (
    <div ref={wrapper} className="graph-flow trace-flow" data-ready={size ? 'true' : undefined}>
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
      <StageCamera onZoomIn={zoomButton(ZOOM_STEP)} onZoomOut={zoomButton(1 / ZOOM_STEP)} onFit={fitMap} />
      {armedPlate && <TapCard kind={armedPlate.kindLabel} name={armedPlate.title} onOpen={tapToOpen.openArmed} onDismiss={tapToOpen.clear} />}
    </div>
  );
}
