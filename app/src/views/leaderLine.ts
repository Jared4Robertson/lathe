import { useEffect, useRef } from 'react';
import type { Insets, OpenSpaceStore } from './openSpace';

// The leader line (LA-V96-R24): like a digital map's callout, a thin line joins the focused box on
// the stage to the wiki card that shows it, from the box's nearest edge to the card's inner edge,
// ending level with the card's title, a small dot at each end. One way for every stage (the Graph,
// the ERD and the Trace): each draws it on its own canvas as it paints, after its boxes, from the
// focused box's rectangle under its camera, so it follows every pan, zoom, glide and arrow step in
// the same frame. The card is read where it is (its rectangle, its title's row) at that paint, never
// assumed level with the box, so the line usually slants. It never crosses another drawn box: when the straight
// path would, it runs level along the nearest gap between rows and turns into the focused box's visible part, or ends
// on the box's nearest visible edge from a gap; with no such path it is not drawn. A focused box off-screen or behind a panel
// gets a short stub at the open space's edge, pointing toward it. There is no line while the card is
// collapsed, on a phone (the card is a bottom sheet), with no focused box drawn, and it is
// decorative: it is only paint, the card already names its record.

export interface Point { x: number; y: number }
/** A rectangle in the stage's own pixels, from its top left corner. */
export interface Box { left: number; top: number; right: number; bottom: number }
/** Where the line meets the card: its inner (left) edge, level with its title. */
export type CardEnd = Point;

/**
 * The line: `from` the focused box's edge `to` the card's, by the bends `via` (none for a straight line); a stub runs
 * `from` inside the open space `to` its edge, toward the box, and does not reach the card.
 */
export interface LeaderLine { from: Point; to: Point; via: Point[]; stub: boolean }

/** The stub's length, and how far inside the open space's edge it ends, in px. */
export const STUB_PX = 28;
export const STUB_EDGE = 12;
/** The line's width and its dots' radius, in px: it reads, and stays fainter than a link (1.2 to 1.5 px, dashed). */
export const LEADER_WIDTH = 1.5;
export const LEADER_DOT = 3;
/** The least of a box left in the open space, in px each way, for the line to start on it rather than stub toward it. */
const SEEN_PX = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The leader line for a focused box (null when none is drawn) and the card's end (null when the card
 * does not float), in the open space: from the nearest point of the box's part in the open space to
 * the card's end, or, when no part of it shows there, a stub at the edge of the frame (the open space
 * less the stage's own tools) toward it.
 */
export function leaderLine(box: Box | null, card: CardEnd | null, open: Box, frame: Box = open, avoid: readonly Box[] = []): LeaderLine | null {
  if (!box || !card || open.right - open.left < 1 || open.bottom - open.top < 1) return null;
  const seen = {
    left: Math.max(box.left, open.left), top: Math.max(box.top, open.top),
    right: Math.min(box.right, open.right), bottom: Math.min(box.bottom, open.bottom),
  };
  if (seen.right - seen.left >= SEEN_PX && seen.bottom - seen.top >= SEEN_PX) {
    const from = { x: clamp(card.x, seen.left, seen.right), y: clamp(card.y, seen.top, seen.bottom) };
    // The card's end inside the box (the box under the card's edge): nothing to join.
    if (Math.hypot(card.x - from.x, card.y - from.y) < 1) return null;
    // Only what shows counts: a box's part under a panel is hidden, and so is the line there.
    const shown = avoid
      .map((r) => ({ left: Math.max(r.left, open.left), top: Math.max(r.top, open.top), right: Math.min(r.right, open.right), bottom: Math.min(r.bottom, open.bottom) }))
      .filter((r) => r.right > r.left && r.bottom > r.top);
    return routed(from, card, seen, open, shown);
  }
  // Off-screen or behind a panel: at the open space's edge nearest the box's center (kept a little inside it, so it
  // shows whole), pointing toward it.
  const center = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
  const room = frame.right - frame.left >= 2 * (STUB_EDGE + STUB_PX) && frame.bottom - frame.top >= 2 * (STUB_EDGE + STUB_PX) ? frame : open;
  const inset = Math.min(STUB_EDGE, (room.right - room.left) / 2, (room.bottom - room.top) / 2);
  const edge = { x: clamp(center.x, room.left + inset, room.right - inset), y: clamp(center.y, room.top + inset, room.bottom - inset) };
  const dx = center.x - edge.x;
  const dy = center.y - edge.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return null;
  const reach = Math.min(STUB_PX, Math.max(0, Math.min(room.right - room.left, room.bottom - room.top) / 2 - inset));
  return { from: { x: edge.x - (dx / length) * reach, y: edge.y - (dy / length) * reach }, to: edge, via: [], stub: true };
}

/** How far the line keeps from a box it passes, in px. */
const CLEAR_PX = 1.5;
/** The least height of a gap between rows the line runs along, in px. */
const GAP_PX = 2 * CLEAR_PX + 1;

/** Whether a segment crosses a box grown by CLEAR_PX, by clipping it to the box (Liang and Barsky). */
export function crosses(a: Point, b: Point, r: Box): boolean {
  const [x0, y0, x1, y1] = [r.left - CLEAR_PX, r.top - CLEAR_PX, r.right + CLEAR_PX, r.bottom + CLEAR_PX];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let lo = 0;
  let hi = 1;
  const sides: [number, number][] = [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]];
  for (const [p, q] of sides) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > hi) return false; lo = Math.max(lo, t); } else { if (t < lo) return false; hi = Math.min(hi, t); }
  }
  return lo < hi;
}

const clear = (points: readonly Point[], avoid: readonly Box[]) => points.every((p, i) => i === 0 || !avoid.some((r) => crosses(points[i - 1], p, r)));
const pathLength = (points: readonly Point[]) => points.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y)), 0);

/**
 * The line from the focused box's visible part `seen` (at `from`) to the card's end, around the boxes to avoid: straight
 * when that crosses none; else level along a gap between the rows in its way, turning into `seen` at its edge when the
 * gap lies beside it, or from a gap above or below it onto its nearest edge; the shortest such path, or none.
 */
function routed(from: Point, card: CardEnd, seen: Box, open: Box, avoid: readonly Box[]): LeaderLine | null {
  if (clear([from, card], avoid)) return { from, to: card, via: [], stub: false };
  // The rows in the line's way: the boxes between the focused box's visible part and the card.
  const lane = avoid.filter((r) => r.right > seen.left && r.left < card.x);
  const taken = lane.map((r): [number, number] => [r.top - CLEAR_PX, r.bottom + CLEAR_PX]).sort((a, b) => a[0] - b[0]);
  const gaps: number[] = [];
  let y = open.top;
  for (const [top, bottom] of taken) {
    if (top - y >= GAP_PX) gaps.push((y + top) / 2);
    y = Math.max(y, bottom);
  }
  if (open.bottom - y >= GAP_PX) gaps.push((y + open.bottom) / 2);
  // Where the level run may turn toward the card: just past a box's right edge, or at the card's edge; the first that clears.
  const turns = [...new Set([...lane.map((r) => r.right + 2 * CLEAR_PX), card.x - 1])].filter((x) => x > seen.right && x < card.x).sort((a, b) => a - b);
  const edgeX = clamp(seen.right - 4 * CLEAR_PX, seen.left, seen.right);
  let best: Point[] | null = null;
  for (const g of gaps) {
    const beside = g >= seen.top + CLEAR_PX && g <= seen.bottom - CLEAR_PX;
    const start = beside ? [{ x: seen.right, y: g }] : [{ x: edgeX, y: g < seen.top ? seen.top : seen.bottom }, { x: edgeX, y: g }];
    for (const tx of turns) {
      const points = [...start, { x: tx, y: g }, card];
      if (!clear(points, avoid)) continue;
      if (!best || pathLength(points) < pathLength(best)) best = points;
      break;
    }
  }
  if (!best) return null;
  return { from: best[0], to: card, via: best.slice(1, -1), stub: false };
}

const contrast = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? ['(forced-colors: active)', '(prefers-contrast: more)'].map((q) => window.matchMedia(q))
  : [];
/** The line's color: the focus's own (as its outline), or the system's highlight under forced colors or more contrast. */
export const leaderColor = (focusColor: string): string => (contrast.some((q) => q.matches) ? 'Highlight' : focusColor);

const lineHeights = new WeakMap<Element, number>();
/** The card's title's first line's center, from the page's top; its line height read once per title. */
function titleRow(title: Element): number {
  const r = title.getBoundingClientRect();
  let line = lineHeights.get(title);
  if (line === undefined) {
    line = parseFloat(getComputedStyle(title).lineHeight);
    if (!Number.isFinite(line) || line <= 0) line = r.height;
    lineHeights.set(title, line);
  }
  return r.top + Math.min(r.height, line) / 2;
}

/** The floating wiki card over a stage, or null (collapsed, or a phone's bottom sheet). */
const cardOver = (host: Element): HTMLElement | null => {
  const card = host.closest('.stage-layout')?.querySelector<HTMLElement>('.wiki-panel:not(.is-sheet)');
  return card && card.offsetParent ? card : null;
};

/** A stage's canvas host, carrying the line it drew last, for the browser tests. */
export type LeaderHost = HTMLElement & { leaderLine?: LeaderLine | null };

export interface DrawLeader {
  /** The element the canvas fills: the stage's own pixels are its. */
  host: LeaderHost;
  space: OpenSpaceStore | undefined;
  /** The focused box under the camera, in the host's pixels; null when the stage draws none. */
  box: Box | null;
  /** The focus's own color, as the stage outlines it. */
  color: string;
  dpr: number;
  /** The other drawn boxes, in the host's pixels: the line never crosses one. */
  avoid: readonly Box[];
}

/**
 * Draws the leader line on a stage's canvas, over what it has painted: the card read where it is
 * now, the open space from the store. Call it at the end of each paint.
 */
export function drawLeaderLine(ctx: CanvasRenderingContext2D, { host, space, box, color, dpr, avoid }: DrawLeader) {
  const line = leaderFor(host, space, box, avoid);
  host.leaderLine = line;
  if (!line) return;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ctx.fillStyle = leaderColor(color);
  ctx.lineWidth = LEADER_WIDTH;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(line.from.x, line.from.y);
  for (const p of line.via) ctx.lineTo(p.x, p.y);
  ctx.lineTo(line.to.x, line.to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(line.from.x, line.from.y, LEADER_DOT, 0, 2 * Math.PI);
  if (!line.stub) {
    ctx.moveTo(line.to.x + LEADER_DOT, line.to.y);
    ctx.arc(line.to.x, line.to.y, LEADER_DOT, 0, 2 * Math.PI);
  }
  ctx.fill();
  if (line.stub) {
    // A small head at the edge, pointing on toward the box.
    const a = Math.atan2(line.to.y - line.from.y, line.to.x - line.from.x);
    const head = 2.5 * LEADER_DOT;
    ctx.beginPath();
    ctx.moveTo(line.to.x - head * Math.cos(a - 0.5), line.to.y - head * Math.sin(a - 0.5));
    ctx.lineTo(line.to.x, line.to.y);
    ctx.lineTo(line.to.x - head * Math.cos(a + 0.5), line.to.y - head * Math.sin(a + 0.5));
    ctx.stroke();
  }
  ctx.restore();
}

/** The line for a stage's host now: the card and the open space read in its pixels. */
function leaderFor(host: HTMLElement, space: OpenSpaceStore | undefined, box: Box | null, avoid: readonly Box[]): LeaderLine | null {
  const measure = space?.get();
  if (!box || !measure) return null;
  const card = cardOver(host);
  const stage = host.closest('.focus-stage');
  if (!card || !stage) return null;
  const at = host.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  const title = card.querySelector('.wiki-panel-title h2');
  // Level with the title's first line; kept on the card's scrolling part when the title has scrolled out of it.
  const scroller = card.querySelector('.wiki-panel-scroll')?.getBoundingClientRect() ?? c;
  const y = clamp(title ? titleRow(title) : c.top + c.height / 2, scroller.top + LEADER_DOT, scroller.bottom - LEADER_DOT);
  return leaderLine(box, { x: c.left - at.left, y: y - at.top }, insetIn(at, s, measure.open), insetIn(at, s, measure.frame), avoid);
}

/** The stage less some insets, in a host's pixels. */
const insetIn = (at: DOMRect, s: DOMRect, i: Insets): Box => ({ left: s.left + i.left - at.left, top: s.top + i.top - at.top, right: s.right - i.right - at.left, bottom: s.bottom - i.bottom - at.top });

/**
 * The open space (the stage less the floating panels) in a stage's host's pixels, cut to its `w` by `h` canvas: what a
 * box's sticky label stays within (graph/sticky.ts); the whole canvas when there is no open space to read.
 */
export function openIn(host: HTMLElement | null, space: OpenSpaceStore | undefined, w: number, h: number): Box {
  const whole = { left: 0, top: 0, right: w, bottom: h };
  const measure = space?.get();
  const stage = host?.closest('.focus-stage');
  if (!host || !measure || !stage) return whole;
  const o = insetIn(host.getBoundingClientRect(), stage.getBoundingClientRect(), measure.open);
  const cut = { left: Math.max(0, o.left), top: Math.max(0, o.top), right: Math.min(w, o.right), bottom: Math.min(h, o.bottom) };
  return cut.right - cut.left < 1 || cut.bottom - cut.top < 1 ? whole : cut;
}

/**
 * Draws a stage again, at once, when the card moves without the camera: a panel opening, closing or
 * resizing, the card among them (the open space changes), the card's page scrolling its title along,
 * or the card arriving where a transition of its own took it. `paint` is the stage's paint, run in the
 * same frame as the change.
 */
export function useLeaderFollow(host: { current: HTMLElement | null }, space: OpenSpaceStore | undefined, paint: () => void) {
  const latest = useRef(paint);
  latest.current = paint;
  useEffect(() => {
    const el = host.current;
    if (!el || !space) return;
    const now = () => latest.current();
    const off = space.subscribe(now);
    const layout = el.closest('.stage-layout');
    const onScroll = (e: Event) => { if (e.target instanceof Element && e.target.matches('.wiki-panel-scroll')) now(); };
    // The card moved by a transition of its own: drawn again where it ends up.
    const onMoved = (e: Event) => { if (e.target instanceof Element && e.target.matches('.wiki-panel')) now(); };
    layout?.addEventListener('scroll', onScroll, { capture: true, passive: true });
    for (const type of ['transitionend', 'transitioncancel']) layout?.addEventListener(type, onMoved);
    return () => {
      off();
      layout?.removeEventListener('scroll', onScroll, { capture: true });
      for (const type of ['transitionend', 'transitioncancel']) layout?.removeEventListener(type, onMoved);
    };
  }, [host, space]);
}
