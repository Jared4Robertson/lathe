import type { ServedData } from './read-view';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addRows } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { facts, openApp } from './helpers';

// A record's Serves line (LA-TRC-UC20): the business outcomes it serves, read through the Serves read model's own
// query and worked out from the use cases that reach it, never typed in.

/** The demo shop with an outcome its Basket aggregate serves, and a storage requirement on the basket. */
function withOutcome(): ServedData {
  const w = workspace();
  addRows(w, 'business_outcome', { id: 'DM-BO01', title: 'More baskets checked out', product_id: 'DM', statement: 'More of the baskets shoppers fill are checked out.', measure: 'Baskets checked out over baskets started, each week.', target: 'Two in three within a quarter.' });
  addRows(w, 'serves', { source_id: 'DM-SHOP-A1', target_id: 'DM-BO01' });
  addRows(w, 'storage_requirement', { id: 'DM-SHOP-A1-SR01', title: 'A basket survives a restart', aggregate_id: 'DM-SHOP-A1', statement: 'A saved basket MUST survive a restart.' });
  return w;
}

const serves = async () => {
  const term = await within(facts()).findByText('Serves', { selector: 'dt' });
  return term.nextElementSibling as HTMLElement;
};

describe('LA-V92-R78-T01 every record page names the outcomes it serves, each a link, or says none reaches it', () => {
  it('names the outcome an aggregate, its storage requirement and a view requirement serve, read through get-serves', async () => {
    for (const [id, title] of [['DM-SHOP-A1', 'Basket'], ['DM-SHOP-A1-SR01', 'A basket survives a restart'], ['DM-V01-R01', 'Shows the total']]) {
      const { requests } = await openApp(`/${id}`, { data: withOutcome() });
      await screen.findByRole('heading', { level: 1, name: title });
      const line = await serves();
      expect(within(line).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/DM-BO01']);
      expect(line).toHaveTextContent('More baskets checked out');
      expect(requests).toContain(`GET /api/serves/get-serves?id=${id}`);
    }
  });

  it('says no use case reaches an aggregate none reaches, and links the check that reports it', async () => {
    await openApp('/DM-PAY-A1', { data: withOutcome() });
    await screen.findByRole('heading', { level: 1, name: 'Payment' });
    const line = await serves();
    expect(line).toHaveTextContent('No outcome: no use case reaches it.');
    expect(within(line).getByRole('link', { name: 'serves-no-outcome' })).toHaveAttribute('href', '/DM-PAY-A1?page=format/checks/serves-no-outcome');
  });

  it('gives a business outcome no Serves line: it is what is served', async () => {
    await openApp('/DM-BO01', { data: withOutcome() });
    await screen.findByRole('heading', { level: 1, name: 'More baskets checked out' });
    await within(facts()).findByText('Kind', { selector: 'dt' });
    expect(within(facts()).queryByText('Serves', { selector: 'dt' })).toBeNull();
  });
});
