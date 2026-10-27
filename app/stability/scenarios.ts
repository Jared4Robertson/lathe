// Shared addresses and key elements for the stability scenarios.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const PRODUCT = '/LA';
export const DOMAIN = '/LA-EXP';
/** A use case with requirements, links and a long body. */
export const RECORD = '/LA-PLT-UC05';
/** An aggregate: its page offers the Model view. */
export const AGGREGATE = '/LA-EXP-A4';
/** A UC requirement of RECORD: what the edit scenarios change, then put back. */
export const EDITED = '/LA-PLT-UC05-R01';

/** The shell's frame: the nav and the page beside it. */
export const SHELL = ['nav#nav', '#main'];
/** A focus page's frame: the first pane's bar, its title and the side bar. */
export const FOCUS = ['.focus-views > .pane:first-of-type > .pane-bar', '.focus-views > .pane:first-of-type .pane-title', '.side-bar-column'];
export const GRAPH_CANVAS = '.pane-graph .graph-canvas';
export const GRAPH_HEADER = '.pane-graph .graph-header';
export const MODEL_CANVAS = '.pane-model .model-canvas';

/**
 * Keeps the served copy's data files as they are now, for a scenario that writes; the returned
 * function puts every file back and removes any the scenario added.
 */
export function keepData(): () => void {
  const dir = path.join(process.env.STABILITY_ROOT!, 'data');
  const before = new Map(readdirSync(dir).map((f) => [f, readFileSync(path.join(dir, f), 'utf8')]));
  return () => {
    for (const f of readdirSync(dir)) if (!before.has(f)) rmSync(path.join(dir, f));
    for (const [f, text] of before) {
      const file = path.join(dir, f);
      if (!existsSync(file) || readFileSync(file, 'utf8') !== text) writeFileSync(file, text);
    }
  };
}
