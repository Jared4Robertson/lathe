import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { openPage, showCard } from './measure';
import { EDITED, keepData, RECORD } from './scenarios';
import { boxOf, sceneOf } from './scene';

// The Reader watches the spec change (LA-EXP-UC15): its two flows, each walking its main path in Chromium over the
// suite's copy of Lathe's data, made a git repository so the baselines have a commit to read. An Agent changes the
// data through the real CLI while the page is open; the stage marks it, Follow glides to it, and Highlight changes, the
// Changes panel and the wiki card compare it with the baseline. The copy is put back after each.

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT = () => process.env.STABILITY_ROOT!;
const lathe = (...args: string[]) => execFileSync('node', [path.join(repo, 'lathe/bin/lathe.ts'), ...args, '--root', ROOT()], { stdio: 'pipe' }).toString();
const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=Stability', '-c', 'user.email=stability@example.test', ...args], { cwd: ROOT(), stdio: 'pipe' }).toString();
/** The aggregate the Agent adds, and the requirement it edits. */
const ADDED = 'LA-EXP-A99';
const REQUIREMENT = EDITED.slice(1);

/** Commits the copy as it is, so "since the last commit" starts from here. */
function commitCopy() {
  if (!existsSync(path.join(ROOT(), '.git'))) git('init', '-q', '--initial-branch=main');
  git('add', '-A');
  git('commit', '-q', '--allow-empty', '-m', 'The data before the Agent');
}

/** The Agent's changes, through the command layer. */
function agentChanges() {
  lathe('aggregate', 'add-aggregate', '--id', ADDED, '--title', 'Watch list', '--domain_id', 'LA-EXP', '--description', 'The records a Reader watches, kept together.', '--identity', 'Watch list ID');
  lathe('use-case', 'change-uc-requirement', '--id', REQUIREMENT, '--title', 'Changed by the Agent while the Reader watched');
}

const tools = (page: Page) => page.locator('.focus-stage').getByRole('group', { name: 'Changes' });
/** The Changes button whatever it counts, so a failure's Received names the count it shows. */
const changesButton = (page: Page) => tools(page).getByRole('button', { name: /^Changes / });
/** The Changes button is in view and counts exactly this many records. */
async function expectCount(page: Page, count: number, options?: { timeout: number }) {
  await expect(changesButton(page)).toHaveAccessibleName(`Changes ${count} records changed`, options);
  await expect(changesButton(page)).toBeVisible();
}
const graphReady = (page: Page) => page.locator('.focus-stage .graph-flow[data-ready] .graph-box').first().waitFor();
const changeOf = (page: Page, id: string) => page.evaluate((id) => {
  const host = document.querySelector('.focus-stage .graph-flow') as HTMLElement & { graphScene?: () => { boxes: { id: string; change: string | null }[] } };
  return host.graphScene?.().boxes.find((b) => b.id === id)?.change ?? null;
}, id);

test.describe('watching the spec change', () => {
  test('LA-EXP-UC15-FL-T LA-EXP-UC19-FL-T LA-PAT-PAGE-STEPS-R01-T03 An Agent\'s changes land on the stage, under Highlight changes, in the panel and the wiki card in the web app, and ] and [ walk them', async ({ page }) => {
    const restore = keepData();
    try {
      commitCopy();
      await openPage(page, `${RECORD}?stage=graph`);
      await graphReady(page);
      await expectCount(page, 0);

      // The Agent writes; the page reloads on its own and marks what changed.
      agentChanges();
      await expectCount(page, 2, { timeout: 20_000 });
      await page.goto(`${EDITED}?stage=graph`);
      await graphReady(page);
      // A page opened after the change has no live marks; the next change lands live.
      lathe('use-case', 'change-uc-requirement', '--id', REQUIREMENT, '--title', 'Changed again while the Reader watched');
      await expect.poll(() => changeOf(page, REQUIREMENT), { timeout: 20_000 }).toBe('changed');

      // Follow: the next change glides the camera to it; the Reader's own wheel turns it off, with a note.
      await tools(page).getByRole('button', { name: 'Follow' }).click();
      lathe('aggregate', 'change-aggregate', '--id', ADDED, '--title', 'Watch list of tools');
      await page.waitForURL((u) => u.pathname === `/${ADDED}`, { timeout: 20_000 });
      await page.locator('.focus-stage canvas').hover();
      await page.mouse.wheel(0, 200);
      await expect(tools(page).getByRole('status')).toHaveText('Follow is off: you moved the camera.');
      await expect(tools(page).getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'false');

      // Highlight changes: everything unchanged dims against the baseline.
      await tools(page).getByRole('button', { name: 'Highlight changes' }).click();
      await expect.poll(async () => (await boxOf(page, ADDED))?.strength).toBe(1);

      // Every changed record carries its pill, and a container its roll-up of the records under it.
      await expect.poll(async () => (await boxOf(page, ADDED))?.pill).toBe('added');
      await expect.poll(async () => (await sceneOf(page)).boxes.some((b) => b.rollup !== null), { timeout: 10_000 }).toBe(true);

      // ] and [ walk the focus through the changed records in ID order, around at the ends.
      await page.keyboard.press(']');
      await page.waitForURL((u) => u.pathname === EDITED || u.pathname === `/${ADDED}`);
      const first = new URL(page.url()).pathname;
      await page.keyboard.press(']');
      await page.waitForURL((u) => u.pathname !== first);
      await page.keyboard.press('[');
      await page.waitForURL((u) => u.pathname === first);

      // The panel lists both, newest first, and a click focuses the requirement; its card shows the field old → new.
      await expectCount(page, 2);
      await changesButton(page).click();
      const panel = page.getByRole('region', { name: 'Changes' });
      // The baseline, from the panel (the toolbar holds the picker only in its widest form).
      const picker = panel.getByRole('combobox', { name: 'Compared with' });
      for (const since of ['branch', 'looked', 'commit']) {
        await picker.selectOption(since);
        await expect(picker).toHaveValue(since);
      }
      const cards = panel.getByRole('list', { name: 'Changed records' }).locator('.card-title');
      await expect(cards.first()).toContainText(ADDED);
      await expect(cards.nth(1)).toContainText(REQUIREMENT);
      await cards.nth(1).click();
      await page.waitForURL((u) => u.pathname === EDITED);
      const card = page.locator('.wiki-panel');
      await showCard(page, 'whole');
      const section = card.locator('.record-changes');
      await expect(section).toContainText('Changed since the last commit');
      await expect(section.locator('ins')).toContainText('Changed again while the Reader watched');
    } finally {
      restore();
    }
  });
});
