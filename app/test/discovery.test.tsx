import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordContent } from '../src/specs/RecordContent';
import { traceOf } from '../src/specs/trace';
import { addRows, indexOf, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp, section } from './helpers';

// Discovery and test data: a product's business outcomes on its page (LA-V51-R05), and a test data set's page and a
// test's size and markers on the record page (LA-V92-R75).

afterEach(() => cleanup());

/** The demo shop with two business outcomes, the first served by its one capability, and a data set its test starts from. */
function withOutcomes() {
  const w = workspace();
  addRows(
    w,
    'business_outcome',
    { id: 'DM-BO01', title: 'More baskets checked out', product_id: 'DM', statement: 'More of the baskets shoppers fill are checked out.', measure: 'Baskets checked out over baskets started, each week.', target: 'Two in three within a quarter.' },
    { id: 'DM-BO02', title: 'Fewer refunds', product_id: 'DM', statement: 'Shoppers ask for fewer refunds.', measure: 'Refunds per hundred orders, each month.', target: 'Under two within a year.' },
  );
  addRows(w, 'serves', { source_id: 'DM-SHOP-CAP01', target_id: 'DM-BO01' });
  addRows(w, 'test_data_set', {
    id: 'DM-SHOP-TD01', title: 'A basket with two items', domain_id: 'DM-SHOP', environment: 'A fresh in-memory store.', records: 'One shopper and a basket of two items.',
    prepare: 'Run the basket seed.', reset: 'Drop the store.', file: 'test/basket-seed.ts',
  });
  addRows(w, 'starts_from', { source_id: 'DM-SHOP-UC01-R01-T01', target_id: 'DM-SHOP-TD01' });
  setRow(w, 'use_case_test', 'DM-SHOP-UC01-R01-T01', { size: 'volume', smoke: true });
  return w;
}

describe('discovery', () => {
  it('LA-V51-R05-T01 The product page lists its business outcomes first, each with its statement, measure, target and the capabilities that serve it', async () => {
    await openApp('/DM', { data: withOutcomes() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const outcomes = section(/^Business outcomes/);
    expect(outcomes).toHaveClass('stage-discovery');
    const items = within(outcomes).getAllByRole('listitem').filter((li) => li.classList.contains('outcome'));
    expect(items.map((li) => li.querySelector('a.row-link code')?.textContent)).toEqual(['DM-BO01', 'DM-BO02']);
    expect(items[0]).toHaveTextContent('More of the baskets shoppers fill are checked out.');
    expect(items[0]).toHaveTextContent(/Measure\s*Baskets checked out over baskets started, each week\./);
    expect(items[0]).toHaveTextContent(/Target\s*Two in three within a quarter\./);
    expect(within(items[0]).getByRole('link', { name: /DM-SHOP-CAP01/ })).toHaveAttribute('href', '/DM-SHOP-CAP01');
    // An outcome no capability serves says so.
    expect(items[1]).toHaveTextContent(/Served by\s*No capability yet\./);
    // They come before the domains, and Shared does not list them again.
    const headings = within(main()).getAllByRole('heading', { level: 2 }).map((h) => h.firstChild?.textContent);
    expect(headings.indexOf('Business outcomes')).toBeLessThan(headings.indexOf('Domains'));
    expect(main().querySelector('.product-shared .stage-discovery')).toBeNull();
  });

  it('LA-V92-R75-T01 A capability shows the outcomes it serves; a test data set shows its setup and the tests that start from it; a test shows its size and markers', () => {
    const index = indexOf(withOutcomes());
    const trace = () => screen.getByRole('heading', { level: 2, name: 'Traceability' }).closest('section') as HTMLElement;
    const show = (id: string) => render(<RecordContent index={index} id={id} onNavigate={vi.fn()} side={false} />);

    show('DM-SHOP-CAP01');
    expect(within(trace()).getByRole('heading', { level: 3, name: /^Serves/ })).toBeInTheDocument();
    expect(within(trace()).getByRole('link', { name: /DM-BO01/ })).toBeInTheDocument();
    cleanup();

    show('DM-SHOP-TD01');
    const page = within(document.body);
    for (const [title, text] of [['Environment', 'A fresh in-memory store.'], ['Starting records', 'One shopper and a basket of two items.'], ['Prepare', 'Run the basket seed.'], ['Reset', 'Drop the store.']]) {
      expect(page.getByRole('heading', { name: title }).closest('section')).toHaveTextContent(text);
    }
    expect(within(trace()).getByRole('heading', { level: 3, name: /^Starting point of/ })).toBeInTheDocument();
    expect(within(trace()).getByRole('link', { name: /DM-SHOP-UC01-R01-T01/ })).toBeInTheDocument();
    // A data set is not a test: it has no run by.
    expect(traceOf(index, index.byId.get('DM-SHOP-TD01')!).runBy).toBeNull();
    cleanup();

    show('DM-SHOP-UC01-R01-T01');
    const runBy = within(trace()).getByRole('heading', { level: 3, name: 'Run by' }).closest('section') as HTMLElement;
    expect(runBy).toHaveTextContent(/Size\s*volume/);
    expect(runBy).toHaveTextContent(/Markers\s*smoke/);
    expect(within(trace()).getByRole('heading', { level: 3, name: /^Starts from/ })).toBeInTheDocument();
    // A test that gives neither is small, with no markers.
    expect(traceOf(index, index.byId.get('DM-SHOP-INV01-T')!).runBy).toMatchObject({ size: 'small', markers: [] });
  });
});
