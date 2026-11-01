import type { ServedData } from './read-view';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Coverage } from '../../lathe/src/types';
import { LongList } from '../src/components/LongList';
import { addRows } from './fixtures/load';
import { gap, workspace as baseWorkspace } from './fixtures/workspace';
import { main, openApp, section, stageOf } from './helpers';

interface Item { id: string; title: string }
const make = (n: number): Item[] => Array.from({ length: n }, (_, i) => ({ id: `X-${String(i + 1).padStart(2, '0')}`, title: i === 6 ? 'The seventh thing' : `Thing ${i + 1}` }));
const list = (items: Item[]) => (
  <LongList label="Things" className="record-list" items={items} itemKey={(i) => i.id} searchText={(i) => `${i.id} ${i.title}`} render={(i) => <span>{i.id} {i.title}</span>} />
);

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A product with 12 domains; its first domain has 12 capabilities (the first holding 12 use cases, the first of them
 * with 12 UC requirements), a specification 12 commands check, and 12 problems.
 */
function bigWorkspace(): ServedData {
  const ws = baseWorkspace();
  addRows(ws, 'product', { id: 'BG', title: 'Big product' });
  for (let d = 1; d <= 12; d++) addRows(ws, 'domain', { id: `BG-D${pad(d)}`, title: `Domain ${d}`, product_id: 'BG', subdomain_type: 'core' });
  addRows(ws, 'aggregate', { id: 'BG-D01-A1', title: 'Ledger', domain_id: 'BG-D01' });
  addRows(ws, 'specification', { id: 'BG-D01-SP01', title: 'A ledger balances', statement: 'A ledger balances when its debits equal its credits.' });
  for (let u = 1; u <= 12; u++) {
    addRows(ws, 'capability', { id: `BG-D01-CAP${pad(u)}`, title: u === 9 ? 'Close the month' : `Capability ${u}`, domain_id: 'BG-D01', position: u });
    addRows(ws, 'use_case', { id: `BG-D01-UC${pad(u)}`, title: `Use case ${u}`, capability_id: 'BG-D01-CAP01' });
    addRows(ws, 'use_case_actor', { use_case_id: `BG-D01-UC${pad(u)}`, position: 1, role_name: 'Clerk' });
    addRows(ws, 'command', { id: `BG-D01-CMD${pad(u)}`, title: `Command ${u}`, aggregate_id: 'BG-D01-A1' });
    addRows(ws, 'checks', { source_id: `BG-D01-CMD${pad(u)}`, target_id: 'BG-D01-SP01' });
    addRows(ws, 'uc_requirement', { id: `BG-D01-UC01-R${pad(u)}`, title: `Requirement ${u}`, use_case_id: 'BG-D01-UC01', statement: `Requirement ${u} MUST hold.` });
  }
  ws.problems.push(...Array.from({ length: 12 }, (_, i) => ({ severity: 'warning' as const, check: 'not-proved', record: `BG-D01-UC01-R${pad(i + 1)}`, message: `No test proves UC requirement BG-D01-UC01-R${pad(i + 1)}.` })));
  ws.coverage.push(...Array.from({ length: 12 }, (_, d): Coverage => ({ product: 'BG', domain: `BG-D${pad(d + 1)}`, obligations: [], tests: { automated: 0, manual: 0, not_automated: 0 }, proved_by: {}, pattern_rules: [], gaps: [], debt: [] })));
  ws.coverage.find((c) => c.domain === 'BG-D01')!.gaps = Array.from({ length: 12 }, (_, i) => gap(`BG-D01-UC01-R${pad(i + 1)}`, 'uc_requirement', 'proved'));
  return ws;
}

describe('long lists', () => {
  it('LA-PAT-RECORD-PAGE-R17-T01 A list of up to 10 items is plain; a longer one scrolls inside, with a search box, a count and a message when nothing matches', async () => {
    const { unmount } = render(list(make(10)));
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
    unmount();

    render(list(make(12)));
    const region = screen.getByRole('region', { name: 'Things (scrolls)' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(within(region).getAllByRole('listitem')).toHaveLength(12);
    expect(screen.getByText('12 of 12')).toBeInTheDocument();

    // Tab reaches the search box, then the scrolling area.
    const user = userEvent.setup();
    const search = screen.getByRole('searchbox', { name: 'Filter things' });
    await user.tab();
    expect(search).toHaveFocus();

    // It filters by ID and by title, and counts what is left.
    await user.type(search, 'x-1');
    expect(within(region).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['X-10 Thing 10', 'X-11 Thing 11', 'X-12 Thing 12']);
    expect(screen.getByText('3 of 12')).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'seventh');
    expect(within(region).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['X-07 The seventh thing']);

    // Nothing matches: a clear message, and Escape clears the search.
    await user.clear(search);
    await user.type(search, 'zebra');
    expect(within(region).queryByRole('list')).toBeNull();
    expect(within(region).getByRole('status')).toHaveTextContent('Nothing matches “zebra”.');
    expect(screen.getByText('0 of 12')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(search).toHaveValue('');
    expect(within(region).getAllByRole('listitem')).toHaveLength(12);

    await user.tab();
    expect(region).toHaveFocus();
  });

  it('LA-PAT-RECORD-PAGE-R17-T01 Every list in the spec pages stays at 10 rows and can be searched', async () => {
    const served = { data: bigWorkspace() };
    const user = userEvent.setup();

    // The menu's domain list is plain: the nav lists everything in its one scroll (LA-V90-R17).
    await openApp('/BG', served);
    await screen.findByRole('heading', { level: 1, name: 'Big product' });
    const menu = screen.getByRole('navigation', { name: 'Main' });
    expect(within(menu).getByRole('list', { name: 'Domains of Big product' })).toBeInTheDocument();
    expect(within(menu).queryByRole('searchbox')).toBeNull();

    // The domain page: groups, a long nested list, gaps and problems.
    await openApp('/BG-D01', served);
    await screen.findByRole('heading', { level: 1, name: 'Domain 1' });
    // Use cases holds only capabilities, so it lists them itself.
    const useCases = stageOf('use-cases');
    const search = await within(useCases).findByRole('searchbox', { name: 'Filter capabilities' });
    await user.click(await within(useCases).findByRole('button', { name: 'Expand BG-D01-CAP01' }));
    expect(await within(useCases).findByRole('searchbox', { name: 'Filter use cases of BG-D01-CAP01' })).toBeInTheDocument();
    await user.type(search, 'close the month');
    const region = within(useCases).getByRole('region', { name: 'Capabilities (scrolls)' });
    expect(await within(useCases).findByText('1 of 12')).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringMatching(/^BG-D01-CAP09\s*Close the month/)]);
    expect(within(section(/^Coverage/)).getByRole('searchbox', { name: 'Filter coverage gaps' })).toBeInTheDocument();
    expect(within(section(/^Problems in this domain/)).getByRole('searchbox', { name: 'Filter problems' })).toBeInTheDocument();

    // A record's Traceability, in the wiki card.
    await openApp('/BG-D01-SP01', served);
    await screen.findByRole('heading', { level: 1, name: 'A ledger balances' });
    const linksIn = await within(main()).findByRole('searchbox', { name: /^Filter checked by$/i });
    await user.type(linksIn, 'CMD09');
    expect(await within(main()).findByText('1 of 12')).toBeInTheDocument();

    // The Checks panel.
    await openApp('/BG?panel=checks', served);
    const checks = await screen.findByRole('region', { name: 'Checks' });
    const notProved = within(checks).getByRole('heading', { name: /^not-proved/ }).closest('section')!;
    expect(within(notProved).getByRole('searchbox', { name: 'Filter problems' })).toBeInTheDocument();
  });
});
