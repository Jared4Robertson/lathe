// The Trace stage drawn on the canvas (LA-V98): the graph's renderer (paint.ts, plate.ts), camera
// (camera.ts) and pointer, over the picture lanes.ts lays out.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { SpecIndex } from '../specs/data';
import { Icon } from '../components/icons';
import { Button } from '../components/Button';
import { MAX_ZOOM, viewRect, type Viewport } from '../graph/camera';
import { fontFor, pageMeasure, readGraphFonts, readyMeasure, type GraphFonts } from '../graph/fonts';
import { hitPlate } from '../graph/hit';
import { PLAIN_LOOK, readLook, useThemeVersion, type Look } from '../graph/look';
import { GAP_KIND, paint, type Bar, type Camera, type Line, type PaintState } from '../graph/paint';
import { plateName, plateOf, plateTip, type Plate } from '../graph/plate';
import { nodeShape, SHAPES } from '../graph/shapes';
import { BORDER, labelLines, LABEL_PAD, LABEL_PAD_BLOCK, LINE_HEIGHT, META_FONT, setTextMeasure, TITLE_FONT, hasMarks, metaWidth, titleWidth, wrapLabel, wrapText, type TextMeasure, type WrappedLabel } from '../graph/text';
import { TapCard, useTapToOpen } from '../graph/touch';
import { useCameraGestures } from '../graph/gestures';
import { useCommand } from '../shell/commands';
import { Tooltip } from '../shell/Tooltip';
import { useOpenSpace, type Insets, type OpenSpaceStore } from '../views/openSpace';
import { allBoxes, BOX_H, BOX_W, LANE_COLUMN_LABELS, visibleIn, type TraceBox, type TraceLine, type TracePicture } from './lanes';

// Every frame draws what the camera shows of the picture: the boxes in view, each in its kind's
// shape and its stage's colors with its label, and the arrows between them; far out, where a box is
// too small to read or more boxes are in view than a frame draws, each box is a bar where it is and
// no arrow is drawn. Only what is in view is ever drawn (lanes.ts visibleIn), so a product's
// trace draws as fast as a use case's. A record repeated in several lanes shares its id across its
// copies: hovering one, or focusing it from the keyboard, lights every copy and their arrows.
//
// The canvas is hidden from assistive technology: the Trace stage's table (TraceView.tsx) is its
// accessible layer, visually hidden on a wide screen. Its links carry keyboard focus, and the box a
// link stands for gets the drawn focus ring, the camera bringing it into view (`ring`).

/** The most boxes one frame draws as boxes (LA-PAT-APP-UX-R11); more in view are drawn as bars. */
const TRACE_MAX_DRAWN = 260;
/** A box under this many pixels tall on screen is drawn as a bar. */
const BAR_BELOW_PX = 14;
/** The least zoom: a large product's trace whole in the pane. */
const MIN_ZOOM = 0.02;
/** The zoom a trace is framed at at least, so its labels read; wider traces are framed from their left edge. */
const READ_ZOOM = 0.8;
/** The space kept around the framed picture, in screen pixels. */
const PAD = 24;
const ZOOM_STEP = 1.2;
const NO_INSETS: Insets = { left: 0, top: 0, right: 0, bottom: 0 };
const MIN_FRAME = 120;

/** One drawn box as the test hook reports it, in the page's pixels. */
export interface TraceSceneBox { key: string; id: string; role: TraceBox['role']; column: string; lane: number; opens: string | null; focus: boolean; hover: boolean; ring: boolean; lit: boolean | null; dashed: boolean; kind: string; stage: string; notes: string[]; name: string; rect: { left: number; top: number; width: number; height: number } }
/** What the canvas draws now (LA-PAT-APP-UX-R12): its camera, boxes, bars and arrows; or, `whole`, every box and arrow of the picture as the camera would draw it. */
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
  picture: TracePicture;
  onNavigate: (id: string) => void;
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  space?: OpenSpaceStore;
  /** The box the keyboard is on (from the table's focused link), drawn with the focus ring and brought into view; null for none. */
  ring: { id: string; lane: string | null } | null;
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

function TraceScene({ index, focus, picture, onNavigate, onPeek, space, ring: ringAt, fonts, theme }: TraceCanvasProps & { measure: TextMeasure; fonts: GraphFonts; theme: number }) {
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
    onTap: (x, y, e) => { const hit = hitAt(x, y); if (hit?.box.opens) tapToOpen.onNodeClick(e, hit.box.opens); else tapToOpen.clear(); },
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

  /**
   * The camera that frames the picture: one obligation's chain centered on the obligation, all of it in view (zoomed in
   * no further than 1); lanes as wide as the frame allows down to READ_ZOOM, from the top (and the left, when wider).
   */
  const framing = useCallback((): Viewport | null => {
    if (!size || (space && !open)) return null;
    const box = frameBox(size);
    const w = box.w - 2 * PAD;
    const h = box.h - 2 * PAD;
    if (picture.width <= 0) return { x: box.x + box.w / 2, y: box.y + box.h / 2, zoom: 1 };
    if (picture.shape === 'chain') {
      const center = picture.lanes[0].boxes.find((b) => b.column === 'obligation')!;
      const cx = center.x + center.w / 2;
      const cy = center.y + center.h / 2;
      const reach = { x: Math.max(cx, picture.width - cx), y: Math.max(cy, picture.height - cy) };
      const zoom = Math.max(READ_ZOOM, Math.min(1, w / (2 * Math.max(1, reach.x)), h / (2 * Math.max(1, reach.y))));
      return { x: box.x + box.w / 2 - cx * zoom, y: box.y + box.h / 2 - cy * zoom, zoom };
    }
    const zoom = Math.max(READ_ZOOM, Math.min(1, w / picture.width));
    // The focus, where it is drawn (a record the lanes hold, an untraced record), is kept in the frame: centered along a side the picture overflows.
    const mark = picture.lanes.flatMap((l) => l.boxes).find((b) => b.id === focus);
    const along = (extent: number, start: number, room: number, at: number | null) => {
      if (extent * zoom <= room - 2 * PAD) return start + room / 2 - (extent / 2) * zoom;
      if (at === null || at * zoom <= room - 2 * PAD) return start + PAD;
      return start + room / 2 - at * zoom;
    };
    const x = along(picture.width, box.x, box.w, mark ? mark.x + mark.w / 2 : null);
    const y = along(picture.height, box.y, box.h, mark ? mark.y + mark.h / 2 : null);
    return { x, y, zoom };
  }, [size, picture, focus, frameBox, space, open]);

  const framed = useRef<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const target = framing();
    if (!target || !size) return;
    const resized = framed.current !== null && (framed.current.w !== size.w || framed.current.h !== size.h);
    const duration = moveTo(target, framed.current !== null && !resized);
    framed.current = size;
    // Where the focus's box will sit once the camera arrives (the chain's obligation, or the focus where the lanes hold it), for the wiki card.
    const boxes = picture.lanes.flatMap((l) => l.boxes);
    const mark = picture.shape === 'chain' ? boxes.find((b) => b.column === 'obligation') : boxes.find((b) => b.id === focus);
    space?.setAnchor({ focus, y: mark ? target.y + (mark.y + mark.h / 2) * target.zoom : null, at: performance.now() + duration });
  }, [framing]);
  const frameAll = useCallback(() => { const t = framing(); if (t) moveTo(t, true); }, [framing, moveTo]);
  // `.` frames the trace again, as it frames the graph's focus: one command, whichever stage is drawn.
  useCommand('graphFit', frameAll, !!size);

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

  // ---- The plates: made when first drawn, once per picture ----
  const look = useRef<Look>(PLAIN_LOOK);
  useLayoutEffect(() => { if (wrapper.current) look.current = readLook(wrapper.current); requestPaint(); }, [theme]);
  const plates = useMemo(() => new Map<string, Plate>(), [picture, index, fonts]);
  const plateFor = useCallback((b: TraceBox): Plate => {
    const known = plates.get(b.key);
    if (known) return known;
    const label = boxLabel(index, b);
    const plain = b.role === 'record' ? undefined : {
      kind: b.role === 'gap' || b.role === 'untraced' ? GAP_KIND : 'file', kindLabel: b.role === 'file' ? 'File' : b.role === 'gap' ? 'Gap' : 'Untraced',
      title: label.words.title, meta: label.words.meta, stage: 'structural' as const, dashed: b.role !== 'file',
    };
    const plate = plateOf(index, b.id, { view: 'trace', node: b, lines: label.lines, notes: label.notes, top: b.h > BOX_H + 1, plain });
    plates.set(b.key, plate);
    return plate;
  }, [plates, index]);

  /** What a camera shows: the boxes in view as plates (or bars, far out or past the budget), and the arrows between them. */
  const frameAt = useCallback((v: Viewport, s: { w: number; h: number }, whole = false) => {
    const seen = visibleIn(picture, whole ? { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity } : viewRect(v, s.w, s.h));
    const asBars = !whole && (seen.boxes.length > TRACE_MAX_DRAWN || BOX_H * v.zoom < BAR_BELOW_PX);
    if (asBars) {
      const bars: Bar[] = seen.boxes.map((b) => ({ parent: b.id, x: b.x, y: b.y, w: b.w, h: b.h }));
      return { boxes: [] as TraceBox[], plates: [] as Plate[], bars, lines: [] as Line[] };
    }
    const lines: Line[] = seen.lines.map((l) => ({ id: l.key, source: l.source, target: l.target, style: l.tree ? 'structure' : 'trace', link: !l.tree, points: l.points, scale: 1, label: '' }));
    return { boxes: seen.boxes, plates: seen.boxes.map(plateFor), bars: [] as Bar[], lines };
  }, [picture, plateFor]);

  // ---- The spotlight, the pointer, the keyboard's ring and a tap's selection ----
  const hover = useRef<string | null>(null);
  const ring = useRef<string | null>(null);
  const spotlight = useRef<{ id: string | null; lit: Set<string> | null; litLines: Set<string> | null; from: number; to: number; start: number }>({ id: null, lit: null, litLines: null, from: 0, to: 0, start: 0 });
  const spotNow = () => {
    const s = spotlight.current;
    const fade = look.current.fade;
    const t = fade > 0 ? Math.min(1, (performance.now() - s.start) / fade) : 1;
    return { value: s.from + (s.to - s.from) * t, done: t >= 1 };
  };
  const ctx = useRef<CanvasRenderingContext2D | null | undefined>(undefined);
  const tap = useRef<ReturnType<typeof useTapToOpen> | null>(null);
  const lastFrame = useRef<ReturnType<typeof frameAt> | null>(null);
  lastFrame.current = null;
  const full = () => 1;

  paintRef.current = () => {
    const s = sizeRef.current;
    if (!s) return;
    const frame = frameAt(view.current, s);
    lastFrame.current = frame;
    if (ctx.current === undefined) ctx.current = canvas.current?.getContext('2d') ?? null;
    if (!ctx.current) return;
    const spot = spotNow();
    const sp = spotlight.current;
    const state: PaintState = { focus, hover: hover.current, ring: ring.current, armed: tap.current?.armed ?? null, lit: sp.lit, litLines: sp.litLines, spot: spot.value, strength: full };
    const v = view.current;
    const cam: Camera = { cx: (s.w / 2 - v.x) / v.zoom, cy: (s.h / 2 - v.y) / v.zoom, zoom: v.zoom, w: s.w, h: s.h };
    paint(ctx.current, dpr, cam, frame, look.current, fonts, state);
    if (!spot.done) requestPaint();
    else if (sp.to === 0 && sp.lit) { sp.lit = null; sp.litLines = null; }
  };
  useEffect(() => { requestPaint(); });

  /** Each record's arrows, every copy's, worked out once per picture for the spotlight. */
  const linesOf = useMemo(() => {
    const by = new Map<string, TraceLine[]>();
    for (const line of [...picture.tree.lines, ...picture.lanes.flatMap((l) => l.lines)]) {
      for (const end of [line.source, line.target]) { const list = by.get(end); if (list) list.push(line); else by.set(end, [line]); }
    }
    return by;
  }, [picture]);
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
    const lit = new Set([id]);
    const litLines = new Set<string>();
    for (const line of linesOf.get(id) ?? []) {
      lit.add(line.source);
      lit.add(line.target);
      litLines.add(line.key);
    }
    spotlight.current = { id, lit, litLines, from: s.id === null ? value : 1, to: 1, start: performance.now() };
    requestPaint();
  }, [linesOf, index, onPeek, requestPaint]);
  useEffect(() => () => spot(null), [focus, picture]);

  const canOpen = useCallback((id: string) => id !== focus && index.byId.has(id), [focus, index]);
  const tapToOpen = useTapToOpen(onNavigate, canOpen, wrapper, focus);
  tap.current = tapToOpen;
  useEffect(() => { onPeek?.('selected', tapToOpen.armed); requestPaint(); }, [tapToOpen.armed, onPeek]);

  // The keyboard's ring: the box the table's focused link stands for, in its lane (or the first copy), brought into view.
  useEffect(() => {
    ring.current = ringAt?.id ?? null;
    spot(ringAt?.id ?? null);
    requestPaint();
    const s = sizeRef.current;
    if (!ringAt || !s) return;
    const lane = ringAt.lane === null ? undefined : picture.lanes.find((l) => l.obligation === ringAt.lane);
    const box = lane?.boxes.find((b) => b.id === ringAt.id) ?? allBoxes(picture).find((b) => b.id === ringAt.id);
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

  // The column names over the frame's top edge, following the camera across.
  const columnsKey = useSyncExternalStore(store.subscribe, () => `${view.current.x.toFixed(1)} ${view.current.zoom.toFixed(4)}`);
  const [cx, cz] = columnsKey.split(' ').map(Number);

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
      return {
        camera: { ...v },
        canvas: { left: r.left, top: r.top, width: s.w, height: s.h },
        bars: frame.bars.length,
        lines: frame.lines.map((l) => ({ key: l.id, source: l.source, target: l.target, tree: !l.link, lit: sp.id !== null && sp.litLines ? sp.litLines.has(l.id) : null })),
        boxes: frame.boxes.map((b, i) => {
          const p = frame.plates[i];
          return {
            key: b.key, id: b.id, role: b.role, column: b.column, lane: b.lane, opens: b.opens, focus: b.id === focus, hover: hover.current === b.id, ring: ring.current === b.id,
            lit: sp.id !== null && sp.lit ? sp.lit.has(b.id) : null, dashed: p.dashed, kind: p.kind, stage: p.stage, notes: b.notes, name: plateName(p, b.id === focus),
            rect: { left: r.left + b.x * v.zoom + v.x, top: r.top + b.y * v.zoom + v.y, width: b.w * v.zoom, height: b.h * v.zoom },
          };
        }),
      };
    };
  });

  const armedBox = tapToOpen.armed ? allBoxes(picture).find((b) => b.id === tapToOpen.armed) : undefined;
  const armedPlate = armedBox ? plateFor(armedBox) : null;
  const headTop = inset.top;
  const fontPx = Math.min(12, 11 * Math.max(cz, 0.6));
  return (
    <div ref={wrapper} className="graph-flow trace-flow" data-ready={size ? 'true' : undefined} data-shape={picture.shape}>
      <canvas
        ref={canvas}
        className="graph-canvas-draw"
        aria-hidden="true"
        {...gestures.handlers}
        onPointerLeave={(e) => { if (!gestures.pressed(e.pointerId)) setHover(null); }}
      />
      {cz * BOX_H >= BAR_BELOW_PX && (
        <ol className="trace-column-names" aria-hidden="true" style={{ top: headTop }}>
          {picture.columns.map((c) => (
            <li key={c.column} style={{ left: c.x * cz + cx, width: BOX_W * cz, font: fontFor(fonts, 'meta', fontPx) }}><span>{LANE_COLUMN_LABELS[c.column]}</span></li>
          ))}
        </ol>
      )}
      <div className="graph-controls" role="group" aria-label="Camera">
        <Button variant="icon" className="graph-zoom-in" label="Zoom in" title="Zoom in" onClick={zoomButton(ZOOM_STEP)}><Icon name="plus" size={14} /></Button>
        <Button variant="icon" className="graph-zoom-out" label="Zoom out" title="Zoom out" onClick={zoomButton(1 / ZOOM_STEP)}><Icon name="minus" size={14} /></Button>
        <Tooltip label="Frame the trace" command="graphFit">
          <Button variant="icon" className="graph-frame-focus" label="Frame the trace" onClick={frameAll}><Icon name="maximize" size={14} /></Button>
        </Tooltip>
      </div>
      {armedPlate && <TapCard kind={armedPlate.kindLabel} name={armedPlate.title} onOpen={tapToOpen.openArmed} onDismiss={tapToOpen.clear} />}
    </div>
  );
}
