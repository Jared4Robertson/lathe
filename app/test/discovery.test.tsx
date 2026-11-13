import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GET_RECORD_TRACE } from '../../lathe/src/traceability/record-trace/queries';
import type { RecordTrace } from '../../lathe/src/traceability/record-trace/read-model';
import { answerQuery } from '../../lathe/src/platform/commands/run';
import { Traceability } from '../src/specs/Traceability';
import { addRows, setRow } from './fixtures/load';
import { readViewOf, recordIndexOf, type ServedData } from './read-view';
import { workspace } from './fixtures/workspace';
import { main, openApp, section, serve } from './helpers';

// Discovery and test data: a product's business outcomes on its page (LA-V51-R05), a test's size and markers on the
// record page (LA-V92-R75), and the outcomes a test measures (LA-V92-R76). An outcome's own page is the Business outcome
// aggregate's (business-outcome-page.test.tsx); a test data set's page is its aggregate's (test-data-set-page.test.tsx).

afterEach(() => cleanup());

/** One record's Traceability section, as its page frame draws it, read from the test server. */
async function traceSection(data: ServedData, id: string) {
  serve({ data });
  const index = recordIndexOf(data);
  render(<Traceability index={index} record={index.byId.get(id)!} />);
  return (await screen.findByRole('heading', { level: 2, name: 'Traceability' })).closest('section') as HTMLElement;
}
/** The record's trace, as the Record trace read answers it over the data. */
const traceOf = (data: ServedData, id: string) => answerQuery(readViewOf(data), GET_RECORD_TRACE, { id }) as RecordTrace;

/** The demo shop with two business outcomes, the first served by the Basket aggregate, and a data set its test starts from. */
function withOutcomes() {
  const w = workspace();
  addRows(
    w,
    'business_outcome',
    { id: 'DM-BO01', title: 'More baskets checked out', product_id: 'DM', statement: 'More of the baskets shoppers fill are checked out.', measure: 'Baskets checked out over baskets started, each week.', target: 'Two in three within a quarter.' },
    { id: 'DM-BO02', title: 'Fewer refunds', product_id: 'DM', statement: 'Shoppers ask for fewer refunds.', measure: 'Refunds per hundred orders, each month.', target: 'Under two within a year.' },
  );
  addRows(w, 'serves', { source_id: 'DM-SHOP-A1', target_id: 'DM-BO01' });
  addRows(w, 'measured_by', { source_id: 'DM-BO01', target_id: 'DM-SHOP-UC01-R01-T01' });
  setRow(w, 'business_outcome', 'DM-BO02', { measured_outside: 'Counted from the payment provider\'s refund report each month.' });
  addRows(w, 'test_data_set', {
    id: 'DM-SHOP-TD01', title: 'A basket with two items', domain_id: 'DM-SHOP', environment: 'A fresh in-memory store.', records: 'One shopper and a basket of two items.',
    prepare: 'Run the basket seed.', reset: 'Drop the store.', file: 'test/basket-seed.ts' });
  addRows(w, 'starts_from', { source_id: 'DM-SHOP-UC01-R01-T01', target_id: 'DM-SHOP-TD01' });
  setRow(w, 'use_case_test', 'DM-SHOP-UC01-R01-T01', { size: 'volume', smoke: true });
  return w;
}

describe('discovery', () => {
  it('LA-V51-R05-T01 The product page lists its business outcomes first, each with its statement, measure, target and the aggregates and read models that serve it', async () => {
    await openApp('/DM', { data: withOutcomes() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const outcomes = section(/^Business outcomes/);
    expect(outcomes).toHaveClass('stage-discovery');
    const items = [...within(outcomes).getByRole('list', { name: 'Business outcomes' }).querySelectorAll<HTMLElement>(':scope > .card')];
    // Each outcome is a card that opens the outcome anywhere on it.
    expect(items.map((li) => li.querySelector('a.card-title')?.getAttribute('href'))).toEqual(['/DM-BO01', '/DM-BO02']);
    expect(items[0]).toHaveTextContent('More of the baskets shoppers fill are checked out.');
    expect(items[0]).toHaveTextContent(/Measure\s*Baskets checked out over baskets started, each week\./);
    expect(items[0]).toHaveTextContent(/Target\s*Two in three within a quarter\./);
    // Each that serves it linked, with its kind.
    const served = within(items[0]).getByRole('link', { name: /DM-SHOP-A1/ });
    expect(served).toHaveAttribute('href', '/DM-SHOP-A1');
    expect(served.closest('li')).toHaveTextContent(/DM-SHOP-A1\s*Basket\s*Aggregate/);
    // An outcome no aggregate or read model serves says so.
    expect(items[1]).toHaveTextContent(/Served by\s*No aggregate or read model yet\./);
    // Under Discovery, which comes before the domains, and Shared does not list them again.
    const headings = within(main()).getAllByRole('heading', { level: 2 }).map((h) => h.firstChild?.textContent);
    expect(headings.indexOf('Discovery')).toBeGreaterThanOrEqual(0);
    expect(headings.indexOf('Discovery')).toBeLessThan(headings.indexOf('Domains'));
    expect(within(section(/^Discovery/)).getByRole('heading', { level: 3, name: /^Business outcomes/ })).toBeInTheDocument();
    expect(main().querySelector('.product-shared .stage-discovery')).toBeNull();
  });

  it('LA-V92-R75-T01 A test shows its size and markers under Run by, and where it starts from', async () => {
    const data = withOutcomes();
    const section = await traceSection(data, 'DM-SHOP-UC01-R01-T01');
    const trace = () => section;
    const runBy = within(trace()).getByRole('heading', { level: 3, name: 'Run by' }).closest('section') as HTMLElement;
    expect(runBy).toHaveTextContent(/Size\s*volume/);
    expect(runBy).toHaveTextContent(/Markers\s*smoke/);
    expect(within(trace()).getByRole('heading', { level: 3, name: /^Starts from/ })).toBeInTheDocument();
    // A test that gives neither is small, with no markers; a data set is not a test, so it has no run by.
    expect(traceOf(data, 'DM-SHOP-INV01-T').runBy).toMatchObject({ size: 'small', markers: [] });
    expect(traceOf(data, 'DM-SHOP-TD01').runBy).toBeNull();
  });

  it('LA-V92-R76-T01 A test shows the outcomes it measures', async () => {
    const section = await traceSection(withOutcomes(), 'DM-SHOP-UC01-R01-T01');
    const trace = () => section;
    expect(within(trace()).getByRole('heading', { level: 3, name: /^Measures/ })).toBeInTheDocument();
    expect(within(trace()).getByRole('link', { name: /DM-BO01/ })).toBeInTheDocument();
  });
});
