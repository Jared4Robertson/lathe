import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Coverage, SpecLink, SpecRecord, Workspace } from '../../lathe/src/types';
import { LongList } from '../src/components/LongList';
import { workspace as baseWorkspace } from './fixtures/workspace';
import { main, openApp, section } from './helpers';

interface Item { id: string; title: string }
const make = (n: number): Item[] => Array.from({ length: n }, (_, i) => ({ id: `X-${String(i + 1).padStart(2, '0')}`, title: i === 6 ? 'The seventh thing' : `Thing ${i + 1}` }));
const list = (items: Item[]) => (
  <LongList label="Things" className="record-list" items={items} itemKey={(i) => i.id} searchText={(i) => `${i.id} ${i.title}`} render={(i) => <span>{i.id} {i.title}</span>} />
);

const pad = (n: number) => String(n).padStart(2, '0');
function record(id: string, kind: string, title: string, parent: string | null, product: string, domain: string | null, fields: Record<string, string> = {}): SpecRecord {
  return { id, kind, title, parent, product, domain, fields, body: '', path: `specs/big/${id}.md`, mentions: [] };
}

/** A product with 12 domains; its first domain has 12 use cases, the first with 12 requirements, and 12 problems. */
function bigWorkspace(): Workspace {
  const ws = baseWorkspace();
  const records: SpecRecord[] = [record('BG', 'product', 'Big product', null, 'BG', null)];
  for (let d = 1; d <= 12; d++) records.push(record(`BG-D${pad(d)}`, 'domain', `Domain ${d}`, 'BG', 'BG', `BG-D${pad(d)}`));
  records.push(record('BG-D01-A1', 'aggregate', 'Ledger', 'BG-D01', 'BG', 'BG-D01'));
  records.push(record('BG-D01-DR01', 'domain_rule', 'A ledger balances', 'BG-D01-A1', 'BG', 'BG-D01'));
  const links: SpecLink[] = [];
  for (let u = 1; u <= 12; u++) {
    records.push(record(`BG-D01-UC${pad(u)}`, 'use_case', u === 9 ? 'Close the month' : `Use case ${u}`, 'BG-D01', 'BG', 'BG-D01', { actor: 'Clerk' }));
    links.push({ source: `BG-D01-UC${pad(u)}`, relation: 'applies', target: 'BG-D01-DR01' });
    records.push(record(`BG-D01-UC01-R${pad(u)}`, 'requirement', `Requirement ${u}`, 'BG-D01-UC01', 'BG', 'BG-D01'));
  }
  ws.records.push(...records);
  ws.links.push(...links);
  ws.problems.push(...Array.from({ length: 12 }, (_, i) => ({ severity: 'warning' as const, check: 'unproved', record: `BG-D01-UC01-R${pad(i + 1)}`, message: `No test proves requirement BG-D01-UC01-R${pad(i + 1)}.` })));
  const empty = { requirements: 0, requirements_satisfied: 0, requirements_built: 0, requirements_proved: 0, rules: 0, rules_satisfied: 0, rules_built: 0, rules_proved: 0, obligations: [], gaps: [] };
  ws.coverage.push(...Array.from({ length: 12 }, (_, d) => ({ domain: `BG-D${pad(d + 1)}`, ...empty }) as unknown as Coverage));
  ws.coverage.find((c) => c.domain === 'BG-D01')!.gaps = Array.from({ length: 12 }, (_, i) => ({ id: `BG-D01-UC01-R${pad(i + 1)}`, kind: 'requirement', missing: 'proves' as const }));
  return ws;
}

describe('long lists', () => {
  it('LA-BRW-T88 A list of up to 10 items is plain; a longer one scrolls inside, with a search box, a count and a message when nothing matches', async () => {
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

  it('LA-BRW-T89 Every list in the spec pages stays at 10 rows and can be searched', async () => {
    const served = { workspace: bigWorkspace() };
    const user = userEvent.setup();

    // The menu's domain list.
    await openApp('/specs/BG', served);
    await screen.findByRole('heading', { level: 1, name: 'Big product' });
    const menu = screen.getByRole('navigation', { name: 'Main' });
    expect(within(menu).getByRole('searchbox', { name: 'Filter domains of Big product' })).toBeInTheDocument();

    // The domain page: groups, a long nested list, gaps and problems.
    await openApp('/specs/BG/BG-D01', served);
    await screen.findByRole('heading', { level: 1, name: 'Domain 1' });
    const useCases = section(/^Capabilities/);
    const search = within(useCases).getByRole('searchbox', { name: 'Filter capabilities' });
    await user.click(within(useCases).getByRole('button', { name: 'Expand BG-D01-UC01' }));
    expect(within(useCases).getByRole('searchbox', { name: 'Filter children of BG-D01-UC01' })).toBeInTheDocument();
    await user.type(search, 'close the month');
    const region = within(useCases).getByRole('region', { name: 'Capabilities (scrolls)' });
    expect(within(useCases).getByText('1 of 12')).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringMatching(/^BG-D01-UC09\s*Close the month/)]);
    expect(within(section(/^Coverage/)).getByRole('searchbox', { name: 'Filter coverage gaps' })).toBeInTheDocument();
    expect(within(section(/^Problems in this domain/)).getByRole('searchbox', { name: 'Filter problems' })).toBeInTheDocument();

    // The record page: children and links in.
    await openApp('/records/BG-D01', served);
    await screen.findByRole('heading', { level: 1, name: 'Domain 1' });
    expect(within(main()).getByRole('searchbox', { name: 'Filter children' })).toBeInTheDocument();
    await openApp('/records/BG-D01-DR01', served);
    await screen.findByRole('heading', { level: 1, name: 'A ledger balances' });
    const linksIn = within(main()).getByRole('searchbox', { name: 'Filter links in: applies this' });
    await user.type(linksIn, 'UC09');
    expect(within(main()).getByText('1 of 12')).toBeInTheDocument();

    // The checks page.
    await openApp('/checks', served);
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    expect(within(section(/^unproved/)).getByRole('searchbox', { name: 'Filter problems' })).toBeInTheDocument();
  });
});
