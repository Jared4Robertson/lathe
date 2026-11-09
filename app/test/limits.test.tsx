import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { openApp, section } from './helpers';

// The Product page's Limits (LA-CHK-A2, LA-V51): a product's limits are read through the Product setting aggregate's
// own query, its own or the defaults, and changed only through its own command, Set limits, each refusal shown with its
// reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const fact = (scope: HTMLElement, label: string) => within(scope).getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;

/** The Limits section once it has read the product's limits. */
async function limits() {
  await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
  await waitFor(() => expect(within(section(/^Limits/)).queryByRole('status')).toBeNull());
  return section(/^Limits/);
}

describe('LA-V51-R10-T01 a product\'s limits are read through the Product setting aggregate\'s own query', () => {
  it('reads GET /api/product-setting/get-limits, and shows the defaults of a product without its own', async () => {
    const { requests } = await openApp('/DM');
    const shown = await limits();
    expect(requests).toContain('GET /api/product-setting/get-limits?product_id=DM');
    expect(shown).toHaveTextContent('The defaults: this product has not set its own.');
    expect(fact(shown, 'Children limit')).toBe('15');
    expect(fact(shown, 'Entities limit')).toBe('7');
  });

  it('shows the limits a product set as its own', async () => {
    await openApp('/DM', { data: addRows(workspace(), 'product_setting', { product_id: 'DM', max_children: 20, max_entities_per_aggregate: 5, technology_words: [] }) });
    const shown = await limits();
    expect(shown).toHaveTextContent('Set for this product.');
    expect(fact(shown, 'Children limit')).toBe('20');
    expect(fact(shown, 'Entities limit')).toBe('5');
  });
});

describe("LA-V51-R14-T01 the Limits section says whether the product's check is strict", () => {
  it('says not strict by default, strict, and strict beyond the accepted warnings as a recorded deviation', async () => {
    const { unmount } = await openApp('/DM');
    expect(fact(await limits(), 'Check')).toBe('Not strict: warnings never fail it');
    unmount();
    const strict = (accepted?: number) => addRows(workspace(), 'product_setting', { product_id: 'DM', max_children: 15, max_entities_per_aggregate: 7, technology_words: [], strict_check: true, ...(accepted ? { accepted_warnings: accepted } : {}) });
    const plain = await openApp('/DM', { data: strict() });
    expect(fact(await limits(), 'Check')).toBe('Strict: warnings fail');
    plain.unmount();
    await openApp('/DM', { data: strict(11) });
    expect(fact(await limits(), 'Check')).toBe('Strict: warnings fail, beyond 11 accepted (a recorded deviation)');
  });
});

describe('LA-V51-R11-T01 Set limits writes only through the Product setting aggregate\'s own command', () => {
  it('sends Set limits with both limits, starting at the ones the product has now', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM', { command: () => ({ answer: ok }) });
    await user.click(within(within(await limits()).getByRole('toolbar', { name: 'Change the limits of DM' })).getByRole('button', { name: 'Set limits' }));
    const form = screen.getByRole('form', { name: 'Set limits' });
    const children = within(form).getByRole('spinbutton', { name: /^Children limit/ });
    expect(children).toHaveValue(15);
    await user.clear(children);
    await user.type(children, '12');
    await user.click(within(form).getByRole('button', { name: 'Set limits' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/product-setting/set-limits', input: { product_id: 'DM', max_children: 12, max_entities_per_aggregate: 7 } }]));
  });
});

describe('LA-V51-R12-T01 a refused Set limits shows every reason, keeps what was entered, and changes nothing', () => {
  it('keeps the form open with the reasons at its top, focused', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'check', table: 'product_setting', key: 'DM', message: 'max_children must be at least 1' }] };
    const { commands } = await openApp('/DM', { command: () => ({ answer: refusal }) });
    await user.click(within(within(await limits()).getByRole('toolbar', { name: 'Change the limits of DM' })).getByRole('button', { name: 'Set limits' }));
    const form = screen.getByRole('form', { name: 'Set limits' });
    const children = within(form).getByRole('spinbutton', { name: /^Children limit/ });
    await user.clear(children);
    await user.type(children, '0');
    await user.click(within(form).getByRole('button', { name: 'Set limits' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('max_children must be at least 1');
    expect(alert).toHaveFocus();
    expect(children).toHaveValue(0);
    expect(commands).toEqual([{ route: '/api/product-setting/set-limits', input: { product_id: 'DM', max_children: 0, max_entities_per_aggregate: 7 } }]);
  });
});
