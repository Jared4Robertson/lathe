// The Trace stage drawn on the canvas (LA-V98): the graph's renderer (paint.ts, plate.ts), camera
// (camera.ts) and pointer, over the product's one map lanes.ts lays out.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { SpecIndex } from '../specs/data';
import { Icon } from '../components/icons';
import { Button } from '../components/Button';
import { frameRect, MAX_ZOOM, viewRect, type Viewport } from '../graph/camera';
import { fadeTween, faintest, type FadeLook } from '../graph/fade';
import { fontFor, pageMeasure, readGraphFonts, readyMeasure, type GraphFonts } from '../graph/fonts';
import { hitPlate } from '../graph/hit';
import { PLAIN_LOOK, readLook, useThemeVersion, type Look } from '../graph/look';
import { readMotion } from '../graph/motion';
import { boxColors, GAP_KIND, paint, type Bar, type Camera, type Line, type PaintState } from '../graph/paint';
import { plateName, plateOf, plateTip, type Plate } from '../graph/plate';
import { nodeShape, SHAPES } from '../graph/shapes';
import { BORDER, labelLines, LABEL_PAD, LABEL_PAD_BLOCK, LINE_HEIGHT, META_FONT, setTextMeasure, TITLE_FONT, hasMarks, metaWidth, titleWidth, wrapLabel, wrapText, type TextMeasure, type WrappedLabel } from '../graph/text';
import { TapCard, useTapToOpen } from '../graph/touch';
import { useCameraGestures } from '../graph/gestures';
import { useCommand } from '../shell/commands';
import { Tooltip } from '../shell/Tooltip';
import { useOpenSpace, type Insets, type OpenSpaceStore } from '../views/openSpace';
import { drawLeaderLine, useLeaderFollow } from '../views/leaderLine';
import { BOX_H, BOX_W, LANE_COLUMN_LABELS, lanesIn, traceFade, visibleIn, type TraceBox, type TraceFocus, type TraceLine, type TraceMap } from './lanes';
import type { TraceAt } from './walk';
import { useChanges } from '../changes/changes';
import { lensFade, marksMoving, useStageMarks } from '../changes/marks';

// The product's one map, laid out once (LA-PAT-APP-UX-R19): focusing a record glides the camera to
// frame it (lanes.ts traceFocus) and fades what is not under it; Gaps only fades the complete lanes.
// No box ever moves: the focus's lane, when its columns hold more than they show, is drawn open over
// the lanes below it, on a tray, the lanes it covers left out where it covers them. Every frame draws what the camera shows: the boxes in view, each in its kind's
// shape and its stage's colors with its label, and the arrows between them; further out, where a
// box is too small to read or more boxes are in view than a frame draws, each box is a bar where it
// is; further still, each lane is one bar, so the whole product reads as an overview (each band of lanes under its label). Only what is in
// view is ever drawn (lanes.ts visibleIn, lanesIn), so a product's map draws as fast as a lane. A
// record repeated in several lanes shares its id across its copies: the focus is drawn on every
// copy, and hovering one, or focusing it from the keyboard, lights every copy and their arrows.
//
// The canvas is hidden from assistive technology: the Trace stage's table (TraceView.tsx) is its
// accessible layer, visually hidden on a wide screen. Its links carry keyboard focus, and the box a
// link stands for gets the drawn focus ring, the camera bringing it into view (`ring`).

/** A plain box's kind label: what a box that is no record is. */
const PLAIN_LABELS: Record<Exclude<TraceBox['role'], 'record'>, string> = { file: 'File', gap: 'Gap', untraced: 'Untraced', more: 'More' };

/** The most boxes one frame draws as boxes (LA-PAT-APP-UX-R11); more in view are drawn as bars. */
const TRACE_MAX_DRAWN = 260;
/** A box under this many pixels tall on screen is drawn as a bar. */
const BAR_BELOW_PX = 14;
/** A box under this many pixels tall on screen leaves its lane drawn as one bar. */
const LANE_BAR_BELOW_PX = 4;
/** The least zoom: a large product's whole map in the pane. */
const MIN_ZOOM = 1e-3;
/** The most zoom a frame takes: boxes at their size. */
const FRAME_MAX = 1;
/** The zoom a frame keeps at least while what it frames is only too wide, so its labels read; it then centers on the focus's box. */
const READ_ZOOM = 0.8;
/** The room around an open lane's tray, in map units. */
const TRAY_PAD = 12;
/** A band's label's size on screen, in CSS pixels, from min to max as the zoom grows; a label too long for its room down to least. */
const BAND_FONT = { least: 10, min: 12, max: 22 };
/** A column of lanes narrower than this on screen, in CSS pixels, shows no "continued" label of its band. */
const CONTINUED_LABEL_PX = 120;
/** How far a band's label may run past a narrow column, in CSS pixels, when no other label is in its way. */
const LABEL_RUN_PX = 220;
/** The space kept around the framed rectangle, in screen pixels. */
const PAD = 24;
const ZOOM_STEP = 1.2;
const NO_INSETS: Insets = { left: 0, top: 0, right: 0, bottom: 0 };
const MIN_FRAME = 120;

/** One drawn box as the test hook reports it, in the page's pixels. */
export interface TraceSceneBox { key: string; id: string; role: TraceBox['role']; column: string; lane: number; opens: string | null; focus: boolean; hover: boolean; ring: boolean; lit: boolean | null; strength: number; change: 'added' | 'changed' | null; dashed: boolean; kind: string; stage: string; notes: string[]; name: string; rect: { left: number; top: number; width: number; height: number } }
/** What the canvas draws now (LA-PAT-APP-UX-R12): its camera, boxes, bars and arrows; or, `whole`, every box and arrow of the map as the camera would draw it. */
export interface TraceScene {
  camera: Viewport;
  canvas: { left: number; top: number; width: number; height: number };
  boxes: TraceSceneBox[];
  bars: number;
  lines: { key: string; source: string; target: string; tree: boolean; lit: boolean | null }[];
}
/** The canvas's element, with the hooks the tests read the drawn scene and hit-test through. */
export type TraceHost = HTMLDivElement & { traceScene?: (whole?: boolean) => TraceScene; traceHit?: (clientX: number, clientY: number) => string | null };

export interface TraceCanvasProps {
  index: SpecIndex;
  focus: string;
  map: TraceMap;
  /** Where the focus is on the map (lanes.ts traceFocus): what the camera frames, the lanes kept and the lane drawn open. */
  focused: TraceFocus;
  /** Gaps only: the lanes with no gap faded back. */
  gapsOnly: boolean;
  /** Opens a record, with the box it was opened from (a click on a box keeps its lane). */
  onNavigate: (id: string, at?: TraceAt) => void;
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  space?: OpenSpaceStore;
  /** The box the keyboard is on (the table's focused link, or the arrow keys' box that is no record) and its lane, drawn with the focus ring and brought into view; null for none. */
  ring: { id: string; lane: number | null } | null;
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
  return <TraceScene {...props} measure={measure} fonts={fonts} theme={theme} />;
}

/** A box's label at text scale 1, wrapped to its width and cut to its height: its kind and ID line, its title (the last line kept ending in an ellipsis), its notes. */
export function boxLabel(index: SpecIndex, box: TraceBox): { lines: WrappedLabel; notes: string[]; words: { title: string; meta: string } } {
  const words = box.words ?? labelLines(index, box.id);
  const shape = box.words ? 'box' : nodeShape(index, box.id).shape;
  const wrapped = wrapLabel(words, { shape, marks: box.words ? 0 : nodeShape(index, box.id).mark ? 1 : 0, marked: !box.words && hasMarks(index, box.id), width: box.w });
  const room = SHAPES[shape].room;
  const inner = box.w - 2 * LABEL_PAD - room.l - room.r;
  const metaLine = META_FONT * LINE_HEIGHT;
  const titleLine = TITLE_FONT * LINE_HEIGHT;
  let left = box.h - 2 * (LABEL_PAD_BLOCK + BORDER) - room.t - room.b + 1e-6;
  /** The first `n` of some lines, the last ending in an ellipsis when some are left out. */
  const cut = (lines: readonly string[], n: number, width: (s: string) => number) => {
    const kept = lines.slice(0, Math.max(0, n));
    if (kept.length > 0 && kept.length < lines.length) {
      let last = kept[kept.length - 1].trimEnd();
      while (last.length > 0 && width(`${last}…`) > inner) last = last.slice(0, -1).trimEnd();
      kept[kept.length - 1] = `${last}…`;
    }
    return kept;
  };
  const meta = cut(wrapped.meta, Math.min(1, Math.floor(left / metaLine)), (t) => metaWidth(t));
  left -= meta.length * metaLine;
  // Each note keeps a line at least; the title takes what is left, a line at least; the notes then take the rest.
  const noteLines = box.notes.map((n) => wrapText(n, inner, (t) => metaWidth(t)));
  const titleRoom = Math.max(1, Math.floor((left - noteLines.length * metaLine) / titleLine));
  const title = cut(wrapped.title, Math.min(titleRoom, Math.floor(left / titleLine)), (t) => titleWidth(t));
  left -= title.length * titleLine;
  const notes: string[] = [];
  for (const lines of noteLines) {
    const fit = Math.floor(left / metaLine);
    if (fit <= 0) break;
    const kept = cut(lines, Math.min(fit, lines.length), (t) => metaWidth(t));
    notes.push(...kept);
    left -= kept.length * metaLine;
  }
  return { lines: { title, meta, pad: wrapped.pad }, notes, words };
}

/** A tiny store of the camera, so the parts that follow it (the column names) draw again only when they change. */
function cameraStore() {
  const listeners = new Set<() => void>();
  return {
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
    notify: () => { for (const l of listeners) l(); },
  };
}

/** What one frame draws: the boxes in view as plates, or bars far out, and the arrows between the plates. */
interface TraceFrame { boxes: TraceBox[]; plates: Plate[]; bars: Bar[]; lines: Line[]; traceLines: TraceLine[] }

function TraceScene({ index, focus, map, focused, gapsOnly, onNavigate, onPeek, space, ring: ringAt, fonts, theme }: TraceCanvasProps & { measure: TextMeasure; fonts: GraphFonts; theme: number }) {
  const wrapper = useRef<TraceHost>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

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
  const setViewport = useCallback((v: Viewport) => { view.current = v; requestPaint(); store.notify(); }, [requestPaint, store]);
  const getViewport = useCallback(() => view.current, []);
  // The camera's glide, zoom and pointer, as the graph's (graph/gestures.ts).
  const gestures = useCameraGestures({
    canvas,
    size,
    getViewport,
    setViewport,
    zoom: { min: MIN_ZOOM, max: MAX_ZOOM },
    onHover: (x, y) => setHover(hitAt(x, y)),
    onTap: (x, y, e) => { const hit = hitAt(x, y); tapped.current = hit?.box ?? null; if (hit?.box.opens) tapToOpen.onNodeClick(e, hit.box.opens); else tapToOpen.clear(); },
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

  /** The camera that frames the focus (camera.ts frameRect). */
  const framing = useCallback((): Viewport | null => {
    if (!size || (space && !open)) return null;
    return frameRect(focused.rect, focused.anchor, frameBox(size), { pad: PAD, read: READ_ZOOM, max: FRAME_MAX, min: MIN_ZOOM });
  }, [size, focused, frameBox, space, open]);

  // Frame the focus whenever it, the stage's size or the open space changes: a glide, except the
  // first picture (a stage switch lands on the focus at once) and a resize. New data with the same
  // focus leaves the camera where it is.
  const framed = useRef<{ w: number; h: number; focus: string; map: TraceMap } | null>(null);
  /** How long the glide to a new focus takes, for the fade to follow it. */
  const glideMs = useRef<number | null>(null);
  useLayoutEffect(() => {
    const target = framing();
    if (!target || !size) return;
    const was = framed.current;
    framed.current = { w: size.w, h: size.h, focus, map };
    const resized = was !== null && (was.w !== size.w || was.h !== size.h);
    if (was && !resized && was.focus === focus && was.map !== map) return;
    const ms = moveTo(target, was !== null && !resized);
    if (!was || was.focus !== focus) glideMs.current = ms;
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
    store.notify();
  }, [size, dpr]);

  // ---- The look, the fade and the plates (made when first drawn, once per map) ----
  const look = useRef<Look>(PLAIN_LOOK);
  useLayoutEffect(() => { if (wrapper.current) look.current = readLook(wrapper.current); requestPaint(); }, [theme]);
  /** The look's fade strength, read when drawn, so a theme change takes effect without a new fade. */
  const fadeLook = useMemo<Pick<FadeLook, 'focusFade'>>(() => ({ get focusFade() { return look.current.focusFade; } }), []);
  /** What the focus and Gaps only keep at full strength, the rest faded (fade.ts): eased in over the glide to a new focus, or the spotlight's fade for the filter. */
  // With the Changes lens on, what changed from its baseline is kept in place of the focus's lanes (changes/marks.ts).
  const changes = useChanges();
  const fade = useMemo(() => (changes.lens
    ? faintest(traceFade(map, null, gapsOnly, fadeLook), lensFade(changes.byId, fadeLook, (place) => map.byKey.get(place)?.id ?? place))
    : traceFade(map, focused.lanes, gapsOnly, fadeLook)), [map, focused, gapsOnly, fadeLook, changes.lens, changes.byId]);
  // The live marks: each record's on every copy; a removed record's ghost on its first copy in the map drawn before.
  const placeOf = useCallback((id: string) => { const b = map.copies.get(id)?.[0]; return b ? { x: b.x, y: b.y, w: b.w, h: Math.min(b.h, BOX_H) } : null; }, [map]);
  const marks = useStageMarks(placeOf);
  const tween = useMemo(() => fadeTween((t) => readMotion().ease(t)), []);
  useLayoutEffect(() => {
    tween.send(fade, glideMs.current ?? look.current.fade);
    glideMs.current = null;
    requestPaint();
  }, [fade]);

  const plates = useMemo(() => new Map<string, Plate>(), [map, index, fonts]);
  const plateFor = useCallback((b: TraceBox): Plate => {
    const known = plates.get(b.key);
    if (known) return known;
    const label = boxLabel(index, b);
    const plain = b.role === 'record' ? undefined : {
      kind: b.role === 'gap' || b.role === 'untraced' ? GAP_KIND : b.role, kindLabel: PLAIN_LABELS[b.role],
      title: label.words.title, meta: label.words.meta, stage: 'structural' as const, dashed: b.role === 'gap' || b.role === 'untraced',
    };
    const plate = plateOf(index, b.id, { view: 'trace', place: b.key, node: b, lines: label.lines, notes: label.notes, top: b.h > BOX_H + 1, plain });
    plates.set(b.key, plate);
    return plate;
  }, [plates, index]);

  /** What a camera shows: the boxes in view as plates; bars far out or past the budget; one bar a lane further out. The open lane over its tray. */
  const openLane = focused.open;
  const frameAt = useCallback((v: Viewport, s: { w: number; h: number }, whole = false): TraceFrame => {
    const r = whole ? { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity } : viewRect(v, s.w, s.h);
    const none = { boxes: [] as TraceBox[], plates: [] as Plate[], lines: [] as Line[], traceLines: [] as TraceLine[] };
    const barOf = (b: TraceBox): Bar => ({ parent: b.key, x: b.x, y: b.y, w: b.w, h: b.h });
    const lane = openLane === null ? undefined : map.lanes[openLane];
    const tray: Bar[] = lane?.open ? [{ parent: `lane:${openLane}`, x: lane.left - TRAY_PAD, y: lane.top - TRAY_PAD, w: lane.right - lane.left + 2 * TRAY_PAD, h: lane.open.bottom - lane.top + 2 * TRAY_PAD }] : [];
    if (!whole && BOX_H * v.zoom < LANE_BAR_BELOW_PX) {
      const seen = lanesIn(map, r, openLane);
      const bars = [...seen.tree.map(barOf), ...seen.lanes.map((l): Bar => ({ parent: `lane:${l.lane}`, x: l.x, y: l.y, w: l.w, h: l.h }))];
      return { ...none, bars };
    }
    const seen = visibleIn(map, r, openLane);
    if (!whole && (seen.boxes.length > TRACE_MAX_DRAWN || BOX_H * v.zoom < BAR_BELOW_PX)) return { ...none, bars: [...tray, ...seen.boxes.map(barOf)] };
    const lines: Line[] = seen.lines.map((l) => ({ id: l.key, source: l.from, target: l.to, style: l.tree ? 'structure' : 'trace', link: !l.tree, points: l.points, scale: 1 }));
    return { boxes: seen.boxes, plates: seen.boxes.map(plateFor), bars: whole ? [] : tray, lines, traceLines: seen.lines };
  }, [map, plateFor, openLane]);

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
  /** The focus's own box the leader line starts on: the one the camera frames (in the lane arrived on), its box in the why tree, its obligation box, or its first copy in the lanes; none for a region. */
  const focusBox = useMemo(() => {
    if (focused.box?.id === focus) return focused.box;
    const copies = map.copies.get(focus) ?? [];
    return copies.find((b) => b.lane < 0) ?? copies.find((b) => b.column === 'obligation') ?? copies[0] ?? null;
  }, [map, focus, focused]);

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
    const state: PaintState = { focus, hover: hover.current, ring: ring.current, armed: tap.current?.armed ?? null, lit: sp.lit, litLines: sp.litLines, spot: spot.value, strength: faded.at, marks: live };
    const v = view.current;
    const cam: Camera = { cx: (s.w / 2 - v.x) / v.zoom, cy: (s.h / 2 - v.y) / v.zoom, zoom: v.zoom, w: s.w, h: s.h };
    paint(ctx.current, dpr, cam, frame, look.current, fonts, state);
    // The leader line to the wiki card (LA-V96-R24), under this camera, in the focus's outline color.
    const b = focusBox;
    if (wrapper.current) drawLeaderLine(ctx.current, {
      host: wrapper.current, space, dpr, color: b ? boxColors(look.current, plateFor(b)).edge : look.current.ink,
      box: b ? { left: b.x * v.zoom + v.x, top: b.y * v.zoom + v.y, right: (b.x + b.w) * v.zoom + v.x, bottom: (b.y + Math.min(b.h, BOX_H)) * v.zoom + v.y } : null,
    });
    if (!spot.done || !faded.done || marksMoving(live, frame.plates.map((p) => p.id))) requestPaint();
    else if (sp.to === 0 && sp.lit) { sp.lit = null; sp.litLines = null; }
  };
  useEffect(() => { requestPaint(); });
  // The wiki card moving without the camera draws its leader line again in the same frame.
  useLeaderFollow(wrapper, space, () => paintRef.current());

  /** Each record's arrows, every copy's, worked out once per map for the spotlight. */
  const linesOf = useMemo(() => {
    const by = new Map<string, TraceLine[]>();
    for (const line of [...map.tree.lines, ...map.lanes.flatMap((l) => l.lines)]) {
      for (const end of [line.source, line.target]) { const list = by.get(end); if (list) list.push(line); else by.set(end, [line]); }
    }
    return by;
  }, [map]);
  /** Lights a record's every copy, the arrows touching them and the boxes at their other ends; null lets go. */
  const spot = useCallback((id: string | null) => {
    onPeek?.('hover', id && index.byId.has(id) ? id : null);
    const s = spotlight.current;
    const value = spotNow().value;
    if (id === null) {
      if (s.id !== null) { spotlight.current = { ...s, id: null, from: value, to: 0, start: performance.now() }; requestPaint(); }
      return;
    }
    if (s.id === id) return;
    const lit = new Set((map.copies.get(id) ?? []).map((b) => b.key));
    const litLines = new Set<string>();
    for (const line of linesOf.get(id) ?? []) {
      lit.add(line.from);
      lit.add(line.to);
      litLines.add(line.key);
    }
    spotlight.current = { id, lit, litLines, from: s.id === null ? value : 1, to: 1, start: performance.now() };
    requestPaint();
  }, [linesOf, map, index, onPeek, requestPaint]);
  useEffect(() => () => spot(null), [focus, map]);

  const canOpen = useCallback((id: string) => id !== focus && index.byId.has(id), [focus, index]);
  /** The box a tap was on, so opening its record keeps its lane: a record's own box, or the copy in its lane of the record a file or a "+N more" opens. */
  const tapped = useRef<TraceBox | null>(null);
  const openFrom = useCallback((id: string) => {
    const box = tapped.current;
    const lane = box ? (box.lane >= 0 ? box.lane : map.places.get(box.key)?.[0] ?? null) : null;
    const own = box?.id === id ? box : map.copies.get(id)?.find((b) => b.lane === box?.lane);
    onNavigate(id, own ? { key: own.key, lane } : undefined);
  }, [map, onNavigate]);
  const tapToOpen = useTapToOpen(openFrom, canOpen, wrapper, focus);
  tap.current = tapToOpen;
  useEffect(() => { onPeek?.('selected', tapToOpen.armed); requestPaint(); }, [tapToOpen.armed, onPeek]);

  // The keyboard's ring: the box the table's focused link stands for, in its lane (or the first copy), brought into view.
  useEffect(() => {
    ring.current = ringAt?.id ?? null;
    spot(ringAt?.id ?? null);
    requestPaint();
    const s = sizeRef.current;
    if (!ringAt || !s) return;
    const copies = map.copies.get(ringAt.id) ?? [];
    const box = copies.find((b) => b.lane === ringAt.lane) ?? copies[0];
    if (!box) return;
    const v = view.current;
    const frame = frameBox(s);
    const left = box.x * v.zoom + v.x;
    const top = box.y * v.zoom + v.y;
    const h = Math.min(box.h, BOX_H) * v.zoom;
    const inside = left >= frame.x && left + box.w * v.zoom <= frame.x + frame.w && top >= frame.y && top + h <= frame.y + frame.h;
    if (inside) return;
    const zoom = Math.max(v.zoom, READ_ZOOM);
    moveTo({ x: frame.x + frame.w / 2 - (box.x + box.w / 2) * zoom, y: frame.y + frame.h / 2 - (box.y + Math.min(box.h, BOX_H) / 2) * zoom, zoom }, true);
  }, [ringAt?.id, ringAt?.lane]);

  // ---- The pointer: hover and click (drag, wheel and pinch are graph/gestures.ts's) ----
  const hitAt = useCallback((x: number, y: number): { box: TraceBox; plate: Plate } | null => {
    const v = view.current;
    const s = sizeRef.current;
    if (!s) return null;
    const frame = lastFrame.current ?? frameAt(v, s);
    const hit = hitPlate(frame.plates, { x: (x - v.x) / v.zoom, y: (y - v.y) / v.zoom });
    if (!hit) return null;
    return { box: frame.boxes[frame.plates.indexOf(hit)], plate: hit };
  }, [frameAt]);
  const setHover = (hit: { box: TraceBox; plate: Plate } | null) => {
    const id = hit?.box.id ?? null;
    if (hover.current === id) return;
    hover.current = id;
    const c = canvas.current;
    if (c) {
      c.style.cursor = hit && hit.box.opens && canOpen(hit.box.opens) ? 'pointer' : '';
      c.title = hit ? (hit.box.role === 'record' ? plateTip(hit.plate) : `${hit.plate.title} (${hit.plate.meta})`) : '';
    }
    spot(id);
    requestPaint();
  };
  const zoomButton = (factor: number) => () => {
    if (!size) return;
    const box = frameBox(size);
    gestures.zoomBy(box.x + box.w / 2, box.y + box.h / 2, factor);
  };

  // The column names over the frame's top edge, over each column of lanes in view, following the camera across; each
  // band's label over its head in each column of lanes it runs in.
  const cameraKey = useSyncExternalStore(store.subscribe, () => `${view.current.x.toFixed(1)} ${view.current.y.toFixed(1)} ${view.current.zoom.toFixed(5)}`);
  const [cx, cy, cz] = cameraKey.split(' ').map(Number);
  const paneW = size?.w ?? 0;
  const paneH = size?.h ?? 0;
  const segmentsInView = map.segments.filter((s) => s.x * cz + cx < paneW && (s.x + map.segmentWidth) * cz + cx > 0);
  const bandPx = Math.max(BAND_FONT.min, Math.min(BAND_FONT.max, BAND_FONT.max * cz * 4));
  // A band's first label may run over the columns it goes on in; the others show only where a column is wide enough to read them.
  const columnPx = map.segmentWidth * cz;
  const heads = map.bands.flatMap((b, i) => b.heads.map((h, n) => {
    const right = (b.heads.at(-1)!.x + map.segmentWidth) * cz + cx;
    const left = h.x * cz + cx;
    return { key: `${i}:${n}`, label: b.label, continued: h.continued, left, top: h.y * cz + cy, width: h.continued ? columnPx : right - left, px: bandPx };
  })).filter((h) => (!h.continued || columnPx >= CONTINUED_LABEL_PX) && h.top > -bandPx && h.top < paneH + bandPx * 2);
  // A label narrower than its words runs on to the next label on its line, if there is room.
  for (const h of heads) {
    const next = Math.min(...heads.filter((o) => o.left > h.left && Math.abs(o.top - h.top) < 2 * bandPx).map((o) => o.left), h.left + LABEL_RUN_PX);
    h.width = Math.max(h.width, next - h.left - 4);
    // And a label still too long for its room is set smaller, down to the least a label reads at.
    h.px = Math.max(BAND_FONT.least, Math.min(bandPx, h.width / (h.label.length * 0.62 + 1)));
  }
  const headsInView = heads.filter((h) => h.left < paneW && h.left + h.width > 0);

  // ---- The test hook: the drawn scene, in the page's pixels ----
  useEffect(() => {
    const host = wrapper.current;
    if (!host) return;
    host.traceHit = (clientX, clientY) => {
      const r = canvas.current!.getBoundingClientRect();
      return hitAt(clientX - r.left, clientY - r.top)?.box.key ?? null;
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
        lines: frame.traceLines.map((l) => ({ key: l.key, source: l.source, target: l.target, tree: l.tree, lit: sp.id !== null && sp.litLines ? sp.litLines.has(l.key) : null })),
        boxes: frame.boxes.map((b, i) => {
          const p = frame.plates[i];
          return {
            key: b.key, id: b.id, role: b.role, column: b.column, lane: b.lane, opens: b.opens, focus: b.id === focus, hover: hover.current === b.id, ring: ring.current === b.id,
            lit: sp.id !== null && sp.lit ? sp.lit.has(b.key) : null, strength: strength(b.key), change: ((m) => (m && m.change !== 'removed' ? m.change : null))(changes.live.get(b.id)), dashed: p.dashed, kind: p.kind, stage: p.stage, notes: b.notes, name: plateName(p, b.id === focus),
            rect: { left: r.left + b.x * v.zoom + v.x, top: r.top + b.y * v.zoom + v.y, width: b.w * v.zoom, height: b.h * v.zoom },
          };
        }),
      };
    };
  });

  const armedBox = tapToOpen.armed ? map.copies.get(tapToOpen.armed)?.[0] : undefined;
  const armedPlate = armedBox ? plateFor(armedBox) : null;
  const headTop = inset.top;
  const fontPx = Math.min(12, 11 * Math.max(cz, 0.6));
  return (
    <div ref={wrapper} className="graph-flow trace-flow" data-ready={size ? 'true' : undefined}>
      <canvas
        ref={canvas}
        className="graph-canvas-draw"
        aria-hidden="true"
        {...gestures.handlers}
        onPointerLeave={(e) => { if (!gestures.pressed(e.pointerId)) setHover(null); }}
      />
      {cz * BOX_H >= BAR_BELOW_PX && (
        <ol className="trace-column-names" aria-hidden="true" style={{ top: headTop }}>
          {segmentsInView.flatMap((s, i) => map.columns.map((c) => (
            <li key={`${i}:${c.column}`} style={{ left: (s.x + c.x) * cz + cx, width: BOX_W * cz, font: fontFor(fonts, 'meta', fontPx) }}><span>{LANE_COLUMN_LABELS[c.column]}</span></li>
          )))}
        </ol>
      )}
      <ol className="trace-band-names" aria-hidden="true">
        {headsInView.map((h) => (
          <li key={h.key} className={h.continued ? 'is-continued' : undefined} style={{ left: h.left, top: h.top, maxWidth: h.width, font: fontFor(fonts, h.continued ? 'meta' : 'title', h.px) }}><span>{h.label}</span></li>
        ))}
      </ol>
      <div className="graph-controls" role="group" aria-label="Camera">
        <Button variant="icon" className="graph-zoom-in" label="Zoom in" title="Zoom in" onClick={zoomButton(ZOOM_STEP)}><Icon name="plus" size={14} /></Button>
        <Button variant="icon" className="graph-zoom-out" label="Zoom out" title="Zoom out" onClick={zoomButton(1 / ZOOM_STEP)}><Icon name="minus" size={14} /></Button>
        <Tooltip label="Frame the focus" command="graphFit">
          <Button variant="icon" className="graph-frame-focus" label="Frame the focus" onClick={frameFocus}><Icon name="maximize" size={14} /></Button>
        </Tooltip>
      </div>
      {armedPlate && <TapCard kind={armedPlate.kindLabel} name={armedPlate.title} onOpen={tapToOpen.openArmed} onDismiss={tapToOpen.clear} />}
    </div>
  );
}
