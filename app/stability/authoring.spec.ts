import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from './test';
import { openPage } from './measure';
import { keepData, RECORD } from './scenarios';

// Authoring's flow that the Reader walks in the app: reading how each kind and check works, from
// where they are, without leaving the workbench. The flows run from the command line are in
// lathe/test/flows/authoring.test.ts.

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROBLEM = 'LA-AUT-UC14-R98';

/** Adds a UC requirement no step fulfills to the suite's copy of the data, so it has problems to follow to their check; the caller puts the data back. */
function seedProblem() {
  execFileSync('node', [path.join(repo, 'lathe/bin/lathe.ts'), 'use-case', 'add-uc-requirement', '--id', PROBLEM, '--title', 'A requirement the suite leaves unmet', '--use_case_id', 'LA-AUT-UC14', '--statement', 'The Reader MUST find this requirement unmet.', '--root', process.env.STABILITY_ROOT!], { stdio: 'pipe' });
  return `/${PROBLEM}`;
}

test.describe('Authoring flows', () => {
  test('LA-AUT-UC14-FL-T look up a kind or check', async ({ page }) => {
    const restore = keepData();
    try {
      const WITH_PROBLEM = seedProblem();
      // S01: the record format, from the command palette.
      await openPage(page, RECORD);
      await page.keyboard.press('Control+Shift+p');
      await page.locator('.quick-open input').waitFor();
      await page.keyboard.type('Record format');
      await page.keyboard.press('Enter');
      // Format pages open in the wiki card over the stage, which keeps its focus (LA-PAT-APP-UX-R20).
      await page.waitForURL((u) => u.pathname === RECORD && u.search.endsWith('page=format'));
      const card = page.locator('.wiki-panel.is-format');
      await expect(card.locator('h2').first()).toHaveText('Record format');
      await expect(card.getByRole('heading', { name: 'How records are kept', level: 2 })).toBeVisible();
      // S02: a kind's page, from the Kind line in the Facts after the record's body in the wiki card.
      await openPage(page, `${WITH_PROBLEM}?stage=graph`, '.focus-stage .graph-flow .graph-box');
      await page.locator('.wiki-panel').getByRole('complementary', { name: 'Facts' }).getByRole('link', { name: 'UC requirement', exact: true }).click();
      await page.waitForURL((u) => u.search.endsWith('page=format/kinds/uc_requirement'));
      await expect(card.locator('h2').first()).toHaveText('UC requirement');
      await expect(card.getByRole('table', { name: 'The columns of the uc_requirement table' })).toBeVisible();
      // S03: a check's page, from a problem's code on the page.
      await openPage(page, WITH_PROBLEM);
      const code = page.getByRole('list', { name: 'Problems' }).first().getByRole('link').first();
      const check = (await code.textContent())!.trim();
      await code.click();
      await page.waitForURL((u) => u.search.endsWith(`page=format/checks/${check}`));
      await expect(card.locator('h2').first()).toHaveText(check);
      await expect(card.getByRole('heading', { name: 'Query', level: 2 })).toBeVisible();
      await expect(card.getByRole('heading', { name: /^Problems now [1-9]\d*$/, level: 2 })).toBeVisible();
      // S04: a kind by quick find.
      await page.keyboard.press('Control+k');
      await page.locator('.quick-open input').fill('Kind: Flow step');
      await page.getByRole('option', { name: /Kind: Flow step/ }).first().click();
      await page.waitForURL((u) => u.search.endsWith('page=format/kinds/flow_step'));
      await expect(card.locator('h2').first()).toHaveText('Flow step');
    } finally {
      restore();
    }
  });
});
