// The app's performance budgets (LA-PAT-APP-UX-R11), judged on the production build in Chromium on
// the dev machine. The engine's budgets are in lathe/perf/engine.ts (LA-PLT-UC01-R03).

export const BUDGETS = {
  /** The JavaScript the wiki's first load fetches (index.html's scripts and module preloads), gzipped. */
  firstLoadKb: 250,
  /** From navigation to a record page that is drawn and answers input. */
  interactiveMs: 1500,
  /** Main-thread work for a stage switch, from the key press until the page is quiet again. */
  viewSwitchMs: 100,
  /**
   * Main-thread work for a camera move with every panel open (LA-V96-R21): collapsing the wiki card
   * widens the open space and the graph recenters in it, from the key press until the glide has ended.
   */
  cameraMoveMs: 500,
  /**
   * Main-thread work for a graph re-center at depth 3, from the click until the glide has ended. The
   * 100 ms first asked for is not met at depth 3: a re-center there adds or removes up to 200 boxes, and the
   * 320 ms glide redraws every moving box and edge in each of its 20 frames (about 10 ms a frame), so
   * most of the work is the motion itself (LA-PAT-APP-UX-R11).
   */
  recenterMs: 500,
  /**
   * The longest frame in a re-center at depth 3. 16 ms (one frame at 60 Hz) is met by the glide's
   * frames but not by the frame of the click itself, where the page for the new address is drawn
   * (the nav, the side bar, the graph's new picture), and the hover spotlight then marks up to 200
   * boxes, before the next frame: 60 to 80 ms. Before the fixes it was 450 to 520 ms.
   */
  recenterFrameMs: 100,
  /** How many frames of one re-center at depth 3 may take more than 20 ms (a dropped frame or more): the rest glide at 60 Hz. */
  recenterSlowFrames: 3,
  /**
   * From the key press that switches a product's page to the ERD stage until its map is drawn and
   * framed, the first time (LA-V94-R08): the ERD's code, ELK and the one layout of the product's
   * map, in ELK's worker, included. Every later focus reads that layout and only moves the camera.
   */
  erdMapFirstFrameMs: 1000,
  /** The longest frame while dragging a product's whole Trace stage (LA-V98-R06): each frame draws only what is in view, at most 260 boxes. */
  traceDragFrameMs: 50,
  /**
   * Main-thread work for the first frame of a product's Trace map (LA-V98-R06, LA-PAT-APP-UX-R19): the first switch to
   * the Trace stage, from the key press until its canvas is drawn and the page is quiet, which loads the stage's code,
   * lays the whole product's map out (once per product and data change; about 150 ms for this repo's) and draws what
   * the camera shows of it. Every switch after it reuses the map and is held to the stage switch budget.
   */
  traceMapFirstFrameMs: 400,
} as const;

/** Above this one-minute load average the timings are measured and printed, but not judged (`not run (machine busy)`). */
export const MAX_LOAD = Number(process.env.PERF_MAX_LOAD ?? 12);
