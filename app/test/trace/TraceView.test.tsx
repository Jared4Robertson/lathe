import '../graph/setup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addRows } from '../fixtures/load';
import { modelIndex, modelWorkspace } from '../fixtures/model';
import { viewsOffered } from '../../src/views/address';
import { TRACE_PAGE } from '../../src/trace/TraceView';
import { obligationsUnder, untracedUnder } from '../../src/trace/chain';
import { openApp } from '../helpers';

// The Trace view (LA-V98): an obligation's chain as columns, or the matrix of every obligation under
// a record or group, with its gaps in view.

const served = (data = modelWorkspace()) => ({ data });
const tracePane = () => screen.getByRole('region', { name: 'Trace pane' });
const viewToggle = (name: string | RegExp) => within(screen.getByRole('group', { name: 'View' })).queryByRole('button', { name });
const panes = () => [...document.querySelectorAll('.pane')].map((p) => p.getAttribute('aria-label'));
const matrix = () => within(tracePane()).findByRole('table');

describe('the Trace view', () => {
  it('LA-V98-R01-T01 The Trace view is offered on an obligation and above one, after ERD, and nowhere else', async () => {
    const i = modelIndex();
    for (const id of ['P-D-UC01-R01', 'P-D-UC01', 'P-D-A3', 'P-D', 'P-D/use-cases', 'P']) expect(viewsOffered(i, id), id).toContain('trace');
    for (const id of ['P-D-UC01-R01-T01', 'P-D-UC01-FL01-S01']) expect(viewsOffered(i, id), id).not.toContain('trace');
    expect(viewsOffered(i, 'P-D-A3')).toEqual(['wiki', 'graph', 'erd', 'trace']);

    // On an aggregate: Trace opens with its toggle or Ctrl+5, after ERD.
    await openApp('/P-D-A3?view=wiki,erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(viewToggle('Trace')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(document.body, { key: '5', code: 'Digit5', ctrlKey: true });
    expect(window.location.search).toBe('?view=wiki,erd,trace');
    expect(panes()).toEqual(['Wiki pane', 'ERD pane', 'Trace pane']);
    await matrix();
    // Alt+T turns it off again (off a Mac).
    fireEvent.keyDown(document.body, { key: 't', code: 'KeyT', altKey: true });
    expect(window.location.search).toBe('?view=wiki,erd');

    // A test has nothing to trace: its toggle keeps its slot, dimmed, and says where it works; a link naming it shows the rest.
    await openApp('/P-D-UC01-R01-T01?view=graph,trace', served());
    await screen.findByRole('heading', { level: 1 });
    expect(viewToggle('Trace')).toBeNull();
    expect(viewToggle(/^Trace \(on a requirement or rule/)).toHaveAttribute('aria-disabled', 'true');
    expect(panes()).toEqual(['Graph pane']);
  });

  it('LA-V98-R02-T02 An obligation\'s Trace view draws its chain as five columns of cards', async () => {
    await openApp('/P-D-UC01-R01?view=trace', served());
    const chain = await within(tracePane()).findByRole('region', { name: 'Traceability chain' });
    const columns = [...chain.querySelectorAll('.trace-column')];
    expect(columns.map((c) => c.querySelector('.trace-column-name')!.firstChild!.textContent!.trim())).toEqual(['Obligation', 'Design', 'Build', 'Tests', 'Files']);
    expect(columns[0].querySelector('[aria-current="page"]')).toHaveTextContent('P-D-UC01-R01');
    const design = within(columns[1] as HTMLElement).getByRole('list', { name: 'Design' });
    expect(within(design).getByRole('link', { name: /P-D-UC01-FL01-S01/ })).toHaveTextContent('Flow step');
    expect(within(columns[2] as HTMLElement).getByRole('link', { name: /P-D-CMD01-H/ })).toBeInTheDocument();
    expect(within(columns[3] as HTMLElement).getByRole('link', { name: /P-D-UC01-R01-T01/ })).toBeInTheDocument();
    expect(within(columns[4] as HTMLElement).getByText('test/lend.test.ts')).toBeInTheDocument();
    expect(tracePane().querySelector('.trace-caption')).toHaveTextContent(/^UC requirement · /);
  });

  it('LA-V98-R03-T02 A domain\'s Trace view draws a matrix with a heading row per parent', async () => {
    await openApp('/P-D?view=trace', served());
    const table = await matrix();
    expect(within(table.querySelector('thead')!).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Obligation', 'Design', 'Build', 'Tests', 'Files']);
    const groups = [...table.querySelectorAll('tr.group-row')];
    expect(groups.length).toBeGreaterThan(1);
    expect(within(groups[0] as HTMLElement).getByRole('link')).toHaveAttribute('href', expect.stringMatching(/^\/P-D-/));
    expect(within(table).getByRole('rowheader', { name: /P-D-UC01-R01/ })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: /P-D-INV01/ })).toBeInTheDocument();
  });

  it('LA-V98-R04-T02 Empty cells show as gaps, the header counts them, and Gaps only keeps those rows', async () => {
    await openApp('/P-D?view=trace', served());
    const table = await matrix();
    const rows = () => [...table.querySelectorAll('tbody tr:not(.group-row)')];
    const all = rows().length;
    const gapped = rows().filter((r) => r.querySelector('td.is-gap')).length;
    expect(gapped).toBeGreaterThan(0);
    expect(gapped).toBeLessThan(all);
    expect(table.querySelector('td.is-gap .trace-missing')).not.toBeNull();
    expect(tracePane().querySelector('.trace-caption')).toHaveTextContent(`${all} obligations · ${gapped} with gaps`);
    fireEvent.click(within(tracePane()).getByRole('checkbox', { name: 'Gaps only' }));
    await waitFor(() => expect(rows().length).toBe(gapped));
    for (const r of rows()) expect(r.querySelector('td.is-gap')).not.toBeNull();
    // A use case whose every requirement is traced has no rows left under Gaps only.
    await openApp('/P-D-UC01?view=trace', served());
    await matrix();
    fireEvent.click(within(tracePane()).getByRole('checkbox', { name: 'Gaps only' }));
    if (within(tracePane()).queryByRole('table') === null) expect(tracePane()).toHaveTextContent('No gaps');
  });

  it('LA-V98-R07-T02 The matrix ends with its Untraced section, counted in the header and kept by Gaps only', async () => {
    await openApp('/P-D?view=trace', served());
    await matrix();
    const section = () => within(tracePane()).getByRole('region', { name: /^Untraced/ });
    const expected = untracedUnder(modelIndex(), 'P-D');
    const count = expected.reduce((n, g) => n + g.ids.length, 0);
    expect(count).toBeGreaterThan(0);
    expect(tracePane().querySelector('.trace-caption')).toHaveTextContent(`· ${count} untraced`);
    expect(within(section()).getByText('Flow steps')).toBeInTheDocument();
    expect(within(section()).getByRole('link', { name: 'P-D-UC01-FL01-S02' })).toHaveAttribute('href', '/P-D-UC01-FL01-S02?view=trace');
    expect(within(section()).getAllByRole('link')).toHaveLength(count);
    // Gaps only keeps it.
    fireEvent.click(within(tracePane()).getByRole('checkbox', { name: 'Gaps only' }));
    expect(within(section()).getAllByRole('link')).toHaveLength(count);
    // Where everything is reached it says so.
    await openApp('/P-D-UC01?view=trace', served());
    await matrix();
    expect(section()).toHaveTextContent('Everything here serves a requirement or rule.');
  });

  it('LA-V98-R05-T01 Every cell links to its record, and a file to the record that names it', async () => {
    await openApp('/P-D-UC01-R01?view=wiki,trace', served());
    const chain = await within(tracePane()).findByRole('region', { name: 'Traceability chain' });
    const file = within(chain).getByText('test/lend.test.ts').closest('a')!;
    expect(file).toHaveAttribute('href', '/P-D-UC01-R01-T01?view=wiki,trace');
    expect(file).toHaveAttribute('title', 'test/lend.test.ts, named by P-D-UC01-R01-T01');
    const step = within(chain).getByRole('link', { name: /P-D-UC01-FL01-S01/ });
    expect(step).toHaveAttribute('href', '/P-D-UC01-FL01-S01?view=wiki,trace');
    // A click moves the focus; a flow step owes nothing, so the Trace pane leaves with it.
    fireEvent.click(step);
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01-FL01-S01'));
    expect(panes()).toEqual(['Wiki pane']);
  });

  it('LA-V98-R06-T01 A long matrix draws 100 rows and adds 100 at a time', async () => {
    const data = modelWorkspace();
    const count = TRACE_PAGE + 20;
    addRows(data, 'uc_requirement', ...Array.from({ length: count }, (_, n) => ({ id: `P-D-UC01-R${String(n + 10).padStart(3, '0')}`, title: `Rule ${n + 10}`, use_case_id: 'P-D-UC01', statement: `Rule ${n + 10} MUST hold.` })));
    await openApp('/P-D-UC01?view=trace', served(data));
    const table = await matrix();
    const rows = () => table.querySelectorAll('tbody tr:not(.group-row)').length;
    expect(rows()).toBe(TRACE_PAGE);
    const total = count + obligationsUnder(modelIndex(), 'P-D-UC01').length;
    expect(within(tracePane()).getByText(`${TRACE_PAGE} of ${total} shown`)).toBeInTheDocument();
    fireEvent.click(within(tracePane()).getByRole('button', { name: `Show ${total - TRACE_PAGE} more` }));
    await waitFor(() => expect(rows()).toBe(total));
    expect(within(tracePane()).queryByRole('button', { name: /^Show \d+ more$/ })).toBeNull();
  });
});
