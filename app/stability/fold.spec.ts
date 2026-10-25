import { expect, test } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { DOMAIN, FOCUS, SHELL } from './scenarios';

// LA-PLT-T72: folding a row and Expand all. The rows below a row that opens move down: that is
// the change itself. The row itself, the lists above it, the title and the frame must hold still,
// and nothing may jump and then correct.

test.describe('fold', () => {
  test('LA-PLT-T72 open and close one row', async ({ page }) => {
    await openPage(page, DOMAIN);
    const toggle = page.locator('.pane-wiki .tree-toggle').first();
    await toggle.scrollIntoViewIfNeeded();
    const row = page.locator('.pane-wiki .record-list.tree > li:has(.tree-toggle)').first();
    await row.evaluate((el) => el.setAttribute('data-stability', 'row'));
    const keys = [...SHELL, ...FOCUS, '[data-stability="row"] > .tree-row'];
    const allow = ['[data-stability="row"] ~ li', '[data-stability="row"] .tree-nested', '.pane-wiki .spec-section:has([data-stability="row"]) ~ *', '.pane-wiki .spec-body > :has([data-stability="row"]) ~ *'];
    const open = await step(page, 'fold', 'open a row', { keys, allow }, async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });
    expectStable(open);
    const close = await step(page, 'fold', 'close the row', { keys, allow }, async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });
    expectStable(close);
  });

  test('LA-PLT-T72 Expand all and Collapse all', async ({ page }) => {
    await openPage(page, DOMAIN);
    const bulk = page.locator('.pane-wiki').getByRole('button', { name: /^(Expand|Collapse) all$/ }).first();
    await bulk.scrollIntoViewIfNeeded();
    await bulk.evaluate((el) => el.closest('.spec-section')?.setAttribute('data-stability', 'section'));
    const keys = [...SHELL, ...FOCUS, '[data-stability="section"] > .spec-section-head'];
    const allow = ['[data-stability="section"] .record-list', '[data-stability="section"] ~ *', '.pane-wiki .spec-body > :has([data-stability="section"]) ~ *', '[data-stability="section"] .long-list'];
    const expand = await step(page, 'fold', 'Expand all', { keys, allow }, async () => {
      await bulk.click();
      await expect(bulk).toHaveText('Collapse all');
    });
    expectStable(expand);
    const collapse = await step(page, 'fold', 'Collapse all', { keys, allow }, async () => {
      await bulk.click();
      await expect(bulk).toHaveText('Expand all');
    });
    expectStable(collapse);
  });
});
