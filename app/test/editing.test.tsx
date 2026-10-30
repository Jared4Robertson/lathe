import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { SpecData, WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, removeRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// Changing records in place, for a kind whose aggregate has no editor of its own yet: Edit, Add and Remove on a
// record's page, the form generated from the schema, one write per change through POST /api/write, and the store's
// refusals shown inline, on a view, its requirements and a UI component. The aggregates with their own editors are
// tested in their pages' tests (use-case-page.test.tsx and the others).

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.getByRole('toolbar', { name: `Change ${id}` });

describe('editing a record', () => {
  /** A view requirement's page with its form open, whose save gives back the requirement changed. */
  const requirementForm = async () => {
    const user = userEvent.setup();
    const changed = (): SpecData => setRow(workspace(), 'view_requirement', 'DM-V01-R01', { statement: 'The basket page MUST show the total with its tax.' });
    const { writes } = await openApp('/DM-V01-R01', { write: () => ({ answer: ok, data: changed() }) });
    await user.click(within(toolbar('DM-V01-R01')).getByRole('button', { name: 'Edit' }));
    return { user, writes, form: screen.getByRole('form', { name: 'Edit DM-V01-R01' }) };
  };

  it('LA-V92-R30-T01 opens a form of typed inputs, generated from the schema, each labeled and described by its column', async () => {
    const { form } = await requirementForm();
    // Every input has its label; the first takes focus; a required one says so; its column's meaning describes it.
    const title = within(form).getByRole('textbox', { name: /^title/ });
    expect(title).toHaveFocus();
    expect(title).toHaveValue('Shows the total');
    expect(title).toHaveAttribute('aria-required', 'true');
    const statement = within(form).getByRole('textbox', { name: /^statement/ });
    expect(statement.tagName).toBe('TEXTAREA');
    expect(statement).toHaveAccessibleDescription(/MUST/);
  });

  it('LA-V92-R30-T01 the parent is picked among the records it may name, in the same product', async () => {
    const { form } = await requirementForm();
    const parent = within(form).getByRole('combobox', { name: /^Parent/ });
    expect(within(parent).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['DM-V01']);
  });

  it('LA-V92-R29-T01 Edit opens the form in place; Save writes only what changed and shows the record changed', async () => {
    const { user, writes, form } = await requirementForm();
    const statement = within(form).getByRole('textbox', { name: /^statement/ });
    await user.clear(statement);
    await user.type(statement, 'The basket page MUST show the total with its tax.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([{ op: 'set', table: 'view_requirement', key: 'DM-V01-R01', changes: { statement: 'The basket page MUST show the total with its tax.' } }]);
    await waitFor(() => expect(screen.queryByRole('form')).toBeNull());
    expect(within(main()).getByText('The basket page MUST show the total with its tax.')).toBeInTheDocument();
    // Focus comes back to the record's actions.
    await waitFor(() => expect(within(toolbar('DM-V01-R01')).getByRole('button', { name: 'Edit' })).toHaveFocus());
  });

  it('LA-V92-R30-T01 offers both kinds of parent where a record may sit under either, and moves it between them', async () => {
    const user = userEvent.setup();
    const { writes } = await openApp('/DM-SHOP-EP01', { write: () => ({ answer: ok }) });
    await user.click(within(toolbar('DM-SHOP-EP01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-EP01' });
    const parent = within(form).getByRole('combobox', { name: /^Parent/ });
    expect(parent).toHaveAccessibleDescription(/An endpoint sits under a command or a query./);
    expect([...parent.querySelectorAll('optgroup')].map((g) => [g.getAttribute('label'), [...g.querySelectorAll('option')].map((o) => o.getAttribute('value'))])).toEqual([
      ['Command', ['DM-SHOP-CMD01']],
      ['Query', ['DM-SHOP-QRY01']],
    ]);
    expect(parent).toHaveValue('DM-SHOP-CMD01');
    await user.selectOptions(parent, 'DM-SHOP-QRY01');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([{ op: 'move', id: 'DM-SHOP-EP01', parent: 'DM-SHOP-QRY01' }]);
  });

  /** A save the store refuses, from a view requirement's form with its statement added to. */
  const refusedSave = async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'check', table: 'view_requirement', key: 'DM-V01-R01', command: 0, message: 'view_requirement.title is empty' }] };
    const { writes } = await openApp('/DM-V01-R01', { write: () => ({ answer: refusal }) });
    await user.click(within(toolbar('DM-V01-R01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-V01-R01' });
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), ' Display');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    return { form, writes, alert: await within(form).findByRole('alert') };
  };

  it('LA-V92-R33-T01 shows the store\'s refusal inline, at the top and beside the part of the form it came from', async () => {
    const { form, alert } = await refusedSave();
    expect(alert).toHaveTextContent('The store refused the change. Nothing was saved.');
    expect(alert).toHaveTextContent('DM-V01-R01: view_requirement.title is empty');
    expect(within(form).getByRole('group', { name: 'Fields' })).toHaveTextContent('view_requirement.title is empty');
  });

  it('LA-V92-R10-T01 a refused change keeps the form open with the draft, takes focus to the reasons, and changes nothing', async () => {
    const { form, writes, alert } = await refusedSave();
    expect(alert).toHaveFocus();
    expect(writes).toHaveLength(1);
    // The form stays open with what was typed.
    expect(within(form).getByRole('textbox', { name: /^statement/ })).toHaveValue('The basket page MUST show the total. Display');
  });

  it('LA-V92-R30-T01 does not write while the form has a problem it can see, and says what to fix beside each input', async () => {
    const user = userEvent.setup();
    const { writes } = await openApp('/DM-V01-R01');
    await user.click(within(toolbar('DM-V01-R01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form');
    const title = within(form).getByRole('textbox', { name: /^title/ });
    await user.clear(title);
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Title is required.');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription(/Title is required\./);
    expect(writes).toHaveLength(0);
    // Cancel leaves the record as it was.
    await user.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form')).toBeNull();
    expect(within(main()).getByText(/The basket page MUST show the total/)).toBeInTheDocument();
  });

  it('LA-V92-R30-T01 adds a link only to a valid target, and removes one', async () => {
    const user = userEvent.setup();
    const withComponent = (): SpecData => addRows(addRows(workspace(), 'ui_component', { id: 'DM-UI01', title: 'BasketPage', description: 'Draws the basket.' }), 'renders', { source_id: 'DM-UI01', target_id: 'DM-V01' });
    const { writes } = await openApp('/DM-UI01', { data: withComponent(), write: () => ({ answer: ok }) });
    await user.click(within(toolbar('DM-UI01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form');
    const links = within(form).getByRole('group', { name: 'Links' });
    const renders = within(links).getByRole('combobox', { name: /Add to Renders/ });
    // A record of a kind the relation does not allow is refused before any write.
    await user.type(renders, 'DM-SHOP-UC01{Enter}');
    expect(within(links).getByText(/DM-SHOP-UC01 is not one it can name/)).toBeInTheDocument();
    await user.click(within(links).getByRole('button', { name: /Remove DM-V01 from Renders/ }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([{ op: 'unlink', relation: 'renders', source: 'DM-UI01', target: 'DM-V01' }]);
  });
});

describe('adding a record', () => {
  it('LA-V92-R31-T01 adds a child from its parent\'s page with a suggested ID, and opens it', async () => {
    const user = userEvent.setup();
    const added = (): SpecData => addRows(workspace(), 'api_requirement', { id: 'DM-SHOP-EP01-R02', title: 'Refuses an unknown item', endpoint_id: 'DM-SHOP-EP01', statement: 'It MUST answer 404 for an item the store does not hold.' });
    const { writes } = await openApp('/DM-SHOP-EP01', { write: () => ({ answer: ok, data: added() }) });
    const actions = toolbar('DM-SHOP-EP01');
    const add = within(actions).getByRole('button', { name: 'Add…' });
    expect(add).toHaveAttribute('aria-expanded', 'false');
    await user.click(add);
    expect(add).toHaveAttribute('aria-expanded', 'true');
    const kinds = within(actions).getByRole('group', { name: 'Kinds to add under DM-SHOP-EP01' });
    expect(within(kinds).getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['API requirement', 'Endpoint handler']));
    await user.click(within(kinds).getByRole('button', { name: 'API requirement' }));

    const form = screen.getByRole('form', { name: 'Add an API requirement' });
    const id = within(form).getByRole('textbox', { name: /^ID/ });
    expect(id).toHaveValue('DM-SHOP-EP01-R02');
    expect(id).toHaveFocus();
    expect(within(form).getByRole('combobox', { name: /^Parent/ })).toHaveValue('DM-SHOP-EP01');
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Refuses an unknown item');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'It MUST answer 404 for an item the store does not hold.');
    await user.click(within(form).getByRole('button', { name: 'Add API requirement' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([{ op: 'add', table: 'api_requirement', row: { id: 'DM-SHOP-EP01-R02', endpoint_id: 'DM-SHOP-EP01', title: 'Refuses an unknown item', statement: 'It MUST answer 404 for an item the store does not hold.' } }]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Refuses an unknown item' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/DM-SHOP-EP01-R02');
  });

  it('LA-V92-R31-T01 adds a kind with no owner from the product\'s page: its ID takes the product, and it has no parent to choose', async () => {
    const user = userEvent.setup();
    const { writes } = await openApp('/DM', { write: () => ({ answer: ok }) });
    // The product's page is the Product aggregate's: its actions show once the product is read.
    const actions = await screen.findByRole('toolbar', { name: 'Change DM' });
    await user.click(within(actions).getByRole('button', { name: 'Add…' }));
    const kinds = within(actions).getByRole('group', { name: 'Kinds to add under DM' });
    expect(within(kinds).getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Domain', 'Value object', 'View', 'Integration', 'UI component', 'Open question']));
    await user.click(within(kinds).getByRole('button', { name: 'View' }));

    const form = screen.getByRole('form', { name: 'Add a view' });
    expect(form).toHaveTextContent('New view in DM');
    expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-V02');
    expect(within(form).queryByRole('combobox', { name: /^Parent/ })).toBeNull();
    expect(within(form).queryByRole('group', { name: 'Where it sits' })).toBeNull();
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Checkout');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'Shows the order before the shopper pays.');
    await user.click(within(form).getByRole('button', { name: 'Add view' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([{ op: 'add', table: 'view', row: { id: 'DM-V02', title: 'Checkout', description: 'Shows the order before the shopper pays.' } }]);
  });

  it('LA-V92-R30-T01 refuses an ID that is already a record before writing', async () => {
    const user = userEvent.setup();
    const { writes } = await openApp('/DM-SHOP-EP01');
    await user.click(within(toolbar('DM-SHOP-EP01')).getByRole('button', { name: 'Add…' }));
    await user.click(screen.getByRole('button', { name: 'API requirement' }));
    const form = screen.getByRole('form');
    const id = within(form).getByRole('textbox', { name: /^ID/ });
    await user.clear(id);
    await user.type(id, 'DM-SHOP-EP01-R01');
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Again');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'It MUST hold.');
    await user.click(within(form).getByRole('button', { name: 'Add API requirement' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('DM-SHOP-EP01-R01 is already a record.');
    expect(writes).toHaveLength(0);
  });
});

describe('removing a record', () => {
  it('LA-V92-R32-T01 asks first, naming what still references the record, and shows the store\'s refusal inline', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = {
      ok: false,
      error: 'refused',
      problems: [{ rule: 'referenced', table: 'view', key: 'DM-V01', command: 0, message: 'view DM-V01 is referenced, so it stays: view requirement DM-V01-R01 (view_id)' }],
    };
    const { writes } = await openApp('/DM-V01', { write: () => ({ answer: refusal }) });
    const remove = within(toolbar('DM-V01')).getByRole('button', { name: 'Remove' });
    await user.click(remove);
    expect(remove).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: 'Remove DM-V01?' });
    expect(within(panel).getByRole('heading', { name: 'Remove DM-V01?' })).toHaveFocus();
    expect(panel).toHaveTextContent(/These \d+ still reference it/);
    expect(within(panel).getByRole('link', { name: /DM-V01-R01/ }).closest('li')).toHaveTextContent('sits under it');
    // Nothing is written until the person confirms.
    expect(writes).toHaveLength(0);

    await user.click(within(panel).getByRole('button', { name: 'Remove DM-V01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The store refused to remove it. Nothing was changed.');
    expect(alert).toHaveTextContent('view requirement DM-V01-R01 (view_id)');
    expect(writes).toEqual([[{ op: 'remove', table: 'view', key: 'DM-V01' }]]);
    expect(window.location.pathname).toBe('/DM-V01');
    // Cancel closes the question and gives focus back to the actions.
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Remove DM-V01?' })).toBeNull();
    await waitFor(() => expect(within(toolbar('DM-V01')).getByRole('button', { name: 'Edit' })).toHaveFocus());
  });

  it('LA-V92-R32-T01 removes a record nothing references, and goes to its parent', async () => {
    const user = userEvent.setup();
    // A view requirement nothing references, on a kind whose aggregate has no page of its own yet.
    const withRule = (): SpecData => addRows(workspace(), 'view_requirement', { id: 'DM-V01-R09', title: 'Shows the tax', view_id: 'DM-V01', statement: 'The basket page MUST show the tax.' });
    const removed = (): SpecData => removeRows(withRule(), 'view_requirement', (r) => r.id === 'DM-V01-R09');
    const { writes } = await openApp('/DM-V01-R09', { data: withRule(), write: () => ({ answer: ok, data: removed() }) });
    await user.click(within(toolbar('DM-V01-R09')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-V01-R09?' });
    expect(panel).toHaveTextContent('Nothing else references it.');
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-V01-R09' }));
    await waitFor(() => expect(window.location.pathname).toBe('/DM-V01'));
    expect(writes).toEqual([[{ op: 'remove', table: 'view_requirement', key: 'DM-V01-R09' }]]);
  });
});
