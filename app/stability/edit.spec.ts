import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';
import { expectStable, openPage, step } from './measure';
import { EDITED, keepData, RECORD, REFERENCED } from './scenarios';

// Changing records in place, with nothing jumping (LA-PAT-APP-UX-R08): on the Use case page (its own editor, sending
// the Use case aggregate's commands) and on the Domain, Test data set, Pattern, Standard, Product, Business outcome,
// Entry point, Tooling, Table, Specification, Read model, Value object, Aggregate, Domain event, Command, View, UI component,
// Endpoint, Integration, Storage requirement, Data store, Check and Pattern pages and the Product page's Limits, opening a record's form, saving an edit,
// adding a child from its parent's page,
// and asking to remove a record that is still referenced, which the command refuses inline. The form takes the place of
// the page's content,
// so shifts inside the wiki card's scroll box are the change itself; the nav, the card's head and
// title and the header strip must hold still. Every scenario puts the served data back.

const NAV = 'nav#nav';
const WIKI_BAR = '.wiki-panel-head';
const STRIP = '.header-strip';
const TITLE = '.wiki-panel-title';
const CONTENT = ['.wiki-panel-scroll'];
/** What holds still while a form is sent: the title scrolls with the card's page, which the Reader scrolled to reach the button. */
const SENDING = [NAV, WIKI_BAR, STRIP];

/**
 * Sends a form by its button, as the Reader does: they scroll the card to the button first (their own scroll, not a
 * jump), and once the form closes the focus is back on the actions that opened it (the record's own Change toolbar,
 * or a section's), in view.
 */
async function send(page: Page, form: Locator, button: string, name: string, actions: Locator) {
  await form.getByRole('button', { name: button, exact: true }).scrollIntoViewIfNeeded();
  const sent = await step(page, 'edit', name, { keys: SENDING, allow: CONTENT, settle: 1500 }, async () => {
    await form.getByRole('button', { name: button, exact: true }).click();
    await expect(form).toHaveCount(0, { timeout: 20_000 });
  });
  const back = actions.getByRole('button').first();
  await expect(back, `${name}: the focus is back on the actions that opened the form`).toBeFocused();
  await expect(back, `${name}: those actions are in view`).toBeInViewport();
  return sent;
}
test.describe('editing', () => {
  // Each scenario puts the served data back as it ends; the server reloads it a moment later. The next scenario starts
  // after that reload, so its page never receives the previous one's restore while it is measured.
  test.afterEach(async ({ page }) => { await page.waitForTimeout(1500); });
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Use case page, open a requirement\'s form and save an edit', async ({ page }) => {
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
        send(page, form, 'Save', 'save the edit', page.getByRole('toolbar', { name: `Change ${EDITED.slice(1)}` })));
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
        // A use case holds one kind the Owner adds, so its toolbar names it instead of asking which.
        await actions.getByRole('button', { name: 'Add UC requirement' }).click();
        await form.waitFor();
      });
      expectStable(open);
      await expect(form.getByRole('textbox', { name: /^ID/ })).not.toHaveValue('', { timeout: 20_000 });
      await form.getByRole('textbox', { name: /^title/ }).fill('A requirement the stability suite adds');
      await form.getByRole('textbox', { name: /^statement/ }).fill('What the Reader is reading MUST hold still while a requirement is added.');
      await form.getByRole('button', { name: 'Add UC requirement' }).click();
      await expect(page.locator(`${TITLE} h2`)).toHaveText('A requirement the stability suite adds', { timeout: 20_000 });
    } finally {
      restore();
    }
  });

  test('LA-V101-R03-T03 LA-PAT-PAGE-STEPS-R02-T01 LA-PAT-PAGE-STEPS-R02-T06 LA-PAT-PAGE-STEPS-R02-T07 LA-PAT-PAGE-STEPS-R02-T08 LA-PAT-PAGE-STEPS-R02-T09 LA-PAT-PAGE-STEPS-R02-T10 ask to remove a referenced use case, and see the refusal', async ({ page }) => {
    const restore = keepData();
    try {
      await openPage(page, REFERENCED);
      const panel = page.getByRole('region', { name: `Remove ${REFERENCED.slice(1)}?` });
      const ask = await step(page, 'edit', 'ask to remove', { keys: [NAV, WIKI_BAR, STRIP, TITLE], allow: CONTENT }, async () => {
        await page.getByRole('toolbar', { name: `Change ${REFERENCED.slice(1)}` }).getByRole('button', { name: 'Remove' }).click();
        await panel.waitFor();
      });
      expectStable(ask);
      // The question lists all the removal would take; the Reader scrolls to its button (their own scroll).
      await panel.getByRole('button', { name: `Remove ${REFERENCED.slice(1)}` }).scrollIntoViewIfNeeded();
      const refused = await step(page, 'edit', 'the command refuses the removal', { keys: SENDING, allow: CONTENT, settle: 1000 }, async () => {
        await panel.getByRole('button', { name: `Remove ${REFERENCED.slice(1)}` }).click();
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
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Domain records page, open a term\'s form and save an edit', ({ page }) => saveAnEdit(page, '/LA-PRD-TM01', /^group name/, 'Stability'));
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Test data set page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-MOD-TD30', /^reset/, 'Throw the folder away.'));
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Pattern page, open a rule\'s form and save an edit', ({ page }) => saveAnEdit(page, '/LA-PAT-RECORD-PAGE-R01', /^group name/, 'Stability'));
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Standard page, open a rule\'s form and save an edit', ({ page }) => saveAnEdit(page, '/LA-STD-MODELING-R01', /^group name/, 'Stability'));
  // The Product, Business outcome, Entry point and Tooling pages: each saves one field as its kind's Change command, with
  // nothing jumping. Each is its aggregate's web-app flow test.
  test('LA-PRD-UC23-FL-T on the Product page, open an interface\'s form and save an edit', ({ page }) => saveAnEdit(page, '/LA-IF03', /^description/, 'The command line, as the stability suite describes it.'));
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Business outcome page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-BO05', /^notes/, 'Noted by the stability suite.'));
  test('LA-TEC-UC29-FL-T on the Entry point page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-PLT-ENTRY01', /^description/, 'Starts the server, as the stability suite describes it.'));
  test('LA-TEC-UC30-FL-T on the Tooling page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-PRD-TOOL01', /^title/, 'schema-types.ts'));
  // The View and UI component pages: each saves one field as its kind's Change command, with nothing jumping. Each is its
  // aggregate's web-app flow test.
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the View page, open a requirement\'s form and save an edit', ({ page }) => saveAnEdit(page, '/LA-V123-R04', /^group name/, 'Stability'));
  test('LA-IXD-UC28-FL-T on the UI component page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-UI226', /^description/, 'The Standard page, as the stability suite describes it.'));
  // The Endpoint and Integration pages: each saves one field as its kind's Change command, with nothing jumping. Each is
  // its aggregate's web-app flow test.
  test('LA-IXD-UC26-FL-T on the Endpoint page, open an API requirement\'s form and save an edit', ({ page }) => saveAnEdit(page, '/TL-LEND-EP01-R01', /^group name/, 'Stability'));
  test('LA-IXD-UC27-FL-T on the Integration page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-INT04', /^system/, 'git, as the stability suite names it'));
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Storage requirement page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-MOD-A22-SR01', /^title/, 'Every change to a storage requirement is saved whole'));
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Data store page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-STORE04', /^description/, 'Each process\'s own memory, as the stability suite describes it.'));
  // The Check page, the Product page's Limits and the Pattern page's Followed by: each sends one of its aggregate's
  // commands, with nothing jumping.
  test('LA-V03-R03-T02 on the Check page, open a product check\'s form and save an edit', ({ page }) =>
    saveAnEdit(page, '/LA?page=format/checks/shared-module-group-unknown', /^summary/, "A shared module's group names an aggregate or capability of its domain, as the stability suite says.", 'shared-module-group-unknown'));
  test('LA-V51-R11-T02 on the Product page, set the product\'s limits', ({ page }) =>
    sendAForm(page, '/LA', 'Change the limits of LA', 'Set limits', 'Set limits', async (form) => {
      await form.getByRole('spinbutton', { name: /^Children of one kind/ }).fill('16');
    }));
  test('LA-V122-R07-T02 on the Pattern page, make a use case follow the pattern', ({ page }) =>
    sendAForm(page, '/LA-PAT-RECORD-PAGE', 'Followers of LA-PAT-RECORD-PAGE', 'Follow', 'Follow LA-PAT-RECORD-PAGE', async (form) => {
      await form.getByRole('combobox', { name: /^Follower/ }).selectOption({ index: 1 });
    }, 'Follow'));
  // The Table, Specification, Read model and Value object pages: each saves one field as its kind's Change command, with
  // nothing jumping. Each is its aggregate's web-app flow test.
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Table page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-MOD-EN54-TB', /^title/, 'projections'));
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Specification page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-MOD-SP09', /^title/, 'Data files clash in a merge'));
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Read model page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-MOD-RM25', /^description/, 'A specification as the stability suite reads it.'));
  test('LA-MOD-UC24-FL-T on the Value object page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-VO01', /^description/, 'Names one record across the store, as the stability suite describes it.'));
  // The Aggregate, Domain event and Command pages, likewise.
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Aggregate page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-MOD-A6', /^identity/, 'Stability'));
  test('LA-MOD-UC25-FL-T on the Domain event page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-PRD-EV03', /^description/, 'Stability'));
  test('LA-PAT-PAGE-STEPS-R01-T01 LA-PAT-PAGE-STEPS-R01-T06 LA-PAT-PAGE-STEPS-R01-T07 LA-PAT-PAGE-STEPS-R01-T08 LA-PAT-PAGE-STEPS-R01-T09 LA-PAT-PAGE-STEPS-R01-T10 on the Command page, open its form and save an edit', ({ page }) => saveAnEdit(page, '/LA-MOD-CMD210', /^description/, 'Stability'));
});

/** Opens the page, opens a form from one of its toolbars, fills it and sends it, with nothing outside the card moving. */
async function sendAForm(page: Page, address: string, toolbar: string, button: string, formName: string, fill: (form: Locator) => Promise<void>, save = button) {
  const restore = keepData();
  try {
    await openPage(page, address);
    const form = page.getByRole('form', { name: formName });
    // The toolbar may sit far down the page (a section's own); the Reader scrolls to it first (their own scroll).
    await page.getByRole('toolbar', { name: toolbar }).getByRole('button', { name: button }).scrollIntoViewIfNeeded();
    const open = await step(page, 'edit', 'open the form', { keys: [NAV, WIKI_BAR, STRIP, TITLE], allow: CONTENT }, async () => {
      await page.getByRole('toolbar', { name: toolbar }).getByRole('button', { name: button }).click();
      await form.waitFor();
    });
    expectStable(open);
    await fill(form);
    const sent = await send(page, form, save, 'send the form', page.getByRole('toolbar', { name: toolbar }));
    expectStable(sent);
  } finally {
    restore();
  }
}

/** Opens the record's page, opens its Edit form, fills one field and saves it, with nothing outside the card moving. */
async function saveAnEdit(page: Page, address: string, field: RegExp, value: string, name = address.slice(1)) {
  const restore = keepData();
  try {
    await openPage(page, address);
    const form = page.getByRole('form', { name: `Edit ${name}` });
    const open = await step(page, 'edit', 'open the form', { keys: [NAV, WIKI_BAR, STRIP, TITLE], allow: CONTENT }, async () => {
      await page.getByRole('toolbar', { name: `Change ${name}` }).getByRole('button', { name: 'Edit' }).click();
      await form.waitFor();
    });
    expectStable(open);
    await form.getByRole('textbox', { name: field }).fill(value);
    const save = await send(page, form, 'Save', 'save the edit', page.getByRole('toolbar', { name: `Change ${name}` }));
    expectStable(save);
  } finally {
    restore();
  }
}
