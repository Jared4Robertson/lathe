// The camera's gestures on a canvas, one way for every canvas stage (the Graph, GraphPage.tsx, and
// the Trace stage, trace/TraceCanvas.tsx): a glide to a viewport with the shared motion, zoom about
// a point within the stage's limits, and the pointer: hover, a tap, drag to pan, pinch and the wheel
// to zoom. A gesture during a glide takes over from it. Each stage keeps its own camera (its
// viewport ref and paint) and says what follows a move through the callbacks.
import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
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
  /** A drag, a pinch or the wheel moved the camera, or a press ended with no tap. */
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
  /** The canvas's pointer handlers. */
  handlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
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

  // The wheel zooms about the pointer (a pinch on a trackpad comes as a wheel with Ctrl held), as d3's zoom does.
  useEffect(() => {
    const c = o.current.canvas.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopGlide();
      const at = local(e);
      const delta = -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002) * (e.ctrlKey ? 10 : 1);
      zoomAt(at.x, at.y, 2 ** delta);
      o.current.onGesture?.();
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [stopGlide, zoomAt]);

  return {
    moveTo,
    zoomAt,
    zoomBy,
    stopGlide,
    gliding: useCallback(() => glide.current !== null, []),
    pressed: useCallback((id: number) => pointers.current.has(id), []),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
