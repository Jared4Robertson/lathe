import { loadavg } from 'node:os';
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { MAX_LOAD } from './budgets';

// How the performance suite measures (LA-PAT-APP-UX-R11):
// - main-thread work: Chromium's own TaskDuration (every task on the page's main thread: script,
//   style, layout, paint, garbage collection), read through the DevTools protocol before and after
//   a step, so the work is counted whether or not it came in long frames;
// - the longest frame: the long animation frames (`long-animation-frame`, 50 ms or more) in the step;
// - memory: the JavaScript heap in use after a garbage collection.
// A step runs its action, then waits until no long frame has come for 300 ms.

export interface PerfResult {
  name: string;
  value: number;
  unit: 'ms' | 'KB' | 'MB' | 'frames';
  budget: number | null;
  /** 'ok', 'over', 'measured' (no budget) or 'not judged' (the machine was busy). */
  verdict: string;
  detail?: string;
  load: number;
}

declare global {
  interface Window { __perf: { loafs: { t: number; duration: number; blocking: number; scripts: string[] }[] } }
}

/** Collects long animation frames from the first frame on, with the scripts that ran longest in each. */
export async function installProbes(page: Page) {
  await page.addInitScript(() => {
    window.__perf = { loafs: [] };
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { blockingDuration?: number; scripts?: { duration: number; sourceFunctionName?: string; invoker?: string; sourceURL?: string }[] })[]) {
          const scripts = (e.scripts ?? []).sort((a, b) => b.duration - a.duration).slice(0, 3)
            .map((s) => `${Math.round(s.duration)}ms ${s.invoker ?? ''} ${s.sourceFunctionName ?? ''} ${(s.sourceURL ?? '').split('/').pop()}`.trim());
          window.__perf.loafs.push({ t: e.startTime, duration: e.duration, blocking: e.blockingDuration ?? 0, scripts });
        }
      }).observe({ type: 'long-animation-frame', buffered: true });
    } catch { /* not supported */ }
  });
}

const sessions = new WeakMap<Page, CDPSession>();
async function cdp(page: Page): Promise<CDPSession> {
  let s = sessions.get(page);
  if (!s) {
    s = await page.context().newCDPSession(page);
    await s.send('Performance.enable', { timeDomain: 'threadTicks' });
    sessions.set(page, s);
  }
  return s;
}

async function taskSeconds(page: Page): Promise<number> {
  const { metrics } = await (await cdp(page)).send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'TaskDuration')?.value ?? 0;
}

/** Waits `ms`, then until no long frame has come for 300 ms. */
export async function quiet(page: Page, ms = 600) {
  await page.waitForTimeout(ms);
  for (let i = 0; i < 30; i++) {
    const still = await page.evaluate(() => {
      const last = window.__perf.loafs.at(-1);
      return !!last && performance.now() - (last.t + last.duration) < 300;
    });
    if (!still) return;
    await page.waitForTimeout(150);
  }
}

/** Runs an action and measures the main-thread work and the longest frame until the page is quiet again. */
export async function work(page: Page, action: () => Promise<unknown>, settle = 600) {
  await quiet(page, 300);
  // Every frame's start, from requestAnimationFrame: a frame's length is the time to the next one,
  // so frames shorter than the long-animation-frame threshold (50 ms) are seen too.
  const t0 = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __framesOn: boolean };
    w.__frames = [];
    w.__framesOn = true;
    const tick = (t: number) => { w.__frames.push(t); if (w.__framesOn) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    return performance.now();
  });
  const before = await taskSeconds(page);
  await action();
  await quiet(page, settle);
  const after = await taskSeconds(page);
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __framesOn: boolean };
    w.__framesOn = false;
    return w.__frames;
  });
  const gaps = frames.slice(1).map((t, i) => t - frames[i]);
  const loafs = await page.evaluate((t0) => window.__perf.loafs.filter((l) => l.t >= t0), t0);
  const worst = loafs.reduce((w, l) => (l.duration > w.duration ? l : w), { t: 0, duration: 0, blocking: 0, scripts: [] as string[] });
  return {
    workMs: (after - before) * 1000,
    /** The longest frame: the longest time between two frames' starts, or the longest long animation frame. */
    worstFrameMs: Math.max(worst.duration, ...gaps),
    worst,
    /** Frames that took longer than one at 60 Hz (a dropped frame or more). */
    slowFrames: gaps.filter((g) => g > 20).length,
    frames: gaps.length,
  };
}

/** The JavaScript heap in use, in MB, after a garbage collection. */
export async function heapMb(page: Page): Promise<number> {
  const s = await cdp(page);
  await s.send('HeapProfiler.collectGarbage');
  const { metrics } = await s.send('Performance.getMetrics');
  return (metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0) / 1024 / 1024;
}

/** Records one measurement, and holds it to its budget unless the machine is busy. */
export async function record(r: Omit<PerfResult, 'verdict' | 'load'>): Promise<PerfResult> {
  const load = loadavg()[0];
  const busy = load > MAX_LOAD;
  const verdict = r.budget === null ? 'measured' : busy ? 'not judged' : (r.unit === 'KB' ? r.value <= r.budget : r.value < r.budget) ? 'ok' : 'over';
  const result: PerfResult = { ...r, value: Math.round(r.value * 10) / 10, verdict, load: Math.round(load * 10) / 10 };
  await test.info().attach(`perf: ${r.name}`, { body: JSON.stringify(result), contentType: 'application/json' });
  if (r.budget !== null && !busy) {
    const message = `${r.name}: ${result.value} ${r.unit}, budget ${r.budget} ${r.unit}${r.detail ? ` (${r.detail})` : ''}`;
    // A size budget is "or less"; a time budget is "under".
    if (r.unit === 'KB') expect.soft(r.value, message).toBeLessThanOrEqual(r.budget);
    else expect.soft(r.value, message).toBeLessThan(r.budget);
  }
  return result;
}
