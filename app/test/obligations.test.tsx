import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SpecData } from '../../lathe/src/server/contract';
import { RecordContent } from '../src/specs/RecordContent';
import { productKindWorkspace } from './fixtures/product-kinds';
import { main, openApp, section } from './helpers';
// The Graph view, where the side bar is open, needs a ResizeObserver in jsdom.
import './graph/setup';
import { addRows, indexOf } from './fixtures/load';

// Coverage per obligation kind (a product's own obligation kind among them), proof still owed, what sits
// under an endpoint, test states, and the Traceability of an obligation, on the product-kinds workspace:
// DM declares `security_control`, and DM-SHOP-EP01-SC01 is one.

/** The workspace with a manual test of DM-SHOP-UC01-R02 beside the automated and the not automated yet ones. */
function workspace(): SpecData {
  return addRows(productKindWorkspace(), 'use_case_test', {
    id: 'DM-SHOP-UC01-R02-T01', title: 'A person fills a basket to 50', uc_requirement_id: 'DM-SHOP-UC01-R02', level: 'browser', state: 'manual', manual_reason: 'A person fills the basket by hand.',
  });
}
const served = () => ({ data: workspace() });
const card = (title: string) => within(section(/^Domains/)).getByText(title).closest('article') as HTMLElement;
/** Each coverage group as "Heading total: bar, bar, ...". */
const groups = (element: HTMLElement) =>
  [...element.querySelectorAll('.coverage-group')].map((g) => {
    const heading = g.querySelector('.coverage-heading')?.textContent;
    const bars = [...g.querySelectorAll('.bar')].map((bar) => [...bar.children].map((c) => c.textContent).filter(Boolean).join(' '));
    return `${heading}: ${bars.join(', ')}`;
  });
const ids = (element: Element) => [...element.querySelectorAll('a.record-link code')].map((c) => c.textContent);
const side = () => main().querySelector('aside.record-side') as HTMLElement;
const field = (name: string) => within(side()).getByText(name, { selector: 'dt' }).nextElementSibling as HTMLElement;
const stage = (name: string) => main().querySelector(`.stage-${name}`) as HTMLElement;

describe('obligation kinds and test states', () => {
  it('LA-V91-R51-T01 Coverage shows one group per obligation kind, labeled, with designed, built, proved and not automated', async () => {
    await openApp('/DM', served());
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(groups(card('Shopping'))).toEqual([
      'Invariants 1: designed 1/1, built 0/1, proved 0/1, not automated 1/1',
      'UC requirements 2: designed 2/2, built 1/2, proved 1/2, not automated 0/2',
      'Security controls 1: designed 0/1, built 0/1, proved 0/1, not automated 0/1',
    ]);
    // A not automated bar is drawn apart from proof, and never as full.
    const notAutomated = card('Shopping').querySelector('[data-kind="invariant"] .bar.not-automated') as HTMLElement;
    expect(within(notAutomated).getByRole('img', { name: 'not automated: 1 of 1' })).toBeInTheDocument();
    expect(card('Shopping').querySelectorAll('.bar.not-automated .bar-fill.full')).toHaveLength(0);

    // The domain page shows the same groups.
    await openApp('/DM-SHOP', served());
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(groups(section(/^Coverage/))).toHaveLength(3);
    expect(within(section(/^Coverage/)).getAllByRole('listitem').map((li) => li.textContent)).toContainEqual(
      expect.stringMatching(/DM-SHOP-EP01-SC01.*Security control not designed/),
    );
  });

  it('LA-V51-R03-T02 The summary counts every obligation kind, and tests not automated yet apart from proved', async () => {
    await openApp('/DM', served());
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const summary = section('Summary');
    const value = (name: string) => within(summary).getByText(name).nextElementSibling?.textContent;
    expect(value('Designed')).toBe('3 of 7 obligations');
    expect(value('Built')).toBe('1 of 7 obligations');
    expect(value('Proved')).toBe('1 of 7 obligations');
    expect(value('Not automated yet')).toBe('1 of 7 obligations, by tests no file runs yet');
  });

  it('LA-V91-R52-T01 The domain page lists an endpoint in Interaction design, with its API requirements and a product\'s own kind folded under it', async () => {
    await openApp('/DM-SHOP', served());
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const user = userEvent.setup();
    const endpoints = within(stage('interaction-design')).getByRole('heading', { name: /^Endpoints/ }).closest('section') as HTMLElement;
    const endpoint = within(endpoints).getByRole('link', { name: /^DM-SHOP-EP01\s*Add to basket/ }).closest('li') as HTMLElement;
    expect(endpoint).toHaveTextContent('2 children');
    await user.click(within(endpoint).getByRole('button', { name: 'Expand DM-SHOP-EP01' }));
    expect(ids(endpoint.querySelector('ul.nested') as HTMLElement)).toEqual(['DM-SHOP-EP01-R01', 'DM-SHOP-EP01-SC01']);
    // Their gaps show on their rows, and they are not listed again under "Other records".
    const row = within(endpoint).getByRole('link', { name: /DM-SHOP-EP01-SC01/ }).closest('.record-row') as HTMLElement;
    expect(within(row).getByText('not designed')).toBeInTheDocument();
    expect(within(main()).queryByRole('heading', { name: /^Other records/ })).toBeNull();
    // The count is of endpoints, not of what sits under them.
    expect(endpoints.querySelector('.section-count')).toHaveTextContent('1');

    // Searching for an API requirement keeps its endpoint above it.
    await user.click(within(endpoint).getByRole('button', { name: 'Collapse DM-SHOP-EP01' }));
    await user.type(screen.getByLabelText('Filter records'), 'answers 201');
    expect(ids(endpoints)).toEqual(['DM-SHOP-EP01', 'DM-SHOP-EP01-R01']);
    const flows = within(stage('interaction-design')).getByRole('heading', { name: /^Flows/ }).closest('section') as HTMLElement;
    expect(within(flows).getByText('Nothing matches.')).toBeInTheDocument();
  });

  it('LA-V91-R53-T01 The domain page tags each test with its state, and one not automated yet looks unfinished', async () => {
    await openApp('/DM-SHOP', served());
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const rows = [...stage('test-plan').querySelectorAll('.record-row')] as HTMLElement[];
    const states = rows.map((r) => [r.querySelector('code')?.textContent, r.querySelector('.test-state')?.textContent]);
    expect(states).toEqual([['DM-SHOP-INV01-T', 'not automated yet'], ['DM-SHOP-UC01-R01-T01', 'automated'], ['DM-SHOP-UC01-R02-T01', 'manual']]);
    const notYet = rows[0];
    expect(notYet).toHaveClass('not-automated');
    expect(notYet.querySelector('.test-state')).toHaveClass('not-automated');
    expect(notYet.querySelector('.test-state')).toHaveAttribute('title', expect.stringMatching(/does not count as proof/));
    expect(rows[1]).not.toHaveClass('not-automated');
    expect(rows[2]).not.toHaveClass('not-automated');
  });

  it('LA-V92-R51-T01 The record page shows a test state and how the test is run, and says one not automated yet is not proof', async () => {
    // The state is a fact in the side bar's Details, open in the Graph view.
    await openApp('/DM-SHOP-INV01-T?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'A 51st line is refused' });
    expect(field('State')).toHaveTextContent('not automated yet');
    expect(within(side()).queryByText('state', { selector: 'dt' })).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent('Not automated yet. No file runs it, so it does not count as proof');

    await openApp('/DM-SHOP-UC01-R02-T01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'A person fills a basket to 50' });
    expect(field('State')).toHaveTextContent('manual');
    expect(screen.queryByRole('note')).toBeNull();
    const runBy = section(/^Run by/);
    expect(runBy).toHaveTextContent('Manual becauseA person fills the basket by hand.');

    await openApp('/DM-SHOP-UC01-R01-T01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Adding an item shows it' });
    expect(field('State')).toHaveTextContent('automated');
    expect(section(/^Run by/)).toHaveTextContent('test/basket.test.ts');
  });

  it('LA-V92-R57-T02 An obligation\'s Traceability shows what designs it and what proves it, and names a gap', async () => {
    await openApp('/DM-SHOP-UC01-R01', served());
    await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' });
    const trace = section(/^Traceability/);
    const designed = within(trace).getByRole('heading', { name: /^Designed by/ }).closest('section') as HTMLElement;
    expect(within(designed).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-UC01-FL01-S01']);
    const proved = within(trace).getByRole('heading', { name: /^Proved by/ }).closest('section') as HTMLElement;
    expect(within(proved).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-UC01-R01-T01']);

    // A product's own obligation that coverage finds not designed and not proved says so, naming each gap.
    await openApp('/DM-SHOP-EP01-SC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Only the basket\'s shopper adds' });
    const gaps = [...section(/^Traceability/).querySelectorAll('[data-gap]')].map((g) => g.getAttribute('data-gap'));
    expect(gaps).toEqual(['not-designed', 'not-proved']);
  });

  it('LA-V92-R52-T01 The record content takes a record ID and sends the links it follows to its host', async () => {
    cleanup();
    window.history.replaceState(null, '', '/graph/DM-SHOP-UC01-R01');
    const index = indexOf(workspace());
    const onNavigate = vi.fn();
    const { container } = render(<RecordContent index={index} id="DM-SHOP-UC01-R01" onNavigate={onNavigate} />);
    // It sizes itself by its own width (a CSS container), so it reads at half the screen.
    expect(container.firstElementChild).toHaveClass('record-content');
    expect(screen.getByRole('heading', { level: 1, name: 'The basket shows the new item' })).toBeInTheDocument();

    const user = userEvent.setup();
    const designed = screen.getByRole('heading', { name: /^Designed by/ }).closest('section') as HTMLElement;
    const link = within(designed).getByRole('link', { name: /DM-SHOP-UC01-FL01-S01/ });
    expect(link).toHaveAttribute('href', '/DM-SHOP-UC01-FL01-S01');
    await user.click(link);
    expect(onNavigate).toHaveBeenCalledWith('/DM-SHOP-UC01-FL01-S01');
    expect(window.location.pathname).toBe('/graph/DM-SHOP-UC01-R01');

    // Links in the header and side panel go through the host too.
    await user.click(within(container.querySelector('aside') as HTMLElement).getByRole('link', { name: /DM-SHOP-UC01-R01-T01/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('/DM-SHOP-UC01-R01-T01');
    await user.click(within(container.querySelector('.eyebrow') as HTMLElement).getByRole('link', { name: 'Shopping' }));
    expect(onNavigate).toHaveBeenLastCalledWith('/DM-SHOP');
    expect(window.location.pathname).toBe('/graph/DM-SHOP-UC01-R01');

    // An unknown ID says so.
    cleanup();
    render(<RecordContent index={index} id="DM-NOPE" onNavigate={onNavigate} />);
    expect(screen.getByText(/There's no record with the ID/)).toHaveTextContent('DM-NOPE');
  });
});

describe('tests by state and tests not automated yet', () => {
  /** The workspace with tests in every state: DM-SHOP has one automated, one manual and one not automated yet. */
  const states = (): SpecData => {
    const ws = workspace();
    ws.coverage.find((c) => c.domain === 'DM-SHOP')!.tests = { automated: 1, manual: 1, not_automated: 1 };
    return ws;
  };
  const testsLine = (element: HTMLElement) => within(element).getByLabelText('Tests by state').textContent;

  it('LA-V91-R51-T01 The not automated bar counts the obligations not proved whose test is not automated yet', async () => {
    await openApp('/DM', { data: states() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const bar = card('Shopping').querySelector('[data-kind="invariant"] .bar.not-automated') as HTMLElement;
    expect(bar).toHaveTextContent('not automated1/1');
    expect(bar.getAttribute('title')).toMatch(/not automated yet.*not proof/i);
    // A kind with no obligations in the domain draws no bars.
    expect(card('Paying').querySelector('[data-kind="invariant"]')).toBeNull();
  });

  it("LA-V51-R04-T01 Each domain's coverage shows its tests by state, on the product and domain pages, and the summary counts them", async () => {
    await openApp('/DM', { data: states() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(testsLine(card('Shopping'))).toBe('Tests 1 automated, 1 manual, 1 not automated yet');
    expect(testsLine(card('Paying'))).toBe('Tests 0 automated, 0 manual, 0 not automated yet');
    const summary = (name: string) => within(section('Summary')).getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(summary('Tests')).toBe('1 automated, 1 manual, 1 not automated yet');
    expect(summary('Not automated yet')).toBe('1 of 7 obligations, by tests no file runs yet');

    await openApp('/DM-SHOP', { data: states() });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const line = within(section(/^Coverage/)).getByLabelText('Tests by state');
    expect(line.textContent).toBe('Tests 1 automated, 1 manual, 1 not automated yet');
    expect(line.querySelector('[data-state="not_automated"]')?.getAttribute('title')).toMatch(/does not count as proof/);
  });
});
