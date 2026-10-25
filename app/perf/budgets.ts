// The app's performance budgets (LA-PAT-APP-UX-R30), judged on the production build in Chromium on
// the dev machine. The engine's budgets are in lathe/perf/engine.ts (LA-CHK-DR310).

export const BUDGETS = {
  /** The JavaScript the wiki's first load fetches (index.html's scripts and module preloads), gzipped. */
  firstLoadKb: 250,
  /** From navigation to a record page that is drawn and answers input. */
  interactiveMs: 1500,
  /** Main-thread work for a view switch, from the key press until the page is quiet again. */
  viewSwitchMs: 100,
  /** Main-thread work for a graph re-center at depth 3, from the click until the move has ended. */
  recenterMs: 100,
  /** The longest single frame in a re-center at depth 3: one frame at 60 Hz. */
  recenterFrameMs: 16,
} as const;

/** Above this one-minute load average the timings are measured and printed, but not judged (`not run (machine busy)`). */
export const MAX_LOAD = Number(process.env.PERF_MAX_LOAD ?? 12);
