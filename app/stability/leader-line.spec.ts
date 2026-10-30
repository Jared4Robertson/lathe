import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { openPage } from './measure';
import { AGGREGATE, STAGE } from './scenarios';

// LA-V96-R24-T02: the leader line from the focused box to the wiki card (LA-V96-R24), on every stage. Each
// stage's canvas host keeps the line it drew last (views/leaderLine.ts); the line must end on the card's
// inner edge, level with its title, start on the focused box, follow a pan in the same frame, stub at the
// open space's edge for a box panned out of view, and go with the card.

const HOST = `${STAGE} .graph-flow, ${STAGE} .erd-flow`;
interface Drawn { from: { x: number; y: number }; to: { x: number; y: number }; stub: boolean }

/** The line the stage drew last, in the page's pixels, with where the card's edge and title row are now. */
const lineNow = (page: Page) => page.evaluate((sel) => {
  const host = document.querySelector(sel) as HTMLElement & { leaderLine?: Drawn | null };
  const at = host.getBoundingClientRect();
  const card = document.querySelector('.wiki-panel')?.getBoundingClientRect() ?? null;
  const title = document.querySelector('.wiki-panel-title h2')?.getBoundingClientRect() ?? null;
  const l = host.leaderLine ?? null;
  const page = (p: { x: number; y: number }) => ({ x: p.x + at.left, y: p.y + at.top });
  return { line: l && { from: page(l.from), to: page(l.to), stub: l.stub }, cardLeft: card?.left ?? null, title: title ? { top: title.top, bottom: title.bottom } : null };
}, HOST);

/** Drags the stage by (dx, dy) from a point of its canvas clear of the panels. */
async function drag(page: Page, dx: number, dy: number) {
  const s = (await page.locator(STAGE).boundingBox())!;
  const x = s.x + s.width * 0.45;
  const y = s.y + s.height * 0.45;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

test.describe('the leader line', () => {
  for (const stage of ['graph', 'erd', 'trace'] as const) {
    test(`LA-V96-R24-T02 on the ${stage} stage, the leader line joins the focused box to the card's title, follows a pan, stubs for a box out of view and goes with the card`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openPage(page, `${stage === 'trace' ? '/LA-EXP-UC01' : AGGREGATE}?stage=${stage}`);
      await page.locator(HOST).first().waitFor();
      // Joined: from the box to the card's inner edge, level with its title.
      await expect.poll(async () => (await lineNow(page)).line?.stub, { message: 'a line is drawn to the card', timeout: 8000 }).toBe(false);
      const joined = await lineNow(page);
      expect(Math.abs(joined.line!.to.x - joined.cardLeft!), 'the line ends on the card\'s inner edge').toBeLessThan(1.5);
      expect(joined.line!.to.y, 'level with the title').toBeGreaterThanOrEqual(joined.title!.top);
      expect(joined.line!.to.y, 'level with the title').toBeLessThanOrEqual(joined.title!.bottom);
      // A pan moves the line's start with the box, in the frame the stage draws, never its end.
      await drag(page, -60, 40);
      await page.waitForTimeout(300);
      const panned = await lineNow(page);
      expect(panned.line!.to, 'the end stays on the card').toEqual(joined.line!.to);
      expect(panned.line!.from, 'the start follows the box').not.toEqual(joined.line!.from);
      // Panned far out of view: a stub at the open space's edge.
      await drag(page, 1400, 900);
      await expect.poll(async () => (await lineNow(page)).line?.stub, { message: 'a stub for a box out of view', timeout: 3000 }).toBe(true);
      // The card collapsed (Enter): no line.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('Enter');
      await expect(page.locator('.wiki-panel')).toHaveCount(0);
      await expect.poll(async () => (await lineNow(page)).line, { message: 'no line without the card', timeout: 3000 }).toBeNull();
    });
  }

  test('LA-V96-R24-T02 on a phone the card is a bottom sheet and no leader line is drawn', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, `${AGGREGATE}?stage=graph`, STAGE);
    await page.locator(HOST).first().waitFor();
    await page.waitForTimeout(800);
    expect((await lineNow(page)).line).toBeNull();
  });
});
