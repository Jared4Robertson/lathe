import { expect, test } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { EDITED, keepData, RECORD } from './scenarios';

// Changing records in place, with nothing jumping (LA-PAT-APP-UX-R08): opening a record's form,
// saving an edit, adding a child from its parent's page, and asking to remove a record that is
// still referenced, which the store refuses inline. The form takes the place of the page's content,
// so shifts inside the wiki pane's scroll box are the change itself; the nav, the pane's bar and
// title and the side bar must hold still. Every scenario puts the served data back.

const NAV = 'nav#nav';
const SIDE_BAR = '.side-bar-column';
const WIKI_BAR = '.pane-wiki > .pane-bar';
const TITLE = '.pane-wiki .pane-title';
const CONTENT = ['.pane-wiki .pane-scroll'];

test.describe('editing', () => {
  test('LA-EXP-UC14-FL-T open the form, save an edit', async ({ page }) => {
    const restore = keepData();
    try {
      await openPage(page, EDITED);
      const form = page.getByRole('form', { name: `Edit ${EDITED.slice(1)}` });
      const open = await step(page, 'edit', 'open the form', { keys: [NAV, SIDE_BAR, WIKI_BAR, TITLE], allow: CONTENT }, async () => {
        await page.getByRole('toolbar', { name: `Change ${EDITED.slice(1)}` }).getByRole('button', { name: 'Edit' }).click();
        await form.waitFor();
      });
      expectStable(open);
      await form.getByRole('textbox', { name: /^group name/ }).fill('Stability');
      const save = await test.step('LA-EXP-UC14-R07-T01 the Owner saves the change where the record is read, in one write', () =>
        step(page, 'edit', 'save the edit', { keys: [NAV, SIDE_BAR, WIKI_BAR, TITLE], allow: CONTENT, settle: 1500 }, async () => {
          await form.getByRole('button', { name: 'Save' }).click();
          await expect(form).toHaveCount(0, { timeout: 20_000 });
        }));
      expectStable(save);
    } finally {
      restore();
    }
  });

  test('LA-V92-R31-T02 add a child from its parent\'s page', async ({ page }) => {
    const restore = keepData();
    try {
      await openPage(page, RECORD);
      const actions = page.getByRole('toolbar', { name: `Change ${RECORD.slice(1)}` });
      const form = page.getByRole('form', { name: 'Add a UC requirement' });
      const open = await step(page, 'edit', 'open the add form', { keys: [NAV, SIDE_BAR, WIKI_BAR, TITLE], allow: CONTENT }, async () => {
        await actions.getByRole('button', { name: 'Add…' }).click();
        await actions.getByRole('group', { name: /Kinds to add/ }).getByRole('button', { name: 'UC requirement' }).click();
        await form.waitFor();
      });
      expectStable(open);
      await form.getByRole('textbox', { name: /^title/ }).fill('A requirement the stability suite adds');
      await form.getByRole('textbox', { name: /^statement/ }).fill('The page MUST hold still while a record is added.');
      await form.getByRole('button', { name: 'Add UC requirement' }).click();
      await expect(page.locator(`${TITLE} h1`)).toHaveText('A requirement the stability suite adds', { timeout: 20_000 });
    } finally {
      restore();
    }
  });

  test('LA-V92-R32-T02 ask to remove a referenced record, and see the refusal', async ({ page }) => {
    const restore = keepData();
    try {
      await openPage(page, RECORD);
      const panel = page.getByRole('region', { name: `Remove ${RECORD.slice(1)}?` });
      const ask = await step(page, 'edit', 'ask to remove', { keys: [NAV, SIDE_BAR, WIKI_BAR, TITLE], allow: CONTENT }, async () => {
        await page.getByRole('toolbar', { name: `Change ${RECORD.slice(1)}` }).getByRole('button', { name: 'Remove' }).click();
        await panel.waitFor();
      });
      expectStable(ask);
      const refused = await step(page, 'edit', 'the store refuses the removal', { keys: [NAV, SIDE_BAR, WIKI_BAR, TITLE], allow: CONTENT, settle: 1000 }, async () => {
        await panel.getByRole('button', { name: `Remove ${RECORD.slice(1)}` }).click();
        await panel.getByRole('alert').waitFor({ timeout: 20_000 });
      });
      expectStable(refused);
      await test.step('LA-V92-R33-T02 the refusal shows inline, in the store\'s words', () => expect(panel.getByRole('alert')).toContainText('The store refused to remove it'));
    } finally {
      restore();
    }
  });
});
