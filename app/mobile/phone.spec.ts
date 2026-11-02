import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '../stability/test';
import { showCard } from '../stability/measure';
import { AGGREGATE, DOMAIN, EDITED, PRODUCT, RECORD } from '../stability/scenarios';
import { CHECKS, type Finding } from './measure';
import type { Found } from './reporter';

// LA-STD-EXPERIENCE-R13-T01: on a phone nothing is cut off, overlapping, unreachable or too small to tap. Every stage,
// every view over the stage and one record of each kind (its page read in the wiki card's sheet, as the Reader does)
// is opened on each phone of mobile/playwright.config.ts and measured by the five checks of mobile/measure.ts. A page
// is one test, so a failure names the page, the phone and each element, with a cropped screenshot of it.

const here = path.dirname(fileURLToPath(import.meta.url));
/** The maps the Reader pans and zooms: what they hold is reached by panning, not scrolling. */
const PANNABLE = '.graph-flow, .erd-canvas';

interface Visit { name: string; open: (page: Page) => Promise<void> }

/** Opens an address and waits for the app to have its specs and settle. */
async function go(page: Page, url: string, ready?: string) {
  await page.goto(url);
  await page.locator('.app[data-specs="ready"]').first().waitFor();
  if (ready) await page.locator(ready).first().waitFor({ state: 'attached' });
  await page.waitForTimeout(700);
}

/** A record's page: on a phone it is read in the wiki card's sheet, opened whole. */
async function record(page: Page, id: string) {
  await go(page, `/${id}`);
  const show = page.getByRole('button', { name: 'Show the wiki card' });
  if (await show.isVisible()) {
    await show.tap();
    await page.locator('.wiki-panel').first().waitFor();
    if (await page.locator('.wiki-panel .wiki-panel-more').count()) await showCard(page, 'whole');
    await page.waitForTimeout(500);
  }
}

const VIEWS: Visit[] = [
  { name: 'products picker', open: (p) => go(p, '/', '.products-picker') },
  { name: 'product page', open: (p) => go(p, PRODUCT, '.header-strip h1') },
  { name: 'domain page', open: (p) => go(p, DOMAIN, '.header-strip h1') },
  { name: 'group page', open: (p) => go(p, `${DOMAIN}/technical-specification`, '.header-strip h1') },
  { name: 'Graph stage', open: (p) => go(p, `${RECORD}?stage=graph`, '.focus-stage .graph-flow') },
  { name: 'ERD stage', open: (p) => go(p, `${AGGREGATE}?stage=erd`, '.focus-stage .erd-canvas') },
  { name: 'Trace stage', open: (p) => go(p, `${EDITED}?stage=trace`, '.focus-stage :is(.trace-flow, .trace-list)') },
  { name: 'Checks panel', open: (p) => go(p, `${PRODUCT}?panel=checks`, '.checks-panel') },
  { name: 'Changes panel', open: (p) => go(p, `${PRODUCT}?panel=changes`) },
  { name: 'Appearance popover', open: (p) => go(p, `${PRODUCT}?panel=appearance`, '.appearance-popover') },
  { name: 'Format page', open: (p) => go(p, `${PRODUCT}?page=format`, '.wiki-panel.is-format') },
  { name: 'Kind page', open: (p) => go(p, `${RECORD}?page=format/kinds/use_case`, '.wiki-panel.is-format') },
  { name: 'Check page', open: (p) => go(p, `${PRODUCT}?page=format/checks/shared-module-group-unknown`, '.wiki-panel.is-format') },
  { name: 'nav drawer', open: async (p) => {
    await go(p, RECORD, '.header-strip h1');
    await p.getByRole('button', { name: 'Open the navigation' }).tap();
    await p.locator('nav#nav').waitFor();
    await p.waitForTimeout(500);
  } },
  { name: 'quick find', open: async (p) => {
    await go(p, RECORD, '.header-strip h1');
    await p.locator('.topbar').getByRole('button', { name: 'Quick find' }).tap();
    await p.locator('.quick-open input').fill('graph');
    await p.locator('.quick-open .palette-list li').first().waitFor();
    await p.waitForTimeout(400);
  } },
];

/** One record of each kind: the first of each data table that has IDs, from the served copy of the repo. */
function kinds(): Visit[] {
  const dir = path.join(process.env.STABILITY_ROOT!, 'data');
  const visits: Visit[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
    const kind = file.slice(0, -'.jsonl'.length);
    // A check is a view over the stage (the Check page above), and the product's page is visited above.
    if (kind === 'check' || kind === 'product') continue;
    const first = readFileSync(path.join(dir, file), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { id?: string }).find((r) => r.id);
    if (first?.id) visits.push({ name: `${kind} ${first.id}`, open: (p) => record(p, first.id!) });
  }
  return visits;
}

const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

/** Runs every check, and crops a screenshot of each finding (the first three of each check on a page). */
async function measure(page: Page, info: TestInfo, visit: string): Promise<Found[]> {
  const dir = path.join(here, 'results/shots', info.project.name, slug(visit));
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, 'page.png') });
  const size = page.viewportSize()!;
  const found: Found[] = [];
  for (const [name, check] of Object.entries(CHECKS)) {
    const findings: Finding[] = await check(page, { pannable: PANNABLE });
    for (const [i, f] of findings.entries()) {
      let shot = '';
      if (i < 3) {
        const x = Math.max(0, f.box.x - 16), y = Math.max(0, f.box.y - 16);
        const clip = { x, y, width: Math.min(size.width, f.box.x + f.box.width + 16) - x, height: Math.min(size.height, f.box.y + f.box.height + 16) - y };
        shot = path.join(dir, `${slug(name)}-${i + 1}.png`);
        if (clip.width > 4 && clip.height > 4) await page.screenshot({ path: shot, clip });
        else shot = path.join(dir, 'page.png');
      }
      found.push({ ...f, phone: info.project.name, page: visit, shot });
    }
  }
  return found;
}

const line = (f: Found) => `${f.check}: ${f.role} "${f.name.slice(0, 40)}" ${f.selector} — ${f.detail}${f.shot ? ` [${path.relative(here, f.shot)}]` : ''}`;

test.describe('LA-STD-EXPERIENCE-R13-T01 on a phone nothing is cut off, overlapping, unreachable or too small to tap', () => {
  for (const visit of [...VIEWS, ...kinds()]) {
    test(visit.name, async ({ page }, info) => {
      await visit.open(page);
      const found = await measure(page, info, visit.name);
      await info.attach('phone findings', { body: JSON.stringify(found), contentType: 'application/json' });
      expect(found.map(line), `${found.length} phone finding(s) on ${visit.name}`).toEqual([]);
    });
  }
});
