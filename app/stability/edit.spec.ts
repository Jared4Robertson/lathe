import { expect, test, type Page } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { AGGREGATE, EDITED, keepData, RECORD } from './scenarios';

// Changing records in place, with nothing jumping (LA-PAT-APP-UX-R08): on the Use case page (its own editor, sending
// the Use case aggregate's commands) and on the Domain, Test data set, Pattern, Standard, Product, Business outcome,
// Entry point and Tooling pages, opening a record's form, saving an edit, adding a child from its parent's page,
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
  // The Domain, Test data set, Pattern and Standard pages: each saves one field as its kind's Change command, with
  // nothing jumping. Each is its aggregate's web-app flow test.
  test('LA-AUT-UC02-FL01-T on the Domain records page, open a term\'s form and save an edit', ({ page }) => saveAnEdit(page, '/LA-AUT-TM01', /^group name/, 'Stability'));
  test('LA-AUT-UC13-FL01-T on the Test data set page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-AUT-TD30', /^reset/, 'Throw the folder away.'));
  test('LA-AUT-UC05-FL01-T on the Pattern page, open a rule\'s form and save an edit', ({ page }) => saveAnEdit(page, '/LA-PAT-RECORD-PAGE-R01', /^group name/, 'Stability'));
  test('LA-AUT-UC16-FL01-T on the Standard page, open a rule\'s form and save an edit', ({ page }) => saveAnEdit(page, '/LA-STD-CODE-R01', /^group name/, 'Stability'));
  // The Product, Business outcome, Entry point and Tooling pages: each saves one field as its kind's Change command, with
  // nothing jumping. Each is its aggregate's web-app flow test.
  test('LA-AUT-UC23-FL01-T on the Product page, open an interface\'s form and save an edit', ({ page }) => saveAnEdit(page, '/LA-IF03', /^description/, 'The command line, as the stability suite describes it.'));
  test('LA-AUT-UC22-FL01-T on the Business outcome page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-BO05', /^notes/, 'Noted by the stability suite.'));
  test('LA-AUT-UC29-FL01-T on the Entry point page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-PLT-ENTRY01', /^description/, 'Starts the server, as the stability suite describes it.'));
  test('LA-AUT-UC30-FL01-T on the Tooling page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-AUT-TOOL01', /^title/, 'schema-types.ts'));
});

/** Opens the record's page, opens its Edit form, fills one field and saves it, with nothing outside the card moving. */
async function saveAnEdit(page: Page, address: string, field: RegExp, value: string) {
  const restore = keepData();
  try {
    await openPage(page, address);
    const form = page.getByRole('form', { name: `Edit ${address.slice(1)}` });
    const open = await step(page, 'edit', 'open the form', { keys: [NAV, WIKI_BAR, STRIP, TITLE], allow: CONTENT }, async () => {
      await page.getByRole('toolbar', { name: `Change ${address.slice(1)}` }).getByRole('button', { name: 'Edit' }).click();
      await form.waitFor();
    });
    expectStable(open);
    await form.getByRole('textbox', { name: field }).fill(value);
    const save = await step(page, 'edit', 'save the edit', { keys: [NAV, WIKI_BAR, STRIP, TITLE], allow: CONTENT, settle: 1500 }, async () => {
      await form.getByRole('button', { name: 'Save' }).click();
      await expect(form).toHaveCount(0, { timeout: 20_000 });
    });
    expectStable(save);
  } finally {
    restore();
  }
}
