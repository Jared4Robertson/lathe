import { expect, type Page } from '@playwright/test';
import type { Scene, SceneBox, SceneHost } from '../src/graph/GraphPage';
import type { TraceHost, TraceScene } from '../src/trace/TraceCanvas';

// The graph as its canvas draws it (LA-UI92), read through the canvas's test hook: every drawn
// box with its place on screen and in the map, its label lines and their font sizes, its badges,
// and the camera. The boxes' keyboard layer (`.graph-box`) carries focus and names.

export const GRAPH = '.focus-stage .graph-flow';

/** What the graph stage's canvas draws now. */
export const sceneOf = (page: Page): Promise<Scene> => page.evaluate((sel) => (document.querySelector(sel) as SceneHost).graphScene!(), GRAPH);
/** A drawn box, or undefined. */
export const boxOf = async (page: Page, id: string): Promise<SceneBox | undefined> => (await sceneOf(page)).boxes.find((b) => b.id === id);
/** The camera, as one comparable string. */
export const cameraOf = async (page: Page) => JSON.stringify((await sceneOf(page)).camera);
/** Waits for the graph to draw its boxes (the keyboard layer holds them), then for the camera to settle. */
export async function graphDrawn(page: Page, layout?: string, settle = 500) {
  await page.locator(`${layout ? `${GRAPH}[data-layout="${layout}"]` : GRAPH} .graph-box`).first().waitFor({ state: 'attached' });
  await page.waitForTimeout(settle);
}

/** Waits until a box is drawn as the focus. */
export const focusDrawn = (page: Page, id: string) => page.waitForFunction(({ sel, id }) => !!(document.querySelector(sel) as SceneHost).graphScene?.().boxes.some((b) => b.id === id && b.focus), { sel: GRAPH, id });

/**
 * A point on a drawn box where the pointer finds it, inside the canvas and clear of the camera's
 * buttons and the edge hints: near its label's middle, or anywhere on its visible part. Null when
 * none of it can be pointed at.
 */
export async function pointOnBox(page: Page, id: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate(({ sel, id }) => {
    const host = document.querySelector(sel) as SceneHost;
    const s = host.graphScene!();
    const b = s.boxes.find((x) => x.id === id);
    if (!b) return null;
    const c = s.canvas;
    const area = { left: c.left + 60, right: c.left + c.width - 30, top: c.top + 20, bottom: c.top + c.height - 30 };
    const clear = (x: number, y: number) => {
      if (x < area.left || x > area.right || y < area.top || y > area.bottom) return false;
      return document.elementFromPoint(x, y)?.tagName === 'CANVAS' && host.graphHit!(x, y) === id;
    };
    const label = { x: b.label.left + b.label.width / 2, y: b.label.top + b.label.height / 2 };
    if (clear(label.x, label.y)) return label;
    const left = Math.max(area.left, b.rect.left);
    const right = Math.min(area.right, b.rect.left + b.rect.width);
    const top = Math.max(area.top, b.rect.top);
    const bottom = Math.min(area.bottom, b.rect.top + b.rect.height);
    for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) {
      const x = left + ((right - left) * i) / 12;
      const y = top + ((bottom - top) * j) / 12;
      if (right > left && bottom > top && clear(x, y)) return { x, y };
    }
    return null;
  }, { sel: GRAPH, id });
}

/** Clicks a drawn box on the canvas, where the pointer finds it. */
export async function clickBox(page: Page, id: string) {
  const at = await pointOnBox(page, id);
  expect(at, `${id} can be pointed at on the canvas`).not.toBeNull();
  await page.mouse.click(at!.x, at!.y);
}

/** Every drawn box's place and size in the map. */
export const placesOf = async (page: Page) => Object.fromEntries((await sceneOf(page)).boxes.map((b) => [b.id, JSON.stringify(b.map)]));

/**
 * The record boxes (not the focus) a click can reach: wholly inside the canvas but for its bottom
 * edge, at least 24 px tall, with a point on them where the pointer finds them.
 */
export async function reachableBoxes(page: Page): Promise<{ id: string; at: { x: number; y: number } }[]> {
  const s = await sceneOf(page);
  const c = s.canvas;
  const out: { id: string; at: { x: number; y: number } }[] = [];
  for (const b of s.boxes) {
    if (!b.id.startsWith('LA-') || b.focus) continue;
    const r = b.rect;
    if (r.height < 24 || r.left < c.left || r.left + 40 > c.left + c.width || r.top < c.top || r.top + r.height > c.top + c.height - 40) continue;
    const at = await pointOnBox(page, b.id);
    if (at) out.push({ id: b.id, at });
  }
  return out;
}

/**
 * The label lines that do not fit their box (LA-PAT-APP-UX-R12): a line wider as drawn than its
 * place, or outside its box, on the boxes on screen. Lines drawn as bars are measured as placed.
 */
export const clippedLabels = (page: Page) => page.evaluate((sel) => {
  const s = (document.querySelector(sel) as SceneHost).graphScene!();
  const c = s.canvas;
  const out: string[] = [];
  for (const b of s.boxes) {
    const r = b.rect;
    if (r.top + r.height < c.top || r.top > c.top + c.height || r.left + r.width < c.left || r.left > c.left + c.width) continue;
    if (b.lines.length === 0) out.push(`${b.id}: no label`);
    // Half a map unit to spare, on screen, and half a pixel: the bar the page's own text was held to.
    const tol = 0.5 * s.camera.zoom + 0.5;
    for (const l of b.lines) {
      if (l.drawnWidth > l.rect.width + tol) out.push(`${b.id} "${l.text}": ${l.drawnWidth.toFixed(1)} wide in ${l.rect.width.toFixed(1)}`);
      if (l.rect.left < r.left - tol || l.rect.left + l.drawnWidth > r.left + r.width + tol || l.rect.top < r.top - tol || l.rect.top + l.rect.height > r.top + r.height + tol) out.push(`${b.id} "${l.text}": outside its box`);
    }
  }
  return out;
}, GRAPH);

// ---------- The Trace stage's canvas (LA-V98), read the same way ----------

export const TRACE = '.focus-stage .trace-flow';

/** Waits for the Trace stage's canvas to be laid out and drawn, then for the camera to settle. */
export async function traceDrawn(page: Page, settle = 400) {
  await page.locator(`${TRACE}[data-ready]`).first().waitFor({ state: 'attached' });
  await page.waitForTimeout(settle);
}

/** What the Trace stage's canvas draws now, or (`whole`) every box of the product's map. */
export const traceSceneOf = (page: Page, whole = false): Promise<TraceScene> =>
  page.evaluate(({ sel, whole }) => (document.querySelector(sel) as TraceHost).traceScene!(whole), { sel: TRACE, whole });
