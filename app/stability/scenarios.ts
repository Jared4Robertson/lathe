// Shared addresses and key elements for the stability scenarios.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect } from './test';

export const PRODUCT = '/LA';
export const DOMAIN = '/LA-EXP';
/** A use case with requirements, links and a long body. */
export const RECORD = '/LA-PLT-UC07';
/** A use case others reference (pattern followings), so a request to remove it is refused and the data stays as it is. */
export const REFERENCED = '/LA-MOD-UC02';
/** An aggregate: its ERD stage draws its own diagram. */
export const AGGREGATE = '/LA-EXP-A1';
/** A UC requirement of RECORD: what the edit scenarios change, then put back. */
export const EDITED = '/LA-PLT-UC07-R08';

/** Lathe's own journey "Take an idea to proof", with its steps in order, each carrying out a use case: the journeys scenario and the journey page's audit. */
export const JOURNEY = '/LA-JR01';
/** A use case that is a step of JOURNEY: its In journeys fact leads back to the journey. */
export const JOURNEY_USE_CASE = '/LA-UCS-UC06';

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

/**
 * Waits until the page shows the checks' run of the data as it is now. A scenario's keepData put the files back, and
 * the server answers its last run at once while it checks the restored data again, so the next page may first show
 * the run of the scenario's writes (an added record past the strict check's accepted warnings is an error) and then
 * change. The served copy's own data has no error (lathe check), so its run is the one whose Checks row has counts and
 * no error.
 */
export async function checksCurrent(page: Page) {
  const badges = page.locator('nav#nav .nav-row', { hasText: 'Checks' }).locator('.nav-badges');
  await expect(badges.locator('.nav-badge')).not.toHaveCount(0, { timeout: 20_000 });
  await expect(badges.locator('.nav-badge.error')).toHaveCount(0, { timeout: 20_000 });
}
