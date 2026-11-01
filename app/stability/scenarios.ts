// Shared addresses and key elements for the stability scenarios.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const PRODUCT = '/LA';
export const DOMAIN = '/LA-EXP';
/** A use case with requirements, links and a long body. */
export const RECORD = '/LA-PLT-UC07';
/** A use case others reference (pattern followings), so a request to remove it is refused and the data stays as it is. */
export const REFERENCED = '/LA-AUT-UC02';
/** An aggregate: its ERD stage draws its own diagram. */
export const AGGREGATE = '/LA-EXP-A1';
/** A UC requirement of RECORD: what the edit scenarios change, then put back. */
export const EDITED = '/LA-PLT-UC07-R08';

/** Lathe's own journey "Take a new use case to proof", with its steps in order and a step that carries out nothing yet: the journeys scenario and the journey page's audit. */
export const JOURNEY = '/LA-JR01';
/** A use case that is a step of JOURNEY: its In journeys fact leads back to the journey. */
export const JOURNEY_USE_CASE = '/LA-AUT-UC06';

/** The shell's frame: the nav and the page beside it. */
export const SHELL = ['nav#nav', '#main'];
/** A focus page's frame: the floating page bar, the header strip and the wiki card (each holds still while what it shows changes). */
export const FOCUS = ['.page-bar-actions', '.header-strip', '.wiki-panel'];
/** The stage, behind every panel. */
export const STAGE = '.focus-stage';
export const GRAPH_CANVAS = '.focus-stage .graph-canvas';
/** The graph's toolbar, floating at the top of the open space. */
export const GRAPH_TOOLS = '.focus-stage .stage-tools';
export const ERD_CANVAS = '.focus-stage .erd-canvas';

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
