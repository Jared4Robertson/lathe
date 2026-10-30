import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { asDesktop } from './desktop';
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
/** Opens the toolbar's More menu when a narrower toolbar (the chat open beside the stage) folded the Changes controls there. */
async function reachChanges(page: Page) {
  const more = page.locator('.focus-stage .stage-more');
  if ((await more.locator('.changes-tools').count()) && !(await more.evaluate((d) => (d as HTMLDetailsElement).open))) await more.locator('summary').click();
}
const graphReady = (page: Page) => page.locator('.focus-stage .graph-flow[data-ready] .graph-box').first().waitFor();
const changeOf = (page: Page, id: string) => page.evaluate((id) => {
  const host = document.querySelector('.focus-stage .graph-flow') as HTMLElement & { graphScene?: () => { boxes: { id: string; change: string | null }[] } };
  return host.graphScene?.().boxes.find((b) => b.id === id)?.change ?? null;
}, id);

test.describe('watching the spec change', () => {
  test('LA-EXP-UC15-FL01-T An Agent\'s changes land on the stage, under Highlight changes, in the panel and the wiki card in the web app, and ] and [ walk them', async ({ page }) => {
    const restore = keepData();
    try {
      commitCopy();
      await openPage(page, `${RECORD}?stage=graph`);
      await graphReady(page);
      await expect(tools(page).getByRole('button', { name: /^Changes 0/ })).toBeVisible();

      // The Agent writes; the page reloads on its own and marks what changed.
      agentChanges();
      await expect(tools(page).getByRole('button', { name: /^Changes 2/ })).toBeVisible({ timeout: 20_000 });
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
      await tools(page).getByRole('button', { name: /^Changes 2/ }).click();
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

  test('LA-EXP-UC15-FL02-T The desktop app marks the chat\'s changes on the stage and lists the turn\'s changes from the same diff', async ({ page }) => {
    const restore = keepData();
    try {
      commitCopy();
      // The desktop shell stood in for: its bridge, with a chat whose patches the test sends (window.chatPatch).
      await asDesktop(page, (bridge) => {
        const settings = { layout: 'tree', minimap: false, allLinks: false, cardWidth: null, chat: true, chatWidth: null, highlight: false, since: 'commit', follow: false, looked: {} };
        window.sessionStorage.setItem('lathe:session-settings', JSON.stringify(settings));
        window.sessionStorage.setItem('lathe:place', JSON.stringify({ depth: 1, hiddenKinds: [], card: { open: true, expanded: true } }));
        let listener: ((patch: import('../src/chat/types').ChatPatch) => void) | null = null;
        // The test sends a patch's session, status and items; the rest is as the shell sends it.
        (window as unknown as { chatPatch: (patch: Pick<import('../src/chat/types').ChatPatch, 'reset' | 'sessionId' | 'status' | 'items'>) => void }).chatPatch = (patch) =>
          listener?.({ mode: 'accept-reads', choice: { model: null, effort: null }, lathe: { status: 'counting', version: null }, queue: [], ...patch });
        bridge.chat = {
          ...bridge.chat,
          sessions: async () => ({ claude: '/usr/local/bin/claude', configured: false, signedIn: true, mode: 'accept-reads', current: 'session-1', sessions: [{ id: 'session-1', title: 'Watch list', updated: Date.now(), openElsewhere: null }] }),
          open: async () => true, send: async () => true, answer: async () => true, stop: async () => true,
          onPatch: (l) => { listener = l; return () => { listener = null; }; },
        };
      });
      await openPage(page, `${RECORD}?stage=graph`);
      await graphReady(page);
      await reachChanges(page);
      await tools(page).getByRole('button', { name: 'Follow' }).click();
      const user = { kind: 'user', id: 'u1', text: 'Add a watch list and sharpen the requirement' };
      const patch = (items: unknown[], status: string, reset = false) => page.evaluate(({ items, status, reset }) => (window as unknown as { chatPatch: (p: unknown) => void }).chatPatch({ reset, sessionId: 'session-1', status, items: items.map((item, at) => ({ at, item })) }), { items, status, reset });
      await patch([], 'idle', true);
      await patch([user], 'running');
      // The chat's Agent writes through Lathe's command layer, as its MCP tools do.
      agentChanges();
      await expect(tools(page).getByRole('button', { name: /^Changes 2/ })).toBeVisible({ timeout: 20_000 });
      // Follow glides to the newest change.
      await page.waitForURL((u) => u.pathname === `/${REQUIREMENT}` || u.pathname === `/${ADDED}`, { timeout: 20_000 });
      await patch([user, { kind: 'assistant', id: 'a1', text: 'Done.', streaming: false }], 'idle');
      const turn = page.locator('.chat-changes');
      await expect(turn.locator('summary')).toHaveText('2 records changed');
      await expect(turn).toContainText(ADDED);
      await expect(turn).toContainText(REQUIREMENT);
      // By record (LA-PLT-UC19-R03): the changed requirement under its new title; its fields' old and new show in the panel and the card.
      await expect(turn.locator('.chat-change.is-changed')).toContainText('Changed by the Agent while the Reader watched');

      // The same records and fields in the Changes panel and the requirement's wiki card.
      await tools(page).getByRole('button', { name: 'Highlight changes' }).click();
      await tools(page).getByRole('button', { name: /^Changes 2/ }).click();
      const panel = page.getByRole('region', { name: 'Changes' });
      await expect(panel).toContainText(ADDED);
      await expect(panel.locator('ins').first()).toContainText('Changed by the Agent while the Reader watched');
      await panel.getByRole('link', { name: new RegExp(REQUIREMENT) }).click();
      await page.waitForURL((u) => u.pathname === EDITED);
      // With the chat and the Changes panel open the card has collapsed to give the stage room; the Reader shows it.
      const showTheCard = page.getByRole('button', { name: /^Show the wiki card/ });
      if (await showTheCard.count()) await showTheCard.click();
      await showCard(page, 'whole');
      await expect(page.locator('.wiki-panel .record-changes ins')).toContainText('Changed by the Agent while the Reader watched');
    } finally {
      restore();
    }
  });
});
