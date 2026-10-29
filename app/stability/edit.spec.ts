import { expect, test } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { AGGREGATE, EDITED, keepData, RECORD } from './scenarios';

// Changing records in place, with nothing jumping (LA-PAT-APP-UX-R08): on the Use case page (its own editor, sending
// the Use case aggregate's commands), opening a record's form, saving an edit, adding a child from its parent's page,
// and asking to remove a record that is still referenced, which the command refuses inline; and on the page of a kind
// whose aggregate has no editor yet, the record form generated from the schema. The form takes the place of the page's content,
// so shifts inside the wiki card's scroll box are the change itself; the nav, the card's head and
// title and the header strip must hold still. Every scenario puts the served data back.

const NAV = 'nav#nav';
const WIKI_BAR = '.wiki-panel-head';
const STRIP = '.header-strip';
const TITLE = '.wiki-panel-title';
const CONTENT = ['.wiki-panel-scroll'];

test.describe('editing', () => {
  test('LA-EXP-UC14-FL01-T open the record form, save an edit', async ({ page }) => {
    const restore = keepData();
    try {
      await openPage(page, AGGREGATE);
      const form = page.getByRole('form', { name: `Edit ${AGGREGATE.slice(1)}` });
      const open = await step(page, 'edit', 'open the form', { keys: [NAV, WIKI_BAR, STRIP, TITLE], allow: CONTENT }, async () => {
        await page.getByRole('toolbar', { name: `Change ${AGGREGATE.slice(1)}` }).getByRole('button', { name: 'Edit' }).click();
        await form.waitFor();
      });
      expectStable(open);
      await form.getByRole('textbox', { name: /^identity/ }).fill('Stability');
      const save = await test.step('LA-EXP-UC14-R07-T01 the Owner saves the change where the record is read, in one write', () =>
        step(page, 'edit', 'save the edit', { keys: [NAV, WIKI_BAR, STRIP, TITLE], allow: CONTENT, settle: 1500 }, async () => {
          await form.getByRole('button', { name: 'Save' }).click();
          await expect(form).toHaveCount(0, { timeout: 20_000 });
        }));
      expectStable(save);
    } finally {
      restore();
    }
  });

  test('LA-AUT-UC06-FL01-T on the Use case page, open a requirement\'s form and save an edit', async ({ page }) => {
    const restore = keepData();
    try {
      await openPage(page, EDITED);
      const form = page.getByRole('form', { name: `Edit ${EDITED.slice(1)}` });
      const open = await step(page, 'edit', 'open the form', { keys: [NAV, WIKI_BAR, STRIP, TITLE], allow: CONTENT }, async () => {
        await page.getByRole('toolbar', { name: `Change ${EDITED.slice(1)}` }).getByRole('button', { name: 'Edit' }).click();
        await form.waitFor();
      });
      expectStable(open);
      await form.getByRole('textbox', { name: /^group name/ }).fill('Stability');
      const save = await test.step('LA-V101-R02-T02 the Owner saves the change on the Use case page, as one Change command', () =>
        step(page, 'edit', 'save the edit', { keys: [NAV, WIKI_BAR, STRIP, TITLE], allow: CONTENT, settle: 1500 }, async () => {
          await form.getByRole('button', { name: 'Save' }).click();
          await expect(form).toHaveCount(0, { timeout: 20_000 });
        }));
      expectStable(save);
    } finally {
      restore();
    }
  });

  test('LA-V101-R02-T03 add a requirement from its use case\'s page', async ({ page }) => {
    const restore = keepData();
    try {
      await openPage(page, RECORD);
      const actions = page.getByRole('toolbar', { name: `Change ${RECORD.slice(1)}` });
      const form = page.getByRole('form', { name: 'Add a UC requirement' });
      const open = await step(page, 'edit', 'open the add form', { keys: [NAV, WIKI_BAR, STRIP, TITLE], allow: CONTENT }, async () => {
        await actions.getByRole('button', { name: 'Add UC requirement' }).click();
        await form.waitFor();
      });
      expectStable(open);
      await expect(form.getByRole('textbox', { name: /^ID/ })).not.toHaveValue('', { timeout: 20_000 });
      await form.getByRole('textbox', { name: /^title/ }).fill('A requirement the stability suite adds');
      await form.getByRole('textbox', { name: /^statement/ }).fill('The page MUST hold still while a record is added.');
      await form.getByRole('button', { name: 'Add UC requirement' }).click();
      await expect(page.locator(`${TITLE} h1`)).toHaveText('A requirement the stability suite adds', { timeout: 20_000 });
    } finally {
      restore();
    }
  });

  test('LA-V101-R03-T03 ask to remove a referenced use case, and see the refusal', async ({ page }) => {
    const restore = keepData();
    try {
      await openPage(page, RECORD);
      const panel = page.getByRole('region', { name: `Remove ${RECORD.slice(1)}?` });
      const ask = await step(page, 'edit', 'ask to remove', { keys: [NAV, WIKI_BAR, STRIP, TITLE], allow: CONTENT }, async () => {
        await page.getByRole('toolbar', { name: `Change ${RECORD.slice(1)}` }).getByRole('button', { name: 'Remove' }).click();
        await panel.waitFor();
      });
      expectStable(ask);
      const refused = await step(page, 'edit', 'the command refuses the removal', { keys: [NAV, WIKI_BAR, STRIP, TITLE], allow: CONTENT, settle: 1000 }, async () => {
        await panel.getByRole('button', { name: `Remove ${RECORD.slice(1)}` }).click();
        await panel.getByRole('alert').waitFor({ timeout: 20_000 });
      });
      expectStable(refused);
      await test.step('LA-V101-R03-T02 the refusal shows inline, in the command\'s words', () => expect(panel.getByRole('alert')).toContainText('The removal was refused'));
    } finally {
      restore();
    }
  });
});
