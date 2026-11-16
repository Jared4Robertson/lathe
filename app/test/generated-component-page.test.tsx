import type { ServedData } from './read-view';
import { addChoices } from './add-menu';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows } from './fixtures/load';
import { modelWorkspace } from './fixtures/model';
import { main, openApp, section } from './helpers';

// The Generated component page and its editor (LA-MOD-A25, LA-V159): a generated component is read through its aggregate's own query and changed only through
// its own commands, one per change, each refusal shown with its reasons; it is added from a business domain's page,
// and a platform domain's page offers none.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

/** The model product, whose domain P-D ships a generated component, P-D-GC01, serving one outcome and making one guarantee; and a platform domain. */
function withMaker(): ServedData {
  const w = modelWorkspace();
  addRows(w, 'domain', { id: 'P-PLT', title: 'Platform', product_id: 'P', position: 3, subdomain_type: 'generic', platform: true, description: 'What every domain stands on.' });
  addRows(w, 'business_outcome', { id: 'P-BO09', title: 'Branches run alike', product_id: 'P', statement: 'Every branch runs the same way.', measure: 'Branches that differ.', target: 'None by next year.' });
  addRows(w, 'generated_component', { id: 'P-D-GC01', title: 'Order adapter', domain_id: 'P-D', description: 'The order store the generator emits into every branch service.' });
  addRows(w, 'serves', { source_id: 'P-D-GC01', target_id: 'P-BO09' });
  addRows(w, 'guarantee', { id: 'P-D-GC01-GU01', title: 'Each record is kept once', generated_component_id: 'P-D-GC01', statement: 'It MUST keep each record once.', consumers: 'Every branch service.' });
  return w;
}

describe('LA-V159-R02-T01 a generated component shows its description, the outcomes it serves and the guarantees it makes', () => {
  it('draws its description, its Serves link and its Guarantees section', async () => {
    await openApp('/P-D-GC01', { data: withMaker() });
    await within(main()).findByText('The order store the generator emits into every branch service.');
    expect(section(/^Guarantees/)).toHaveTextContent('P-D-GC01-GU01');
    expect(section(/^Serves/)).toHaveTextContent('P-BO09');
  });
});

describe('LA-V159-R03-T01 the Generated component editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a generated component with only what changed; Add offers a guarantee; no Move; only a business domain offers it', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P-D-GC01', { data: withMaker(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P-D-GC01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add guarantee', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-D-GC01' });
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), ' Always.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/generated-component/change-generated-component', input: { id: 'P-D-GC01', description: 'The order store the generator emits into every branch service. Always.' } }]));
    await openApp('/P-D', { data: withMaker(), command: () => ({ answer: ok }) });
    expect(await addChoices(user, await toolbar('P-D'))).toContain('Generated component');
    await openApp('/P-PLT', { data: withMaker(), command: () => ({ answer: ok }) });
    expect(await addChoices(user, await toolbar('P-PLT'))).not.toContain('Generated component');
  });
});

describe('LA-V159-R01-T01 a refused Generated component command shows every reason, keeps the draft and changes nothing', () => {
  it('a refused Change keeps the draft and focuses the reasons', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'missing', table: 'serves', key: 'P-D-GC01', message: 'there is no business outcome P-BO99' }] };
    const { commands } = await openApp('/P-D-GC01', { data: withMaker(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('P-D-GC01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-D-GC01' });
    await user.clear(within(form).getByRole('textbox', { name: /^title/ }));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Renamed');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('there is no business outcome P-BO99');
    expect(alert).toHaveFocus();
    expect(within(form).getByRole('textbox', { name: /^title/ })).toHaveValue('Renamed');
    expect(commands).toHaveLength(1);
  });
});
