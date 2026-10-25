import { expect, test, type Page } from '@playwright/test';

// What the stability suite measures in each step of a scenario (LA-PAT-APP-UX-R08):
// - every layout shift, from a PerformanceObserver for `layout-shift`, including the ones the
//   browser leaves out of CLS because they came just after input (`hadRecentInput`), flagged;
// - long animation frames (`long-animation-frame`), where the page could not paint in time;
// - the boxes of key elements, frame by frame, so a box that moves, or jumps and then corrects,
//   or is thrown away and drawn anew (a remount), is caught even when no shift is reported.
// A shift is "allowed" when every node it moved sits inside one of the step's `allow` selectors:
// the thing the step means to change, such as the panes when a pane opens. Everything else is
// unexpected, and a step's unexpected shifts must add up to at most BUDGET. Transforms and
// opacity never count as layout shifts, so a tokened glide or fade (UX-R04) is free.

/** The unexpected layout shift a step may have (UX-R08). */
export const BUDGET = 0.01;

/**
 * Parts of the app whose fixes wait on other work. A shift that only moves nodes inside these is
 * reported as `deferred` and listed in notes/jitter-audit.md, but is not held to the budget yet.
 * Brief 53's phase 2 emptied it (the nav and the tab strip are held to the budget): keep it empty.
 */
export const DEFERRED: string[] = [];

export interface Rect { x: number; y: number; width: number; height: number }
export interface ShiftSource { node: string; from: Rect | null; to: Rect | null; allowed: boolean; deferred: boolean }
export interface Shift { t: number; value: number; recentInput: boolean; allowed: boolean; deferred: boolean; sources: ShiftSource[] }
export interface Loaf { t: number; duration: number; blocking: number }
export interface Track {
  selector: string;
  /** Each distinct box the element had, in order (null while it was not on the page). */
  boxes: (Rect | null)[];
  /** How many times the element was replaced by a new one (a remount). */
  remounts: number;
}
export interface StepResult {
  scenario: string;
  step: string;
  /** Every shift in the step, as CLS would add them up with input included. */
  total: number;
  /** The shifts no `allow` selector explains: what the budget limits. */
  unexpected: number;
  /** Shifts only inside DEFERRED parts: measured and listed, not yet held to the budget. */
  deferred: number;
  /** The part of `total` that came just after input (which CLS itself leaves out). */
  afterInput: number;
  shifts: Shift[];
  longFrames: { count: number; worst: number };
  tracks: Track[];
  /** Key elements that were never on the page in the step: a selector that no longer matches. */
  missing: string[];
  /** Key elements that moved, resized, jumped back or were remounted. */
  moved: { selector: string; why: string; boxes: (Rect | null)[] }[];
}

export interface StepOptions {
  /** Elements that must keep their box through the step (and not be remounted). */
  keys?: string[];
  /** What the step changes on purpose: shifts of nodes inside these do not count. */
  allow?: string[];
  /** Keys that may change their box (the step resizes them), but must not jump back or remount. */
  resizes?: string[];
  /** Keys that may be absent (a step that closes them, or a page that has none). */
  optional?: string[];
  /** How long to wait for the page to settle after the action, in ms. */
  settle?: number;
}

declare global {
  interface Window {
    __stability: {
      shifts: Shift[];
      loafs: Loaf[];
      allow: string[];
      tracks: Map<string, { boxes: (Rect | null)[]; remounts: number; el: Element | null }> | null;
      track: (selectors: string[]) => void;
      untrack: () => Track[];
    };
  }
}

/** Installed before any of the page's scripts run, so the first load's shifts are seen too. */
function probes({ firstKeys, deferred }: { firstKeys: string[]; deferred: string[] }) {
  const round = (n: number) => Math.round(n * 2) / 2;
  const rect = (r: DOMRectReadOnly | null | undefined): Rect | null =>
    r ? { x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height) } : null;
  const describe = (node: Node | null | undefined): string => {
    if (!node) return '(gone)';
    const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
    if (!el) return '#text';
    const parts: string[] = [];
    let at: Element | null = el;
    for (let i = 0; at && at !== document.body && i < 5; i++, at = at.parentElement) {
      let s = at.tagName.toLowerCase();
      if (at.id) s += `#${at.id}`;
      const classes = [...at.classList].filter((c) => !c.startsWith('react-flow__node-')).slice(0, 3);
      if (classes.length) s += `.${classes.join('.')}`;
      parts.unshift(s);
    }
    return parts.join(' > ') + (node.nodeType === 3 ? ' > #text' : '');
  };
  const S: Window['__stability'] = {
    shifts: [],
    loafs: [],
    allow: [],
    tracks: null,
    track: () => {},
    untrack: () => [],
  };
  window.__stability = S;
  const inside = (node: Node | null | undefined, list: string[]) => {
    const el = node ? (node.nodeType === 1 ? (node as Element) : node.parentElement) : null;
    return !!el && list.some((sel) => !!el.closest(sel));
  };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] })[]) {
        const sources = (e.sources ?? []).map((s) => ({ node: describe(s.node), from: rect(s.previousRect), to: rect(s.currentRect), allowed: inside(s.node, S.allow), deferred: inside(s.node, deferred) }));
        // A source whose node was removed before the shift was reported (old content being replaced)
        // cannot be placed; it neither explains nor condemns the shift: the other sources decide.
        const placed = sources.filter((s) => s.node !== '(gone)');
        const allowed = placed.length > 0 && placed.every((s) => s.allowed);
        S.shifts.push({ t: e.startTime, value: e.value, recentInput: e.hadRecentInput, sources, allowed, deferred: !allowed && placed.length > 0 && placed.every((s) => s.allowed || s.deferred) });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* not supported */ }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { blockingDuration?: number })[]) {
        S.loafs.push({ t: e.startTime, duration: e.duration, blocking: e.blockingDuration ?? 0 });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch { /* not supported */ }

  let raf = 0;
  const same = (a: Rect | null, b: Rect | null) => (a === null || b === null ? a === b : a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);
  const sample = () => {
    if (!S.tracks) return;
    for (const [selector, t] of S.tracks) {
      const el = document.querySelector(selector);
      if (el && t.el && el !== t.el && t.el.isConnected === false) t.remounts++;
      if (el) t.el = el;
      const box = el ? rect(el.getBoundingClientRect()) : null;
      if (!same(box, t.boxes[t.boxes.length - 1] ?? null) || t.boxes.length === 0) t.boxes.push(box);
    }
  };
  const loop = () => { sample(); raf = requestAnimationFrame(loop); };
  S.track = (selectors) => {
    cancelAnimationFrame(raf);
    S.tracks = new Map(selectors.map((s) => [s, { boxes: [], remounts: 0, el: null }]));
    sample();
    raf = requestAnimationFrame(loop);
  };
  S.untrack = () => {
    sample();
    cancelAnimationFrame(raf);
    const out = [...(S.tracks ?? new Map())].map(([selector, t]) => ({ selector, boxes: t.boxes, remounts: t.remounts }));
    S.tracks = null;
    return out;
  };
  if (firstKeys.length > 0) S.track(firstKeys);
}

/** Starts the probes on a page; `firstKeys` are tracked from the very first frame (for a first load). */
export async function installProbes(page: Page, firstKeys: string[] = []) {
  await page.addInitScript(probes, { firstKeys, deferred: DEFERRED });
  // The scenarios read every page with the side bar (the inspector) open, as a Reader who opened it
  // in the Wiki view too (it starts closed there, brief 64); a choice made in a scenario is kept.
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('lathe:side-bar')) {
        const open = { open: true, view: 'details' };
        localStorage.setItem('lathe:side-bar', JSON.stringify({ wiki: open, graph: open, model: open }));
      }
    } catch { /* storage unavailable: the defaults apply */ }
  });
}

const sum = (shifts: Shift[]) => Math.round(shifts.reduce((n, s) => n + s.value, 0) * 10000) / 10000;

/** Drops leading nulls (not yet drawn) and a trailing null (gone at the end of a step that leaves the page). */
function movesOf(tracks: Track[], resizes: string[]): StepResult['moved'] {
  const moved: StepResult['moved'] = [];
  for (const t of tracks) {
    const boxes = t.boxes.slice(t.boxes.findIndex((b) => b !== null));
    if (t.boxes.every((b) => b === null)) continue;
    const drawn = boxes.filter((b): b is Rect => b !== null);
    if (t.remounts > 0) { moved.push({ selector: t.selector, why: `remounted ${t.remounts}x`, boxes }); continue; }
    if (boxes.includes(null)) { moved.push({ selector: t.selector, why: 'went away and came back', boxes }); continue; }
    if (drawn.length <= 1) continue;
    if (resizes.includes(t.selector)) {
      // A resize may change the box as often as the drag moves, but must not come back to a box it left (a jump back).
      const seen = drawn.map((b) => `${b.x},${b.y},${b.width},${b.height}`);
      const back = seen.some((s, i) => seen.indexOf(s) !== i);
      if (back) moved.push({ selector: t.selector, why: 'jumped back to an earlier box', boxes });
      continue;
    }
    const first = drawn[0];
    const moves = drawn.slice(1).map((b) => Math.max(Math.abs(b.x - first.x), Math.abs(b.y - first.y), Math.abs(b.width - first.width), Math.abs(b.height - first.height)));
    moved.push({ selector: t.selector, why: `moved or resized up to ${Math.max(...moves)}px over ${drawn.length - 1} change(s)`, boxes });
  }
  return moved;
}

/** Waits for the page to stop shifting: `settle` ms, then until no shift has come for 250 ms. */
async function settle(page: Page, ms: number) {
  await page.waitForTimeout(ms);
  for (let i = 0; i < 20; i++) {
    const quiet = await page.evaluate(() => {
      const last = window.__stability.shifts.at(-1);
      return !last || performance.now() - last.t > 250;
    });
    if (quiet) return;
    await page.waitForTimeout(150);
  }
}

const results: StepResult[] = [];

/** Runs one step of a scenario and measures it. */
export async function step(page: Page, scenario: string, name: string, options: StepOptions, action: () => Promise<unknown>): Promise<StepResult> {
  const keys = options.keys ?? [];
  const t0 = await page.evaluate(({ keys, allow }) => {
    window.__stability.allow = allow;
    window.__stability.track(keys);
    return performance.now();
  }, { keys, allow: options.allow ?? [] });
  await action();
  return finish(page, scenario, name, options, t0);
}

/** Loads a page and measures its first load, from the first frame. */
export async function firstLoad(page: Page, scenario: string, url: string, options: StepOptions & { ready?: string }): Promise<StepResult> {
  await installProbes(page, options.keys ?? []);
  await page.goto(url);
  await page.locator(options.ready ?? '.app[data-specs="ready"]').first().waitFor();
  await page.evaluate((allow) => { window.__stability.allow = allow; }, options.allow ?? []);
  return finish(page, scenario, 'first load', { settle: 1500, ...options }, 0);
}

/** Opens a page to start a scenario from, without measuring the load, and waits for it to settle. */
export async function openPage(page: Page, url: string, ready = '.focus-views .pane-title') {
  await installProbes(page);
  await page.goto(url);
  await page.locator(ready).first().waitFor();
  await settle(page, 600);
}

async function finish(page: Page, scenario: string, name: string, options: StepOptions, t0: number): Promise<StepResult> {
  const everything = (options.allow ?? []).includes("*");
  await settle(page, options.settle ?? 900);
  const { shifts, loafs, tracks } = await page.evaluate((t0) => ({
    shifts: window.__stability.shifts.filter((s) => s.t >= t0),
    loafs: window.__stability.loafs.filter((l) => l.t >= t0),
    tracks: window.__stability.untrack(),
  }), t0);
  const result: StepResult = {
    scenario,
    step: name,
    total: sum(shifts),
    unexpected: sum(shifts.filter((s) => !s.allowed && !s.deferred && !everything)),
    deferred: sum(shifts.filter((s) => s.deferred && !everything)),
    afterInput: sum(shifts.filter((s) => s.recentInput)),
    shifts,
    longFrames: { count: loafs.length, worst: Math.round(Math.max(0, ...loafs.map((l) => l.duration))) },
    tracks,
    moved: movesOf(tracks, options.resizes ?? []),
    missing: tracks.filter((t) => t.boxes.every((b) => b === null) && !(options.optional ?? []).includes(t.selector)).map((t) => t.selector),
  };
  results.push(result);
  await test.info().attach(`stability: ${name}`, { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  return result;
}

/** A one-line account of what moved, for a failing expectation. */
export function explain(r: StepResult): string {
  const shifts = r.shifts.filter((s) => !s.allowed && !s.deferred).flatMap((s) => s.sources.filter((x) => !x.allowed).map((x) => `  ${s.value.toFixed(4)} ${x.node} ${JSON.stringify(x.from)} -> ${JSON.stringify(x.to)}`));
  const moved = r.moved.map((m) => `  ${m.selector}: ${m.why}`);
  return [`${r.scenario} / ${r.step}: unexpected ${r.unexpected} (total ${r.total})`, ...shifts.slice(0, 12), ...moved].join('\n');
}

/** UX-R08: at most BUDGET of unexpected shift, and no key element moves. */
export function expectStable(r: StepResult) {
  expect.soft(r.unexpected, explain(r)).toBeLessThanOrEqual(BUDGET);
  expect.soft(r.moved, explain(r)).toEqual([]);
  expect.soft(r.missing, `${r.scenario} / ${r.step}: key elements not found`).toEqual([]);
}
