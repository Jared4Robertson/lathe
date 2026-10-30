import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { SpecData, WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, removeRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// Changing records in place, for a kind whose aggregate has no editor of its own yet: Edit, Add and Remove on a
// record's page, the form generated from the schema, one write per change through POST /api/write, and the store's
// refusals shown inline. The Use case aggregate's own editor is use-case-page.test.tsx's.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.getByRole('toolbar', { name: `Change ${id}` });

describe('editing a record', () => {
  /** An invariant's page with its form open, whose save gives back the invariant changed. */
  const invariantForm = async () => {
    const user = userEvent.setup();
    const changed = (): SpecData => setRow(workspace(), 'invariant', 'DM-SHOP-INV01', { statement: 'A basket MUST NOT hold more than 40 items.' });
    const { writes } = await openApp('/DM-SHOP-INV01', { write: () => ({ answer: ok, data: changed() }) });
    await user.click(within(toolbar('DM-SHOP-INV01')).getByRole('button', { name: 'Edit' }));
    return { user, writes, form: screen.getByRole('form', { name: 'Edit DM-SHOP-INV01' }) };
  };

  it('LA-V92-R30-T01 opens a form of typed inputs, generated from the schema, each labeled and described by its column', async () => {
    const { form } = await invariantForm();
    // Every input has its label; the first takes focus; a required one says so; its column's meaning describes it.
    const title = within(form).getByRole('textbox', { name: /^title/ });
    expect(title).toHaveFocus();
    expect(title).toHaveValue('A basket holds at most 50 items');
    expect(title).toHaveAttribute('aria-required', 'true');
    const statement = within(form).getByRole('textbox', { name: /^statement/ });
    expect(statement.tagName).toBe('TEXTAREA');
    expect(statement).toHaveAccessibleDescription(/MUST/);
  });

  it('LA-V92-R30-T01 the parent is picked among the records it may name, in the same product', async () => {
    const { form } = await invariantForm();
    const parent = within(form).getByRole('combobox', { name: /^Parent/ });
    expect(within(parent).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['DM-PAY-A1', 'DM-SHOP-A1']);
  });

  it('LA-V92-R29-T01 Edit opens the form in place; Save writes only what changed and shows the record changed', async () => {
    const { user, writes, form } = await invariantForm();
    const statement = within(form).getByRole('textbox', { name: /^statement/ });
    await user.clear(statement);
    await user.type(statement, 'A basket MUST NOT hold more than 40 items.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([{ op: 'set', table: 'invariant', key: 'DM-SHOP-INV01', changes: { statement: 'A basket MUST NOT hold more than 40 items.' } }]);
    await waitFor(() => expect(screen.queryByRole('form')).toBeNull());
    expect(within(main()).getByText('A basket MUST NOT hold more than 40 items.')).toBeInTheDocument();
    // Focus comes back to the record's actions.
    await waitFor(() => expect(within(toolbar('DM-SHOP-INV01')).getByRole('button', { name: 'Edit' })).toHaveFocus());
  });

  it('LA-V92-R29-T01 edits part rows in place: a field\'s name and its type, a value object or an aggregate chosen among the product\'s', async () => {
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

  /** A save the store refuses, from an invariant's form with its statement added to. */
  const refusedSave = async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'check', table: 'invariant', key: 'DM-SHOP-INV01', command: 0, message: 'invariant.title is empty' }] };
    const { writes } = await openApp('/DM-SHOP-INV01', { write: () => ({ answer: refusal }) });
    await user.click(within(toolbar('DM-SHOP-INV01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-INV01' });
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), ' Display');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    return { form, writes, alert: await within(form).findByRole('alert') };
  };

  it('LA-V92-R33-T01 shows the store\'s refusal inline, at the top and beside the part of the form it came from', async () => {
    const { form, alert } = await refusedSave();
    expect(alert).toHaveTextContent('The store refused the change. Nothing was saved.');
    expect(alert).toHaveTextContent('DM-SHOP-INV01: invariant.title is empty');
    expect(within(form).getByRole('group', { name: 'Fields' })).toHaveTextContent('invariant.title is empty');
  });

  it('LA-V92-R10-T01 a refused change keeps the form open with the draft, takes focus to the reasons, and changes nothing', async () => {
    const { form, writes, alert } = await refusedSave();
    expect(alert).toHaveFocus();
    expect(writes).toHaveLength(1);
    // The form stays open with what was typed.
    expect(within(form).getByRole('textbox', { name: /^statement/ })).toHaveValue('A basket MUST NOT hold more than 50 items. Display');
  });

  it('LA-V92-R30-T01 does not write while the form has a problem it can see, and says what to fix beside each input', async () => {
    const user = userEvent.setup();
    const { writes } = await openApp('/DM-SHOP-INV01');
    await user.click(within(toolbar('DM-SHOP-INV01')).getByRole('button', { name: 'Edit' }));
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
    expect(within(main()).getByText(/A basket MUST NOT hold more than 50 items/)).toBeInTheDocument();
  });

  it('LA-V92-R30-T01 adds a link only to a valid target, and removes one', async () => {
    const user = userEvent.setup();
    const { writes } = await openApp('/DM-SHOP-CMD01', { write: () => ({ answer: ok }) });
    await user.click(within(toolbar('DM-SHOP-CMD01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form');
    const links = within(form).getByRole('group', { name: 'Links' });
    const raises = within(links).getByRole('combobox', { name: /Add to Raises/ });
    // A record of a kind the relation does not allow is refused before any write.
    await user.type(raises, 'DM-SHOP-UC01{Enter}');
    expect(within(links).getByText(/DM-SHOP-UC01 is not one it can name/)).toBeInTheDocument();
    await user.click(within(links).getByRole('button', { name: /Remove DM-SHOP-EV01 from Raises/ }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([{ op: 'unlink', relation: 'raises', source: 'DM-SHOP-CMD01', target: 'DM-SHOP-EV01' }]);
  });
});

describe('adding a record', () => {
  it('LA-V92-R31-T01 adds a child from its parent\'s page with a suggested ID, and opens it', async () => {
    const user = userEvent.setup();
    const added = (): SpecData => addRows(workspace(), 'invariant', { id: 'DM-SHOP-INV02', title: 'A line holds at least one item', aggregate_id: 'DM-SHOP-A1', statement: 'A basket line MUST hold at least one item.' });
    const { writes } = await openApp('/DM-SHOP-A1', { write: () => ({ answer: ok, data: added() }) });
    const actions = toolbar('DM-SHOP-A1');
    const add = within(actions).getByRole('button', { name: 'Add…' });
    expect(add).toHaveAttribute('aria-expanded', 'false');
    await user.click(add);
    expect(add).toHaveAttribute('aria-expanded', 'true');
    const kinds = within(actions).getByRole('group', { name: 'Kinds to add under DM-SHOP-A1' });
    expect(within(kinds).getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Entity', 'Invariant']));
    await user.click(within(kinds).getByRole('button', { name: 'Invariant' }));

    const form = screen.getByRole('form', { name: 'Add an invariant' });
    const id = within(form).getByRole('textbox', { name: /^ID/ });
    expect(id).toHaveValue('DM-SHOP-INV02');
    expect(id).toHaveFocus();
    expect(within(form).getByRole('combobox', { name: /^Parent/ })).toHaveValue('DM-SHOP-A1');
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'A line holds at least one item');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'A basket line MUST hold at least one item.');
    await user.click(within(form).getByRole('button', { name: 'Add invariant' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([{ op: 'add', table: 'invariant', row: { id: 'DM-SHOP-INV02', aggregate_id: 'DM-SHOP-A1', title: 'A line holds at least one item', statement: 'A basket line MUST hold at least one item.' } }]);
    expect(await screen.findByRole('heading', { level: 1, name: 'A line holds at least one item' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/DM-SHOP-INV02');
  });

  it('LA-V92-R30-T01 refuses an ID that is already a record before writing', async () => {
    const user = userEvent.setup();
    const { writes } = await openApp('/DM-SHOP-A1');
    await user.click(within(toolbar('DM-SHOP-A1')).getByRole('button', { name: 'Add…' }));
    await user.click(screen.getByRole('button', { name: 'Invariant' }));
    const form = screen.getByRole('form');
    const id = within(form).getByRole('textbox', { name: /^ID/ });
    await user.clear(id);
    await user.type(id, 'DM-SHOP-INV01');
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Again');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'It MUST hold.');
    await user.click(within(form).getByRole('button', { name: 'Add invariant' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('DM-SHOP-INV01 is already a record.');
    expect(writes).toHaveLength(0);
  });
});

describe('removing a record', () => {
  it('LA-V92-R32-T01 asks first, naming what still references the record, and shows the store\'s refusal inline', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = {
      ok: false,
      error: 'refused',
      problems: [{ rule: 'referenced', table: 'aggregate', key: 'DM-SHOP-A1', command: 0, message: 'aggregate DM-SHOP-A1 is referenced, so it stays: invariant DM-SHOP-INV01 (aggregate_id)' }],
    };
    const { writes } = await openApp('/DM-SHOP-A1', { write: () => ({ answer: refusal }) });
    const remove = within(toolbar('DM-SHOP-A1')).getByRole('button', { name: 'Remove' });
    await user.click(remove);
    expect(remove).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: 'Remove DM-SHOP-A1?' });
    expect(within(panel).getByRole('heading', { name: 'Remove DM-SHOP-A1?' })).toHaveFocus();
    expect(panel).toHaveTextContent(/These \d+ still reference it/);
    expect(within(panel).getByRole('link', { name: /DM-SHOP-INV01/ }).closest('li')).toHaveTextContent('sits under it');
    // Nothing is written until the person confirms.
    expect(writes).toHaveLength(0);

    await user.click(within(panel).getByRole('button', { name: 'Remove DM-SHOP-A1' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The store refused to remove it. Nothing was changed.');
    expect(alert).toHaveTextContent('invariant DM-SHOP-INV01 (aggregate_id)');
    expect(writes).toEqual([[{ op: 'remove', table: 'aggregate', key: 'DM-SHOP-A1' }]]);
    expect(window.location.pathname).toBe('/DM-SHOP-A1');
    // Cancel closes the question and gives focus back to the actions.
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Remove DM-SHOP-A1?' })).toBeNull();
    await waitFor(() => expect(within(toolbar('DM-SHOP-A1')).getByRole('button', { name: 'Edit' })).toHaveFocus());
  });

  it('LA-V92-R32-T01 removes a record nothing references, and goes to its parent', async () => {
    const user = userEvent.setup();
    // An entity nothing references, on a kind whose aggregate has no page of its own yet.
    const withNote = (): SpecData => addRows(workspace(), 'entity', { id: 'DM-SHOP-EN09', title: 'Gift note', aggregate_id: 'DM-SHOP-A1', role: 'child', description: 'A note sent with a gift.' });
    const removed = (): SpecData => removeRows(withNote(), 'entity', (r) => r.id === 'DM-SHOP-EN09');
    const { writes } = await openApp('/DM-SHOP-EN09', { data: withNote(), write: () => ({ answer: ok, data: removed() }) });
    await user.click(within(toolbar('DM-SHOP-EN09')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-SHOP-EN09?' });
    expect(panel).toHaveTextContent('Nothing else references it.');
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-SHOP-EN09' }));
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP-A1'));
    expect(writes).toEqual([[{ op: 'remove', table: 'entity', key: 'DM-SHOP-EN09' }]]);
  });
});
