import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { DOMAIN, RECORD } from './scenarios';

// LA-PLT-T77: a live reload while the page is scrolled half-way. The suite edits a spec file in
// its copy of the specs (STABILITY_ROOT) while the page is open: the domain's body, above what
// is in view, gets one more paragraph; with the graph open, the record's body gets one at its
// end. What was at the top of the view must stay there, the scroll box must keep its place, and
// the frame and the graph must not be drawn anew.

const DOMAIN_FILE = 'specs/lathe/exploring/domain.md';
const RECORD_FILE = 'specs/lathe/platform/01-define/use-cases/UC05-see-each-command-s-shortcut-where-it-is-used.md';

/** Adds a paragraph to a spec file's body: at its top (above what is in view), or at its end. Returns the undo. */
function edit(name: string, paragraph: string, at: 'top' | 'end') {
  const file = path.join(process.env.STABILITY_ROOT!, name);
  const before = readFileSync(file, 'utf8');
  const after = at === 'end'
    ? `${before.trimEnd()}\n\n${paragraph}\n`
    : before.replace(/^(---\n[\s\S]*?\n---\n)/, `$1${paragraph}\n\n`);
  writeFileSync(file, after);
  return () => writeFileSync(file, before);
}

/** The element at the top of the wiki pane's view, and where it is. */
async function topVisible(page: Page) {
  return page.evaluate(() => {
    const box = document.querySelector('.pane-wiki .pane-scroll')!;
    const top = box.getBoundingClientRect().top;
    const all = [...box.querySelectorAll<HTMLElement>('li, h2, h3, p, tr')];
    const el = all.find((e) => e.getBoundingClientRect().top >= top && e.getBoundingClientRect().height > 0);
    return el ? { text: (el.textContent ?? '').trim().slice(0, 80), y: Math.round(el.getBoundingClientRect().top - top), scroll: box.scrollTop } : null;
  });
}

async function yOf(page: Page, text: string) {
  return page.evaluate((text) => {
    const box = document.querySelector('.pane-wiki .pane-scroll')!;
    const top = box.getBoundingClientRect().top;
    const el = [...box.querySelectorAll<HTMLElement>('li, h2, h3, p, tr')].find((e) => (e.textContent ?? '').trim().slice(0, 80) === text);
    return el ? Math.round(el.getBoundingClientRect().top - top) : null;
  }, text);
}

test.describe('live reload', () => {
  test('LA-PLT-T77 while scrolled half-way in the wiki', async ({ page }) => {
    await openPage(page, DOMAIN);
    await page.evaluate(() => {
      const box = document.querySelector('.pane-wiki .pane-scroll')!;
      box.scrollTop = (box.scrollHeight - box.clientHeight) / 2;
    });
    await page.waitForTimeout(300);
    const anchor = await topVisible(page);
    expect(anchor, 'something is in view').not.toBeNull();
    let restore = () => {};
    try {
      const r = await step(page, 'reload', 'spec edited while scrolled', { keys: ['nav#nav', '.pane-wiki > .pane-bar', '.pane-wiki .pane-scroll', '.side-bar-column'], settle: 1500 }, async () => {
        restore = edit(DOMAIN_FILE, 'A paragraph the stability suite adds while the page is open, above what is in view, to see that nothing in view moves when the specs reload.', 'top');
        await expect(page.locator('.pane-wiki')).toContainText('the stability suite adds', { timeout: 20_000 });
      });
      expectStable(r);
      expect.soft(await yOf(page, anchor!.text), `"${anchor!.text}" stays at the top of the view`).toBe(anchor!.y);
    } finally {
      restore();
    }
  });

  test('LA-PLT-T77 with the graph open', async ({ page }) => {
    await openPage(page, `${RECORD}?view=wiki,graph`);
    await page.locator('.pane-graph .graph-flow .graph-box').first().waitFor({ state: 'attached' });
    await page.waitForTimeout(500);
    let restore = () => {};
    try {
      const keys = ['.pane-graph .graph-canvas', '.pane-graph .graph-header', '.pane-graph .graph-flow canvas', '.pane-wiki > .pane-bar'];
      const r = await step(page, 'reload', 'spec edited with the graph open', { keys, allow: ['.pane-wiki .pane-scroll', '.side-bar'], settle: 1500 }, async () => {
        restore = edit(RECORD_FILE, 'Another paragraph from the stability suite, with the graph open.', 'end');
        await expect(page.locator('.pane-wiki')).toContainText('with the graph open', { timeout: 20_000 });
      });
      expectStable(r);
    } finally {
      restore();
    }
  });
});
