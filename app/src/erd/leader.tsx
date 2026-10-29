import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useStoreApi } from '@xyflow/react';
import { useThemeVersion } from '../graph/look';
import { drawLeaderLine, useLeaderFollow, type LeaderHost } from '../views/leaderLine';
import type { OpenSpaceStore } from '../views/openSpace';
import type { Rect } from './erd';

/**
 * The ERD's leader line to the wiki card (LA-V96-R24, views/leaderLine.ts): React Flow draws the
 * boxes in the page, so the line has a canvas of its own over them, drawn as the diagram's viewport
 * changes (in the same task as React Flow moves it), from the focus's box in its border's color.
 */
export function ErdLeader({ host, rects, focus, space }: { host: RefObject<LeaderHost | null>; rects: ReadonlyMap<string, Rect> | null; focus: string; space?: OpenSpaceStore }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const flow = useStoreApi();
  const theme = useThemeVersion();
  const color = useRef<string | null>(null);
  useEffect(() => { color.current = null; }, [focus, theme, rects]);

  const draw = useCallback(() => {
    const c = canvas.current;
    const el = host.current;
    const ctx = c?.getContext('2d');
    if (!c || !el || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr)); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const r = rects?.get(focus);
    if (r && color.current === null) {
      // Read once React Flow has drawn the box; until then, the ink.
      const box = el.querySelector(`.react-flow__node[data-id="${CSS.escape(focus)}"] .erd-box`);
      if (box) color.current = getComputedStyle(box).borderTopColor;
    }
    const [x, y, zoom] = flow.getState().transform;
    const onScreen = (b: Rect) => ({ left: b.x * zoom + x, top: b.y * zoom + y, right: (b.x + b.width) * zoom + x, bottom: (b.y + b.height) * zoom + y });
    drawLeaderLine(ctx, {
      host: el, space, dpr, color: color.current ?? getComputedStyle(el).color,
      box: r ? onScreen(r) : null,
    });
  }, [host, rects, focus, space, flow]);

  // Every viewport change (a fit's glide, a drag, the wheel), drawn in the same task as React Flow's own move.
  useEffect(() => {
    let last = flow.getState().transform;
    return flow.subscribe((s) => { if (s.transform !== last) { last = s.transform; draw(); } });
  }, [flow, draw]);
  useLayoutEffect(() => { draw(); }, [draw, theme]);
  useLeaderFollow(host, space, draw);
  useEffect(() => {
    const el = host.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const sizes = new ResizeObserver(() => draw());
    sizes.observe(el);
    return () => sizes.disconnect();
  }, [host, draw]);

  return <canvas ref={canvas} className="erd-leader" aria-hidden="true" />;
}
