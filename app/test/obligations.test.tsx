import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { indexWorkspace } from '../src/specs/data';
import { RecordContent } from '../src/specs/RecordContent';
import { obligationWorkspace } from './fixtures/obligations';
import { main, openApp, section } from './helpers';
// The Graph view, where the side bar is open, needs a ResizeObserver in jsdom.
import './graph/setup';

// Coverage per obligation kind, interaction requirements under their view or endpoint, and test states.

const served = () => ({ workspace: obligationWorkspace() });
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

describe('obligation kinds and test states', () => {
  it('LA-BRW-T80 Coverage shows one group per obligation kind, labeled, with designed, built, proved and planned', async () => {
    await openApp('/DM', served());
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(groups(card('Shopping'))).toEqual([
      'Domain rules 1: designed 1/1, built 1/1, proved 1/1, planned 0/1',
      'UC requirements 2: designed 2/2, built 1/2, proved 1/2, planned 0/2',
      'Interaction requirements 3: designed 1/3, built 1/3, proved 0/3, planned 1/3',
      'Security controls 1: designed 0/1, built 0/1, proved 0/1, planned 0/1',
    ]);
    // A planned bar is drawn apart from proof, and never as full.
    const planned = card('Shopping').querySelector('[data-kind="interaction_requirement"] .bar.planned') as HTMLElement;
    expect(within(planned).getByRole('img', { name: 'planned: 1 of 3' })).toBeInTheDocument();
    expect(card('Shopping').querySelectorAll('.bar.planned .bar-fill.full')).toHaveLength(0);

    // The domain page shows the same groups.
    await openApp('/DM-SHOP', served());
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(groups(section(/^Coverage/))).toHaveLength(4);
    expect(within(section(/^Coverage/)).getAllByRole('listitem').map((li) => li.textContent)).toContainEqual(
      expect.stringMatching(/DM-SHOP-E01-S01.*Security control with nothing that satisfies it/),
    );
  });

  it('LA-BRW-T82 The evidence counts every obligation kind, and planned apart from proved', async () => {
    await openApp('/DM', served());
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const evidence = section('Evidence');
    const value = (name: string) => within(evidence).getByText(name).nextElementSibling?.textContent;
    expect(value('Designed')).toBe('4 of 8 obligations');
    expect(value('Built')).toBe('3 of 8 obligations');
    expect(value('Proved')).toBe('2 of 8 obligations');
    expect(value('Planned')).toBe('1 of 8 obligations, by tests not written yet');
  });

  it('LA-BRW-T83 The domain page lists interaction requirements under their view, endpoint or flow', async () => {
    await openApp('/DM-SHOP', served());
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const user = userEvent.setup();
    const view = within(section(/^Views/)).getByRole('link', { name: /^DM-SHOP-V01\s*Basket page/ }).closest('li') as HTMLElement;
    expect(view).toHaveTextContent('1 interaction requirement');
    await user.click(within(view).getByRole('button', { name: 'Expand DM-SHOP-V01' }));
    expect(ids(within(view).getByRole('list', { name: 'Interaction requirements of DM-SHOP-V01' }))).toEqual(['DM-SHOP-V01-R01']);
    // An endpoint lists its interaction requirements and a product's own obligation kind under it.
    const endpoint = within(section(/^Endpoints/)).getByRole('link', { name: /^DM-SHOP-E01\s*Add to basket/ }).closest('li') as HTMLElement;
    await user.click(within(endpoint).getByRole('button', { name: 'Expand DM-SHOP-E01' }));
    expect(ids(endpoint.querySelector('ul.nested') as HTMLElement)).toEqual(['DM-SHOP-E01-R01', 'DM-SHOP-E01-R02', 'DM-SHOP-E01-S01']);
    // Their gaps show on their rows, and they are not listed again under "Other records".
    const row = within(endpoint).getByRole('link', { name: /DM-SHOP-E01-R02/ }).closest('.record-row') as HTMLElement;
    expect(within(row).getByText('not satisfied')).toBeInTheDocument();
    expect(within(main()).queryByRole('heading', { name: /^Other records/ })).toBeNull();
    // The count is of views and endpoints, not of what sits under them.
    expect(section(/^Endpoints/).querySelector('.section-count')).toHaveTextContent('1');

    // Searching for an interaction requirement keeps its endpoint above it.
    await user.click(within(endpoint).getByRole('button', { name: 'Collapse DM-SHOP-E01' }));
    await user.type(screen.getByLabelText('Filter records'), '409');
    expect(ids(section(/^Endpoints/))).toEqual(['DM-SHOP-E01', 'DM-SHOP-E01-R01']);
    expect(within(section(/^Views/)).getByText('Nothing matches.')).toBeInTheDocument();
  });

  it('LA-BRW-T84 The domain page tags each test with its state, and a planned test looks unfinished', async () => {
    await openApp('/DM-SHOP', served());
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const rows = [...section(/^Test plan/).querySelectorAll('.record-row')] as HTMLElement[];
    const states = rows.map((r) => [r.querySelector('code')?.textContent, r.querySelector('.test-state')?.textContent]);
    // A test with no state is automated.
    expect(states).toEqual([['DM-SHOP-T01', 'automated'], ['DM-SHOP-T02', 'manual'], ['DM-SHOP-T03', 'planned']]);
    const planned = rows[2];
    expect(planned).toHaveClass('planned');
    expect(planned.querySelector('.test-state')).toHaveClass('planned');
    expect(planned.querySelector('.test-state')).toHaveAttribute('title', expect.stringMatching(/does not count as proof/));
    expect(rows[0]).not.toHaveClass('planned');
    expect(rows[1]).not.toHaveClass('planned');
  });

  it('LA-BRW-T85 The record page shows a test state, and says a planned test is not proof', async () => {
    // The state is a fact in the side bar's Details, open in the Graph view (brief 64).
    await openApp('/DM-SHOP-T03?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'A full basket answers 409' });
    expect(field('State')).toHaveTextContent('planned');
    expect(within(side()).queryByText('state', { selector: 'dt' })).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent('Planned test. It is not written yet, so it does not count as proof');

    await openApp('/DM-SHOP-T02?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'A person fills a basket to 50' });
    expect(field('State')).toHaveTextContent('manual');
    expect(screen.queryByRole('note')).toBeNull();

    await openApp('/DM-SHOP-T01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Adding an item shows it' });
    expect(field('State')).toHaveTextContent('automated');
  });

  it('LA-BRW-T86 The record page shows where an interaction requirement sits and what it fulfills', async () => {
    await openApp('/DM-SHOP-E01-R01', served());
    await screen.findByRole('heading', { level: 1, name: 'Adding to a full basket answers 409' });
    const fulfills = section(/^Carries out/);
    expect(fulfills).toHaveTextContent(/At the endpoint\s*DM-SHOP-E01\s*Add to basket/);
    expect(within(fulfills).getByRole('link', { name: /^DM-SHOP-E01\s*Add to basket$/ })).toHaveAttribute('href', '/DM-SHOP-E01');
    const items = within(fulfills).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([expect.stringMatching(/DM-SHOP-UC01-R02.*A full basket refuses the item.*UC requirement/)]);
    expect(within(items[0]).getByRole('link')).toHaveAttribute('href', '/DM-SHOP-UC01-R02');

    // One that fulfills nothing yet says how to link it.
    await openApp('/DM-SHOP-E01-R02', served());
    await screen.findByRole('heading', { level: 1, name: 'An unknown item answers 404' });
    expect(section(/^Carries out/)).toHaveTextContent('It carries out nothing yet.');

    // Other kinds have no such section.
    await openApp('/DM-SHOP-UC01-R02', served());
    await screen.findByRole('heading', { level: 1, name: 'A full basket refuses the item' });
    expect(within(main()).queryByRole('heading', { name: /^Carries out/ })).toBeNull();
  });

  it('LA-BRW-T87 The record content takes a record ID and sends the links it follows to its host', async () => {
    cleanup();
    window.history.replaceState(null, '', '/graph/DM-SHOP-E01-R01');
    const index = indexWorkspace(obligationWorkspace());
    const onNavigate = vi.fn();
    const { container } = render(<RecordContent index={index} id="DM-SHOP-E01-R01" onNavigate={onNavigate} />);
    // It sizes itself by its own width (a CSS container), so it reads at half the screen.
    expect(container.firstElementChild).toHaveClass('record-content');
    expect(screen.getByRole('heading', { level: 1, name: 'Adding to a full basket answers 409' })).toBeInTheDocument();

    const user = userEvent.setup();
    const fulfills = screen.getByRole('heading', { name: /^Carries out/ }).closest('section') as HTMLElement;
    const link = within(fulfills).getByRole('link', { name: /DM-SHOP-UC01-R02/ });
    expect(link).toHaveAttribute('href', '/DM-SHOP-UC01-R02');
    await user.click(link);
    expect(onNavigate).toHaveBeenCalledWith('/DM-SHOP-UC01-R02');
    expect(window.location.pathname).toBe('/graph/DM-SHOP-E01-R01');

    // Links in the header and side panel go through the host too.
    await user.click(within(container.querySelector('aside') as HTMLElement).getByRole('link', { name: /DM-SHOP-C01/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('/DM-SHOP-C01');
    await user.click(within(container.querySelector('.eyebrow') as HTMLElement).getByRole('link', { name: 'Shopping' }));
    expect(onNavigate).toHaveBeenLastCalledWith('/DM-SHOP');
    expect(window.location.pathname).toBe('/graph/DM-SHOP-E01-R01');

    // An unknown ID says so.
    cleanup();
    render(<RecordContent index={index} id="DM-NOPE" onNavigate={onNavigate} />);
    expect(screen.getByText(/There's no record with the ID/)).toHaveTextContent('DM-NOPE');
  });
});
