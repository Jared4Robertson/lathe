import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { SpecData, WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, removeRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// Changing records in place: Edit, Add and Remove on a record's page, the form generated from the
// schema, one write per change through POST /api/write, and the store's refusals shown inline.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.getByRole('toolbar', { name: `Change ${id}` });

describe('editing a record', () => {
  /** A UC requirement's page with its form open, whose save gives back the requirement changed. */
  const requirementForm = async () => {
    const user = userEvent.setup();
    const changed = (): SpecData => setRow(workspace(), 'uc_requirement', 'DM-SHOP-UC01-R01', { statement: 'The basket MUST show the new item within a second.' });
    const { writes } = await openApp('/DM-SHOP-UC01-R01', { write: () => ({ answer: ok, data: changed() }) });
    await user.click(within(toolbar('DM-SHOP-UC01-R01')).getByRole('button', { name: 'Edit' }));
    return { user, writes, form: screen.getByRole('form', { name: 'Edit DM-SHOP-UC01-R01' }) };
  };

  it('LA-EXP-DS12-T01 opens a form of typed inputs, generated from the schema, each labeled and described by its column', async () => {
    const { form } = await requirementForm();
    // Every input has its label; the first takes focus; a required one says so; its column's meaning describes it.
    const title = within(form).getByRole('textbox', { name: /^title/ });
    expect(title).toHaveFocus();
    expect(title).toHaveValue('The basket shows the new item');
    expect(title).toHaveAttribute('aria-required', 'true');
    const statement = within(form).getByRole('textbox', { name: /^statement/ });
    expect(statement.tagName).toBe('TEXTAREA');
    expect(statement).toHaveAccessibleDescription(/MUST/);
  });

  it('LA-V92-R30-T01 the parent is picked among the records it may name, in the same product', async () => {
    const { form } = await requirementForm();
    const parent = within(form).getByRole('combobox', { name: /^Parent/ });
    expect(within(parent).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['DM-PAY-UC01', 'DM-SHOP-UC01']);
  });

  it('LA-V92-R29-T01 Edit opens the form in place; Save writes only what changed and shows the record changed', async () => {
    const { user, writes, form } = await requirementForm();
    const statement = within(form).getByRole('textbox', { name: /^statement/ });
    await user.clear(statement);
    await user.type(statement, 'The basket MUST show the new item within a second.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([{ op: 'set', table: 'uc_requirement', key: 'DM-SHOP-UC01-R01', changes: { statement: 'The basket MUST show the new item within a second.' } }]);
    await waitFor(() => expect(screen.queryByRole('form')).toBeNull());
    expect(within(main()).getByText('The basket MUST show the new item within a second.')).toBeInTheDocument();
    // Focus comes back to the record's actions.
    await waitFor(() => expect(within(toolbar('DM-SHOP-UC01-R01')).getByRole('button', { name: 'Edit' })).toHaveFocus());
  });

  it('offers both kinds of parent where a record may sit under either, and moves it between them', async () => {
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

  it('edits part rows in place: a field\'s name and its type, a value object or an aggregate chosen among the product\'s', async () => {
    const user = userEvent.setup();
    const { writes } = await openApp('/DM-SHOP-EN02', { write: () => ({ answer: ok }) });
    await user.click(within(toolbar('DM-SHOP-EN02')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-EN02' });
    const fields = within(form).getByRole('group', { name: /^Entity fields/ });
    const second = within(fields).getByRole('group', { name: 'entity field 2' });
    expect(within(second).getByRole('textbox', { name: /^name/ })).toHaveValue('Quantity');
    const valueObject = within(second).getByRole('combobox', { name: /^type value object id/ });
    expect(valueObject).toHaveValue('DM-VO01');
    expect(within(valueObject).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['', 'DM-VO01']);
    const aggregate = within(second).getByRole('combobox', { name: /^type aggregate id/ });
    expect(within(aggregate).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['', 'DM-PAY-A1', 'DM-SHOP-A1']);

    const name = within(second).getByRole('textbox', { name: /^name/ });
    await user.clear(name);
    await user.type(name, 'Count');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([
      { op: 'remove', table: 'entity_field', key: { entity_id: 'DM-SHOP-EN02', position: 1 } },
      { op: 'remove', table: 'entity_field', key: { entity_id: 'DM-SHOP-EN02', position: 2 } },
      { op: 'add', table: 'entity_field', row: { entity_id: 'DM-SHOP-EN02', position: 1, name: 'Item', meaning: 'What is in the basket.', type: 'text', required: true } },
      { op: 'add', table: 'entity_field', row: { entity_id: 'DM-SHOP-EN02', position: 2, name: 'Count', meaning: 'How many.', type_value_object_id: 'DM-VO01', required: true } },
    ]);
  });

  /** A save the store refuses, from a UC requirement's form with its group name typed. */
  const refusedSave = async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'check', table: 'uc_requirement', key: 'DM-SHOP-UC01-R01', command: 0, message: 'uc_requirement.title is empty' }] };
    const { writes } = await openApp('/DM-SHOP-UC01-R01', { write: () => ({ answer: refusal }) });
    await user.click(within(toolbar('DM-SHOP-UC01-R01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-UC01-R01' });
    await user.type(within(form).getByRole('textbox', { name: /^group name/ }), 'Display');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    return { form, writes, alert: await within(form).findByRole('alert') };
  };

  it('LA-V92-R33-T01 shows the store\'s refusal inline, at the top and beside the part of the form it came from', async () => {
    const { form, alert } = await refusedSave();
    expect(alert).toHaveTextContent('The store refused the change. Nothing was saved.');
    expect(alert).toHaveTextContent('DM-SHOP-UC01-R01: uc_requirement.title is empty');
    expect(within(form).getByRole('group', { name: 'Fields' })).toHaveTextContent('uc_requirement.title is empty');
  });

  it('LA-V92-R10-T01 a refused change keeps the form open with the draft, takes focus to the reasons, and changes nothing', async () => {
    const { form, writes, alert } = await refusedSave();
    expect(alert).toHaveFocus();
    expect(writes).toHaveLength(1);
    // The form stays open with what was typed.
    expect(within(form).getByRole('textbox', { name: /^group name/ })).toHaveValue('Display');
  });

  it('does not write while the form has a problem it can see, and says what to fix beside each input', async () => {
    const user = userEvent.setup();
    const { writes } = await openApp('/DM-SHOP-UC01-R01');
    await user.click(within(toolbar('DM-SHOP-UC01-R01')).getByRole('button', { name: 'Edit' }));
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
    expect(within(main()).getByText(/The basket MUST show the item at once/)).toBeInTheDocument();
  });

  it('adds a link only to a valid target, and removes one', async () => {
    const user = userEvent.setup();
    const { writes } = await openApp('/DM-SHOP-UC01-FL01-S01', { write: () => ({ answer: ok }) });
    await user.click(within(toolbar('DM-SHOP-UC01-FL01-S01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form');
    const links = within(form).getByRole('group', { name: 'Links' });
    const happensIn = within(links).getByRole('combobox', { name: /Add a link: Happens in/ });
    // A record of a kind the relation does not allow is refused before any write.
    await user.type(happensIn, 'DM-SHOP-UC01{Enter}');
    expect(within(links).getByText(/DM-SHOP-UC01 is not a view it can link to/)).toBeInTheDocument();
    await user.click(within(links).getByRole('button', { name: /Remove the link Invokes DM-SHOP-CMD01/ }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([{ op: 'unlink', relation: 'invokes', source: 'DM-SHOP-UC01-FL01-S01', target: 'DM-SHOP-CMD01' }]);
  });
});

describe('adding a record', () => {
  it('LA-V92-R31-T01 adds a child from its parent\'s page with a suggested ID, and opens it', async () => {
    const user = userEvent.setup();
    const added = (): SpecData => addRows(workspace(), 'uc_requirement', { id: 'DM-SHOP-UC01-R03', title: 'The basket shows its total', use_case_id: 'DM-SHOP-UC01', statement: 'The basket MUST show its total.' });
    const { writes } = await openApp('/DM-SHOP-UC01', { write: () => ({ answer: ok, data: added() }) });
    const actions = toolbar('DM-SHOP-UC01');
    const add = within(actions).getByRole('button', { name: 'Add…' });
    expect(add).toHaveAttribute('aria-expanded', 'false');
    await user.click(add);
    expect(add).toHaveAttribute('aria-expanded', 'true');
    const kinds = within(actions).getByRole('group', { name: 'Kinds to add under DM-SHOP-UC01' });
    expect(within(kinds).getAllByRole('button').map((b) => b.textContent)).toEqual(['UC requirement', 'Flow']);
    await user.click(within(kinds).getByRole('button', { name: 'UC requirement' }));

    const form = screen.getByRole('form', { name: 'Add a UC requirement' });
    const id = within(form).getByRole('textbox', { name: /^ID/ });
    expect(id).toHaveValue('DM-SHOP-UC01-R03');
    expect(id).toHaveFocus();
    expect(within(form).getByRole('combobox', { name: /^Parent/ })).toHaveValue('DM-SHOP-UC01');
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'The basket shows its total');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'The basket MUST show its total.');
    await user.click(within(form).getByRole('button', { name: 'Add UC requirement' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([{ op: 'add', table: 'uc_requirement', row: { id: 'DM-SHOP-UC01-R03', use_case_id: 'DM-SHOP-UC01', title: 'The basket shows its total', statement: 'The basket MUST show its total.' } }]);
    expect(await screen.findByRole('heading', { level: 1, name: 'The basket shows its total' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/DM-SHOP-UC01-R03');
  });

  it('adds a kind with no owner from the product\'s page: its ID takes the product, and it has no parent to choose', async () => {
    const user = userEvent.setup();
    const { writes } = await openApp('/DM', { write: () => ({ answer: ok }) });
    const actions = toolbar('DM');
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
    await user.click(within(form).getByRole('button', { name: 'Add view' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([{ op: 'add', table: 'view', row: { id: 'DM-V02', title: 'Checkout' } }]);
  });

  it('adds from a domain\'s page the kinds that sit under it, and a specification, which takes its domain from its ID', async () => {
    const user = userEvent.setup();
    await openApp('/DM-SHOP');
    const actions = toolbar('DM-SHOP');
    await user.click(within(actions).getByRole('button', { name: 'Add…' }));
    const kinds = within(within(actions).getByRole('group', { name: 'Kinds to add under DM-SHOP' })).getAllByRole('button').map((b) => b.textContent);
    expect(kinds).toEqual(expect.arrayContaining(['Aggregate', 'Specification', 'Read model', 'Capability', 'Open question']));
    expect(kinds).not.toContain('Value object');
    await user.click(screen.getByRole('button', { name: 'Specification' }));
    const form = screen.getByRole('form', { name: 'Add a specification' });
    expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-SP02');
    expect(within(form).queryByRole('combobox', { name: /^Parent/ })).toBeNull();
  });

  it('refuses an ID that is already a record before writing', async () => {
    const user = userEvent.setup();
    const { writes } = await openApp('/DM-SHOP-UC01');
    await user.click(within(toolbar('DM-SHOP-UC01')).getByRole('button', { name: 'Add…' }));
    await user.click(screen.getByRole('button', { name: 'UC requirement' }));
    const form = screen.getByRole('form');
    const id = within(form).getByRole('textbox', { name: /^ID/ });
    await user.clear(id);
    await user.type(id, 'DM-SHOP-UC01-R01');
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Again');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'It MUST hold.');
    await user.click(within(form).getByRole('button', { name: 'Add UC requirement' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('DM-SHOP-UC01-R01 is already a record.');
    expect(writes).toHaveLength(0);
  });
});

describe('removing a record', () => {
  it('LA-V92-R32-T01 asks first, naming what still references the record, and shows the store\'s refusal inline', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = {
      ok: false,
      error: 'refused',
      problems: [{ rule: 'referenced', table: 'use_case', key: 'DM-SHOP-UC01', command: 0, message: 'use_case DM-SHOP-UC01 is referenced, so it stays: uc_requirement DM-SHOP-UC01-R01 (use_case_id)' }],
    };
    const { writes } = await openApp('/DM-SHOP-UC01', { write: () => ({ answer: refusal }) });
    const remove = within(toolbar('DM-SHOP-UC01')).getByRole('button', { name: 'Remove' });
    await user.click(remove);
    expect(remove).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: 'Remove DM-SHOP-UC01?' });
    expect(within(panel).getByRole('heading', { name: 'Remove DM-SHOP-UC01?' })).toHaveFocus();
    expect(panel).toHaveTextContent('These 3 still reference it');
    expect(within(panel).getByRole('link', { name: /DM-SHOP-UC01-R01/ }).closest('li')).toHaveTextContent('sits under it');
    expect(within(panel).getByRole('link', { name: /DM-SHOP-UC01-R02/ })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /DM-SHOP-UC01-FL01/ })).toBeInTheDocument();
    expect(panel).toHaveTextContent('with its 1 part row');
    // Nothing is written until the person confirms.
    expect(writes).toHaveLength(0);

    await user.click(within(panel).getByRole('button', { name: 'Remove DM-SHOP-UC01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The store refused to remove it. Nothing was changed.');
    expect(alert).toHaveTextContent('uc_requirement DM-SHOP-UC01-R01 (use_case_id)');
    expect(writes).toEqual([[{ op: 'remove', table: 'use_case', key: 'DM-SHOP-UC01' }]]);
    expect(window.location.pathname).toBe('/DM-SHOP-UC01');
    // Cancel closes the question and gives focus back to the actions.
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Remove DM-SHOP-UC01?' })).toBeNull();
    await waitFor(() => expect(within(toolbar('DM-SHOP-UC01')).getByRole('button', { name: 'Edit' })).toHaveFocus());
  });

  it('removes a record nothing references, and goes to its parent', async () => {
    const user = userEvent.setup();
    const removed = (): SpecData => removeRows(workspace(), 'question', (r) => r.id === 'DM-SHOP-Q01');
    const { writes } = await openApp('/DM-SHOP-Q01', { write: () => ({ answer: ok, data: removed() }) });
    await user.click(within(toolbar('DM-SHOP-Q01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-SHOP-Q01?' });
    expect(panel).toHaveTextContent('Nothing else references it.');
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-SHOP-Q01' }));
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP'));
    expect(writes).toEqual([[{ op: 'remove', table: 'question', key: 'DM-SHOP-Q01' }]]);
  });
});
