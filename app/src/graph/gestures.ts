// The camera's gestures on a canvas, one way for every canvas stage (the Graph, GraphPage.tsx, and
// the Trace stage, trace/TraceAll.tsx): a glide to a viewport with the shared motion, zoom about
// a point within the stage's limits, and the pointer: hover, a tap, drag to pan, a pinch to zoom, and
// the wheel by wheelMove, which the ERD (erd/ErdView.tsx) follows too: scroll pans
// and Cmd or Ctrl with scroll zooms (Figma's convention), or with Scroll to zoom on (the Appearance's,
// LA-PLT-A4) scroll zooms and Cmd or Ctrl with scroll pans. A gesture during a glide takes over from it.
// Each stage keeps its own camera (its viewport ref and paint) and says what follows a move through the callbacks.
import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useScrollToZoom } from '../platform/appearance/use-scroll-to-zoom';
import { glideDuration, zoomPath, type Viewport } from './camera';
import { readMotion } from './motion';

/** How far a press moves before it is a drag, not a tap, in pixels. */
const DRAG_PX = 3;

/** Two viewports close enough that a glide between them would not show. */
const sameView = (a: Viewport, b: Viewport) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.zoom - b.zoom) < 1e-6;

export interface CameraGestureOptions {
  canvas: RefObject<HTMLCanvasElement | null>;
  /** The pane's size; null before its first measure, when every move is at once. */
  size: { w: number; h: number } | null;
  getViewport: () => Viewport;
  setViewport: (v: Viewport) => void;
  /** The least and the most zoom. */
  zoom: { min: number; max: number };
  /** A glide starts along a path to its target: before its first frame. */
  onGlide?: (path: ReturnType<typeof zoomPath>, target: Viewport) => void;
  /** The camera arrived where it was sent: at once, or at a glide's end. */
  onArrive?: (target: Viewport) => void;
  /** A drag, a pinch or a scroll moved the camera, or a press ended with no tap. */
  onGesture?: () => void;
  /** A press began on the canvas. */
  onPress?: () => void;
  /** A mouse or pen moved over the canvas with no press, at a point of the pane. */
  onHover: (x: number, y: number) => void;
  /** A press let go where it began, at a point of the pane. */
  onTap: (x: number, y: number, e: PointerEvent) => void;
}

export interface CameraGestures {
  /** Moves the camera to a viewport: one smooth zoom and pan, or at once. Returns how long the glide takes, in ms (0 at once). */
  moveTo: (target: Viewport, animate: boolean) => number;
  /** Zooms by a factor about a point of the pane, within the limits. */
  zoomAt: (sx: number, sy: number, factor: number) => void;
  /** Zooms by a factor about a point of the pane with a glide, within the limits. */
  zoomBy: (cx: number, cy: number, factor: number) => void;
  stopGlide: () => void;
  /** Whether a glide is running. */
  gliding: () => boolean;
  /** Whether a pointer is pressed on the canvas. */
  pressed: (pointerId: number) => boolean;
  /** Moves the camera by a wheel event at a point of the pane (wheelMove, kept to its scroll by wheelLatch); the canvas's own wheel comes here, and a stage with no canvas (the ERD) sends its own. */
  wheel: (e: WheelEvent, at: { x: number; y: number }) => void;
  /** The canvas's pointer handlers. */
  handlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  };
}

/** Pixels a line of scroll moves (a wheel in line mode, as Firefox sends it), as React Flow's on the ERD. */
const LINE_PX = 20;
/** A page of scroll when the pane has no size yet, in pixels. */
const PAGE_PX = 800;
/** The most a single wheel event zooms, as a power of two: one doubling. */
const MAX_WHEEL_ZOOM = 1;

/** A wheel event as wheelMove reads it. */
export interface WheelInput extends Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey' | 'ctrlKey' | 'metaKey'> {
  /** A trackpad pinch: the browser sends one as a wheel with Ctrl set while the Control key is not down (useWheelMove tells them apart). */
  pinch: boolean;
}

/** What a wheel event does: pan by screen pixels, or zoom by a power of two about the pointer. */
export type WheelMove = { dx: number; dy: number } | { zoom: number };

/**
 * What one wheel event does to the camera (LA-V93-R07). With Scroll to zoom off (the default, Figma's convention):
 * scroll (a wheel or a two-finger trackpad swipe) pans by the screen pixels it scrolled, deltaY down and deltaX across,
 * both at once on a trackpad; Shift turns a mouse wheel's deltaY sideways, unless the browser already sent it as deltaX;
 * Cmd or Ctrl with scroll zooms about the pointer. With Scroll to zoom on: scroll zooms about the pointer; Cmd or Ctrl
 * with scroll pans, down and across as a trackpad scrolls; Shift with scroll pans sideways. A trackpad pinch zooms
 * either way. A zoom is by a power of two, a doubling at most; line and page deltas are scaled to pixels.
 */
export function wheelMove(e: WheelInput, size: { w: number; h: number } | null, scrollToZoom: boolean): WheelMove {
  const scale = (axis: 'w' | 'h') => (e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? size?.[axis] ?? PAGE_PX : 1);
  const modifier = (e.ctrlKey && !e.pinch) || e.metaKey;
  if (e.pinch || (scrollToZoom ? !modifier && !e.shiftKey : modifier)) {
    // A pinch's deltas are small and many; Ctrl's tenfold matches d3's zoom so a pinch keeps today's speed.
    const zoom = -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002) * (e.ctrlKey ? 10 : 1);
    return { zoom: Math.max(-MAX_WHEEL_ZOOM, Math.min(MAX_WHEEL_ZOOM, zoom)) };
  }
  const sideways = e.shiftKey && e.deltaX === 0;
  return {
    dx: (sideways ? e.deltaY : e.deltaX) * scale('w'),
    dy: (sideways ? 0 : e.deltaY) * scale('h'),
  };
}

/**
 * wheelMove for this stage: with the person's Scroll to zoom, and a pinch told from Ctrl with scroll by whether the
 * Control key is down (the browser sets ctrlKey on both). The Control key is followed while the stage is shown.
 */
export function useWheelMove(): (e: WheelEvent, size: { w: number; h: number } | null) => WheelMove {
  const scrollToZoom = useRef(false);
  scrollToZoom.current = useScrollToZoom();
  const control = useRef(false);
  useEffect(() => {
    const note = (e: KeyboardEvent) => { control.current = e.ctrlKey; };
    const lost = () => { control.current = false; };
    window.addEventListener('keydown', note, true);
    window.addEventListener('keyup', note, true);
    window.addEventListener('blur', lost);
    return () => {
      window.removeEventListener('keydown', note, true);
      window.removeEventListener('keyup', note, true);
      window.removeEventListener('blur', lost);
    };
  }, []);
  return useCallback((e, size) => wheelMove({
    deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey,
    pinch: e.ctrlKey && !control.current,
  }, size, scrollToZoom.current), []);
}

/** The longest pause between two wheel events of one scroll, momentum included, in milliseconds. */
const WHEEL_STREAM_GAP_MS = 150;
/** How far a dropped stream's delta must grow past its faded least, in pixels, to count as a new scroll. */
const WHEEL_REGROW_PX = 4;

/**
 * One scroll keeps the move it began with: a stream of wheel events (each within WHEEL_STREAM_GAP_MS
 * of the one before, a trackpad's momentum included) zooms when its first event zoomed and pans
 * otherwise (wheelMove, in either mode of Scroll to zoom). A key pressed or let go during a stream that
 * changes its move (Cmd or Ctrl, or Shift with Scroll to zoom on) ends it: the rest of that stream is
 * dropped, so a zoom's momentum never turns into a pan (or a pan's into a zoom). A new scroll starts
 * afresh: after a pause, or as soon as a dropped stream's deltas grow again (momentum only ever fades,
 * so growing deltas are the fingers scrolling anew while momentum still arrives).
 */
export function wheelLatch(): (e: { zoom: boolean } & Pick<WheelEvent, 'deltaX' | 'deltaY'>, now: number) => 'move' | 'drop' {
  let last = -Infinity;
  let zooming = false;
  let dropping = false;
  /** The smallest delta of the stream since it began dropping: momentum's fade. */
  let faded = Infinity;
  return (e, now) => {
    const { zoom } = e;
    const size = Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY));
    if (now - last > WHEEL_STREAM_GAP_MS || (dropping && size > faded + WHEEL_REGROW_PX)) { zooming = zoom; dropping = false; }
    last = now;
    if (!dropping && zoom !== zooming) { dropping = true; faded = size; }
    if (dropping) faded = Math.min(faded, size);
    return dropping ? 'drop' : 'move';
  };
}

/** The camera's glide, zoom and pointer gestures on a canvas; the wheel is listened to on the canvas itself (not passive). */
export function useCameraGestures(options: CameraGestureOptions): CameraGestures {
  const o = useRef(options);
  o.current = options;

  const glide = useRef<number | null>(null);
  const stopGlide = useCallback(() => { if (glide.current !== null) { cancelAnimationFrame(glide.current); glide.current = null; } }, []);
  useEffect(() => stopGlide, [stopGlide]);
  const moveTo = useCallback((target: Viewport, animate: boolean): number => {
    stopGlide();
    const { size, getViewport, setViewport, onGlide, onArrive } = o.current;
    const from = getViewport();
    const motion = readMotion();
    if (!size || !animate || motion.duration === 0 || sameView(from, target)) {
      setViewport(target);
      onArrive?.(target);
      return 0;
    }
    const path = zoomPath(from, target, size.w, size.h);
    onGlide?.(path, target);
    const duration = glideDuration(motion.duration, path.S);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      o.current.setViewport(path.at(motion.ease(t)));
      if (t < 1) { glide.current = requestAnimationFrame(step); return; }
      glide.current = null;
      o.current.onArrive?.(target);
    };
    glide.current = requestAnimationFrame(step);
    return duration;
  }, [stopGlide]);

  const clamp = (zoom: number) => Math.min(o.current.zoom.max, Math.max(o.current.zoom.min, zoom));
  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    const v = o.current.getViewport();
    const zoom = clamp(v.zoom * factor);
    const k = zoom / v.zoom;
    o.current.setViewport({ x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k, zoom });
  }, []);
  const zoomBy = useCallback((cx: number, cy: number, factor: number) => {
    const v = o.current.getViewport();
    const zoom = clamp(v.zoom * factor);
    const k = zoom / v.zoom;
    moveTo({ x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, zoom }, true);
  }, [moveTo]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = o.current.canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const twoPointers = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    o.current.onPress?.();
    o.current.canvas.current?.setPointerCapture?.(e.pointerId);
    const at = local(e);
    pointers.current.set(e.pointerId, at);
    if (pointers.current.size === 1) press.current = { ...at, moved: false };
    else if (pointers.current.size === 2) { pinch.current = twoPointers(); if (press.current) press.current.moved = true; stopGlide(); }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const { getViewport, setViewport, onGesture, onHover } = o.current;
    const at = local(e);
    const before = pointers.current.get(e.pointerId);
    if (!before) {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') onHover(at.x, at.y);
      return;
    }
    pointers.current.set(e.pointerId, at);
    if (pointers.current.size >= 2 && pinch.current) {
      const now = twoPointers();
      const v = getViewport();
      setViewport({ ...v, x: v.x + now.mid.x - pinch.current.mid.x, y: v.y + now.mid.y - pinch.current.mid.y });
      zoomAt(now.mid.x, now.mid.y, now.dist / Math.max(1, pinch.current.dist));
      pinch.current = now;
      onGesture?.();
      return;
    }
    const p = press.current;
    if (!p) return;
    if (!p.moved && Math.hypot(at.x - p.x, at.y - p.y) < DRAG_PX) return;
    if (!p.moved) { p.moved = true; stopGlide(); }
    const v = getViewport();
    setViewport({ ...v, x: v.x + at.x - before.x, y: v.y + at.y - before.y });
    onGesture?.();
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const p = press.current;
    if (pointers.current.size > 0) return;
    press.current = null;
    if (!p || p.moved || e.type === 'pointercancel') { o.current.onGesture?.(); return; }
    o.current.onTap(p.x, p.y, e.nativeEvent);
  };

  // The wheel: wheelMove with the person's Scroll to zoom, a scroll keeping its move (wheelLatch).
  const readWheel = useWheelMove();
  const latch = useRef(wheelLatch());
  const wheel = useCallback((e: WheelEvent, at: { x: number; y: number }) => {
    const move = readWheel(e, o.current.size);
    if (latch.current({ zoom: 'zoom' in move, deltaX: e.deltaX, deltaY: e.deltaY }, e.timeStamp) === 'drop') return;
    stopGlide();
    if ('zoom' in move) zoomAt(at.x, at.y, 2 ** move.zoom);
    else {
      const v = o.current.getViewport();
      o.current.setViewport({ ...v, x: v.x - move.dx, y: v.y - move.dy });
    }
    o.current.onGesture?.();
  }, [readWheel, stopGlide, zoomAt]);
  useEffect(() => {
    const c = o.current.canvas.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); wheel(e, local(e)); };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [wheel]);

  return {
    moveTo,
    zoomAt,
    zoomBy,
    stopGlide,
    gliding: useCallback(() => glide.current !== null, []),
    pressed: useCallback((id: number) => pointers.current.has(id), []),
    wheel,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
