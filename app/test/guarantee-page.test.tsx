import type { ServedData } from './read-view';
import { addChoices, chooseAdd } from './add-menu';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows } from './fixtures/load';
import { modelWorkspace } from './fixtures/model';
import { main, openApp, section } from './helpers';

// The Guarantee page and its editor (LA-MOD-A24, LA-V158): a guarantee and its tests are read through the aggregate's
// own query, and changed only through the aggregate's own commands, one per change, each refusal shown with its
// reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

/** The model product with a platform domain, P-PLT, that makes one guarantee kept by its build script, with one test. */
function withGuarantee(): ServedData {
  const w = modelWorkspace();
  addRows(w, 'domain', { id: 'P-PLT', title: 'Platform', product_id: 'P', position: 3, subdomain_type: 'generic', platform: true, description: 'What every domain stands on.' });
  addRows(w, 'tooling', { id: 'P-PLT-TOOL01', title: 'build', domain_id: 'P-PLT', file: 'scripts/build.ts' });
  addRows(w, 'guarantee', { id: 'P-PLT-GU01', title: 'Every domain is built the same way', domain_id: 'P-PLT', statement: 'Every domain MUST be built by the build, the same way.' });
  addRows(w, 'guarantee_test', { id: 'P-PLT-GU01-T01', title: 'The build writes every domain', guarantee_id: 'P-PLT-GU01', level: 'integration', state: 'not automated yet', when: 'Builds the product.', then: 'Expects every domain written.' });
  addRows(w, 'kept_by', { source_id: 'P-PLT-GU01', target_id: 'P-PLT-TOOL01' });
  return w;
}

describe('LA-V158-R02-T01 a guarantee shows its statement, the building blocks that keep it and its guarantee tests', () => {
  it('lists what keeps it and its test, and a test its scenario', async () => {
    await openApp('/P-PLT-GU01', { data: withGuarantee() });
    await within(main()).findByRole('heading', { name: /^Kept by/ });
    expect(section(/^Kept by/)).toHaveTextContent('P-PLT-TOOL01');
    expect(section(/^Guarantee tests/)).toHaveTextContent('P-PLT-GU01-T01');
    await openApp('/P-PLT-GU01-T01', { data: withGuarantee() });
    await within(main()).findByText('Builds the product.');
  });
});

describe('LA-V158-R03-T01 the Guarantee editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a guarantee with only what changed; Add offers a guarantee test with the next free ID; no Move', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P-PLT-GU01', { data: withGuarantee(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P-PLT-GU01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add guarantee test', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-PLT-GU01' });
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), ' Always.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/guarantee/change-guarantee', input: { id: 'P-PLT-GU01', statement: 'Every domain MUST be built by the build, the same way. Always.' } }]));

    await chooseAdd(user, await toolbar('P-PLT-GU01'), 'Guarantee test');
    const add = screen.getByRole('form', { name: 'Add a guarantee test' });
    await waitFor(() => expect(within(add).getByRole('textbox', { name: /^ID/ })).toHaveValue('P-PLT-GU01-T02'));
  });

  it('a guarantee is added from its platform domain\'s page, and a business domain offers none', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P-PLT', { data: withGuarantee(), command: () => ({ answer: ok }) });
    await chooseAdd(user, await toolbar('P-PLT'), 'Guarantee');
    const add = screen.getByRole('form', { name: 'Add a guarantee' });
    await waitFor(() => expect(within(add).getByRole('textbox', { name: /^ID/ })).toHaveValue('P-PLT-GU02'));
    await user.type(within(add).getByRole('textbox', { name: /^title/ }), 'Every change is checked');
    await user.type(within(add).getByRole('textbox', { name: /^statement/ }), 'Every change MUST be checked whole.');
    await chooseAdd(user, add, 'Guarantee');
    await waitFor(() => expect(commands).toEqual([{ route: '/api/guarantee/add-guarantee', input: { id: 'P-PLT-GU02', title: 'Every change is checked', statement: 'Every change MUST be checked whole.', domain_id: 'P-PLT' } }]));
    // The platform domain offers no use case, aggregate or read model; a business domain offers no guarantee.
    await openApp('/P-PLT', { data: withGuarantee(), command: () => ({ answer: ok }) });
    expect(await addChoices(user, await toolbar('P-PLT'))).not.toEqual(expect.arrayContaining(['Aggregate']));
    expect(await addChoices(user, await toolbar('P-PLT'))).not.toContain('Use case');
    await openApp('/P-D', { data: withGuarantee(), command: () => ({ answer: ok }) });
    const choices = await addChoices(user, await toolbar('P-D'));
    expect(choices).toContain('Aggregate');
    expect(choices).not.toContain('Guarantee');
  });
});

describe('LA-V158-R01-T01 a refused Guarantee command shows every reason, keeps what was entered, and changes nothing', () => {
  it('a refused Change keeps the draft and focuses the reasons', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'missing', table: 'kept_by', key: 'P-PLT-GU01', message: 'there is no record P-PLT-TOOL09' }] };
    const { commands } = await openApp('/P-PLT-GU01', { data: withGuarantee(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('P-PLT-GU01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-PLT-GU01' });
    await user.clear(within(form).getByRole('textbox', { name: /^title/ }));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Every domain is built alike');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('there is no record P-PLT-TOOL09');
    expect(alert).toHaveFocus();
    expect(within(form).getByRole('textbox', { name: /^title/ })).toHaveValue('Every domain is built alike');
    expect(commands).toHaveLength(1);
  });
});
