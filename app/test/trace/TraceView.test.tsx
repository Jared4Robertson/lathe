import '../graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addRows } from '../fixtures/load';
import { modelIndex, modelWorkspace } from '../fixtures/model';
import { TRACE_PAGE } from '../../src/trace/TraceView';
import { obligationsUnder, untracedUnder } from '../../src/trace/chain';
import { openApp } from '../helpers';

// The Trace stage (LA-V98): an obligation's chain as columns, the matrix of every obligation under
// a record or group with its gaps in view, the rows that hold a design, build or test record, or the
// matrix around a record outside every chain. It works on every focus (LA-PAT-APP-UX-R17).

const served = (data = modelWorkspace()) => ({ data });
const traceStage = () => screen.getByRole('region', { name: 'Trace stage' });
const stageButton = (name: string) => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });
const matrix = () => within(traceStage()).findByRole('table');
/** What the header strip says the trace holds. */
const counts = () => document.querySelector('.header-strip-counts');
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('the Trace stage', () => {
  it('LA-V98-R01-T01 Trace works on every focus: Ctrl+3 or the switch shows it, never disabled, on an obligation, above one, and on a record no chain holds', async () => {
    // On an aggregate: Ctrl+3 switches to the Trace stage, Alt+E to the ERD (off a Mac).
    await openApp('/P-D-A3?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(stageButton('Trace')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(document.body, { key: '3', code: 'Digit3', ctrlKey: true });
    expect(window.location.search).toBe('?stage=trace');
    await matrix();
    fireEvent.keyDown(document.body, { key: 'e', code: 'KeyE', altKey: true });
    expect(window.location.search).toBe('?stage=erd');

    // A test, a flow step and a term each have a Trace stage too: the switch never dims or hides it.
    for (const [path, name] of [['/P-D-UC01-R01-T01', /lend/i], ['/P-D-UC01-FL01-S01', 'Librarian lends the thing'], ['/P-D-TM01', /./]] as const) {
      await openApp(`${path}?stage=trace`, served());
      await screen.findByRole('heading', { level: 1, name });
      expect(stageButton('Trace')).toHaveAttribute('aria-pressed', 'true');
      expect(stageButton('Trace')).not.toHaveAttribute('aria-disabled');
      expect(within(screen.getByRole('group', { name: 'Stage' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Graph', 'ERD', 'Trace']);
      await matrix();
    }
  });

  it('LA-V98-R02-T02 An obligation\'s Trace stage draws its chain as five columns of cards', async () => {
    await openApp('/P-D-UC01-R01?stage=trace', served());
    const chain = await within(traceStage()).findByRole('region', { name: 'Traceability chain' });
    const columns = [...chain.querySelectorAll('.trace-column')];
    expect(columns.map((c) => c.querySelector('.trace-column-name')!.firstChild!.textContent!.trim())).toEqual(['Obligation', 'Design', 'Build', 'Tests', 'Files']);
    expect(columns[0].querySelector('[aria-current="page"]')).toHaveTextContent('P-D-UC01-R01');
    const design = within(columns[1] as HTMLElement).getByRole('list', { name: 'Design' });
    expect(within(design).getByRole('link', { name: /P-D-UC01-FL01-S01/ })).toHaveTextContent('Flow step');
    expect(within(columns[2] as HTMLElement).getByRole('link', { name: /P-D-CMD01-H/ })).toBeInTheDocument();
    expect(within(columns[3] as HTMLElement).getByRole('link', { name: /P-D-UC01-R01-T01/ })).toBeInTheDocument();
    expect(within(columns[4] as HTMLElement).getByText('test/lend.test.ts')).toBeInTheDocument();
    await waitFor(() => expect(counts()).toHaveTextContent(/^UC requirement · /));
  });

  it('LA-V98-R03-T02 A domain\'s Trace stage draws a matrix with a heading row per parent', async () => {
    await openApp('/P-D?stage=trace', served());
    const table = await matrix();
    expect(within(table.querySelector('thead')!).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Obligation', 'Design', 'Build', 'Tests', 'Files']);
    const groups = [...table.querySelectorAll('tr.group-row')];
    expect(groups.length).toBeGreaterThan(1);
    expect(within(groups[0] as HTMLElement).getByRole('link')).toHaveAttribute('href', expect.stringMatching(/^\/P-D-/));
    expect(within(table).getByRole('rowheader', { name: /P-D-UC01-R01/ })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: /P-D-INV01/ })).toBeInTheDocument();
  });

  it('LA-V98-R04-T02 Empty cells show as gaps, the header strip counts them, and Gaps only keeps those rows', async () => {
    await openApp('/P-D?stage=trace', served());
    const table = await matrix();
    const rows = () => [...table.querySelectorAll('tbody tr:not(.group-row)')];
    const all = rows().length;
    const gapped = rows().filter((r) => r.querySelector('td.is-gap')).length;
    expect(gapped).toBeGreaterThan(0);
    expect(gapped).toBeLessThan(all);
    expect(table.querySelector('td.is-gap .trace-missing')).not.toBeNull();
    await waitFor(() => expect(counts()).toHaveTextContent(`${all} obligations · ${gapped} with gaps`));
    fireEvent.click(within(traceStage()).getByRole('checkbox', { name: 'Gaps only' }));
    await waitFor(() => expect(rows().length).toBe(gapped));
    for (const r of rows()) expect(r.querySelector('td.is-gap')).not.toBeNull();
    // A use case whose every requirement is traced has no rows left under Gaps only.
    await openApp('/P-D-UC01?stage=trace', served());
    await matrix();
    fireEvent.click(within(traceStage()).getByRole('checkbox', { name: 'Gaps only' }));
    if (within(traceStage()).queryByRole('table') === null) expect(traceStage()).toHaveTextContent('No gaps');
  });

  it('LA-V98-R07-T02 The matrix ends with its Untraced section, counted in the header strip and kept by Gaps only', async () => {
    await openApp('/P-D?stage=trace', served());
    await matrix();
    const section = () => within(traceStage()).getByRole('region', { name: /^Untraced/ });
    const expected = untracedUnder(modelIndex(), 'P-D');
    const count = expected.reduce((n, g) => n + g.ids.length, 0);
    expect(count).toBeGreaterThan(0);
    await waitFor(() => expect(counts()).toHaveTextContent(`· ${count} untraced`));
    expect(within(section()).getByText('Flow steps')).toBeInTheDocument();
    expect(within(section()).getByRole('link', { name: /^P-D-UC01-FL01-S02/ })).toHaveAttribute('href', '/P-D-UC01-FL01-S02?stage=trace');
    expect(within(section()).getAllByRole('link')).toHaveLength(count);
    // Gaps only keeps it.
    fireEvent.click(within(traceStage()).getByRole('checkbox', { name: 'Gaps only' }));
    expect(within(section()).getAllByRole('link')).toHaveLength(count);
    // Where everything is reached it says so.
    await openApp('/P-D-UC01?stage=trace', served());
    await matrix();
    expect(section()).toHaveTextContent('Everything here serves a requirement or rule.');
  });

  it('LA-V98-R05-T01 Every cell links to its record and shows its ID, never wrapped, and its title; a file links to the record that names it', async () => {
    await openApp('/P-D-UC01-R01?stage=trace', served());
    const chain = await within(traceStage()).findByRole('region', { name: 'Traceability chain' });
    const file = within(chain).getByText('test/lend.test.ts').closest('a')!;
    expect(file).toHaveAttribute('href', '/P-D-UC01-R01-T01?stage=trace');
    expect(file).toHaveAttribute('title', 'test/lend.test.ts, named by P-D-UC01-R01-T01');
    // In a matrix each cell shows the record's ID and its title, the title cut with an ellipsis and whole in the tooltip.
    await openApp('/P-D?stage=trace', served());
    const table = await matrix();
    const ref = within(table).getByRole('rowheader', { name: /P-D-UC01-R01/ }).querySelector('a')!;
    expect(ref.querySelector('.trace-id')).toHaveTextContent('P-D-UC01-R01');
    expect(ref.querySelector('.trace-title')).toHaveTextContent('The loan is recorded');
    expect(ref).toHaveAttribute('title', 'The loan is recorded (P-D-UC01-R01)');
    expect(CSS).toMatch(/\.trace-id\s*\{[^}]*white-space:\s*nowrap/);
    expect(CSS).toMatch(/\.trace-title\s*\{[^}]*text-overflow:\s*ellipsis/);
    expect(CSS).toMatch(/\.data-table\.trace-matrix\s*\{[^}]*width:\s*max-content/);
    // A click moves the focus, and the Trace stage stays: a flow step shows the rows that hold it.
    await openApp('/P-D-UC01-R01?stage=trace', served());
    const chainAgain = await within(traceStage()).findByRole('region', { name: 'Traceability chain' });
    fireEvent.click(within(chainAgain).getByRole('link', { name: /P-D-UC01-FL01-S01/ }));
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01-FL01-S01'));
    expect(stageButton('Trace')).toHaveAttribute('aria-pressed', 'true');
    await matrix();
  });

  it('LA-V98-R06-T01 A long matrix draws 100 rows and adds 100 at a time', async () => {
    const data = modelWorkspace();
    const count = TRACE_PAGE + 20;
    addRows(data, 'uc_requirement', ...Array.from({ length: count }, (_, n) => ({ id: `P-D-UC01-R${String(n + 10).padStart(3, '0')}`, title: `Rule ${n + 10}`, use_case_id: 'P-D-UC01', statement: `Rule ${n + 10} MUST hold.` })));
    await openApp('/P-D-UC01?stage=trace', served(data));
    const table = await matrix();
    const rows = () => table.querySelectorAll('tbody tr:not(.group-row)').length;
    expect(rows()).toBe(TRACE_PAGE);
    const total = count + obligationsUnder(modelIndex(), 'P-D-UC01').length;
    expect(within(traceStage()).getByText(`${TRACE_PAGE} of ${total} shown`)).toBeInTheDocument();
    fireEvent.click(within(traceStage()).getByRole('button', { name: `Show ${total - TRACE_PAGE} more` }));
    await waitFor(() => expect(rows()).toBe(total));
    expect(within(traceStage()).queryByRole('button', { name: /^Show \d+ more$/ })).toBeNull();
  });

  it.each(['LA-PAT-APP-UX-R17-T02', 'LA-V98-R08-T01'])('%s A design, build or test record shows the rows that hold it, marked; one nothing traces to says so above the matrix around it; any other record shows the matrix around it', async () => {
    // A command a chain holds: the rows of each obligation whose chain holds it, the command marked in its cell.
    await openApp('/P-D-CMD01?stage=trace', served());
    let table = await matrix();
    expect(within(table).getAllByRole('rowheader').map((h) => h.querySelector('.trace-id')!.textContent)).toEqual(['P-D-UC01-R01']);
    const marked = table.querySelector('a[aria-current="page"]')!;
    expect(marked).toHaveClass('is-focus');
    expect(marked.querySelector('.trace-id')).toHaveTextContent('P-D-CMD01');
    expect(traceStage()).toHaveTextContent('The rows this record belongs to');
    await waitFor(() => expect(counts()).toHaveTextContent('1 obligation holds this record'));
    // A test is held by the obligation it proves.
    await openApp('/P-D-UC01-R01-T01?stage=trace', served());
    table = await matrix();
    expect(table.querySelector('a[aria-current="page"] .trace-id')).toHaveTextContent('P-D-UC01-R01-T01');

    // A command nothing traces to: the untraced state, then its aggregate's matrix, the command marked in its Untraced section.
    await openApp('/P-D-CMD02?stage=trace', served());
    table = await matrix();
    expect(within(traceStage()).getByText(/Nothing traces to this record: it serves no requirement or rule\./)).toHaveClass('trace-note', 'is-untraced');
    expect(within(table).getAllByRole('rowheader').map((h) => h.querySelector('.trace-id')!.textContent)).toEqual(['P-D-INV01', 'P-D-INV02']);
    expect(within(traceStage()).getByRole('region', { name: /^Untraced/ }).querySelector('a[aria-current="page"] .trace-id')).toHaveTextContent('P-D-CMD02');
    await waitFor(() => expect(counts()).toHaveTextContent('Untraced'));

    // An entity, outside every chain: the matrix of its aggregate, with no untraced warning.
    await openApp('/P-D-EN03?stage=trace', served());
    table = await matrix();
    expect(within(table).getAllByRole('rowheader').map((h) => h.querySelector('.trace-id')!.textContent)).toEqual(['P-D-INV01', 'P-D-INV02']);
    expect(traceStage().querySelector('.trace-note.is-untraced')).toBeNull();
    expect(traceStage()).toHaveTextContent('This record sits outside every chain');
    await waitFor(() => expect(counts()).toHaveTextContent(/^Outside the chains · matrix of Loan/));
  });
});
