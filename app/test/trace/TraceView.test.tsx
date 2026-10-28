import '../graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addRows } from '../fixtures/load';
import { modelIndex, modelWorkspace } from '../fixtures/model';
import { TRACE_PAGE } from '../../src/trace/TraceView';
import type { TraceHost, TraceScene } from '../../src/trace/TraceCanvas';
import { obligationsUnder, untracedUnder } from '../../src/trace/chain';
import { openApp } from '../helpers';

// The Trace stage (LA-V98): drawn on the canvas, an obligation's chain with its why columns, or a why
// tree and a lane per obligation under a record or group with its gaps in view, the lanes that hold a
// design, build or test record, or the lanes around a record outside every chain; and under it, its
// accessible layer and the phone's stage, the table of the same chains. It works on every focus
// (LA-PAT-APP-UX-R17).

const served = (data = modelWorkspace()) => ({ data });
const traceStage = () => screen.getByRole('region', { name: 'Trace stage' });
const stageButton = (name: string) => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });
const matrix = () => within(traceStage()).findByRole('table');
/** What the header strip says the trace holds. */
const counts = () => document.querySelector('.header-strip-counts');
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
/** The canvas, once it is laid out. */
const canvasHost = async () => {
  await waitFor(() => expect(traceStage().querySelector('.trace-flow[data-ready]')).not.toBeNull());
  return traceStage().querySelector<TraceHost>('.trace-flow')!;
};
/** What the canvas draws now, or (`whole`) every box of its picture. */
const drawn = async (whole = false): Promise<TraceScene> => (await canvasHost()).traceScene!(whole);
/** The table under the canvas: its accessible layer. */
const access = () => traceStage().querySelector<HTMLElement>('.trace-access')!;

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

  it('LA-V98-R02-T02 An obligation\'s Trace stage draws its chain on the canvas, why first, an arrow for each link', async () => {
    await openApp('/P-D-UC01-R01?stage=trace', served());
    const whole = await drawn(true);
    // The columns, why first; the requirement drawn as the focus.
    const columns = [...new Set([...whole.boxes].sort((a, b) => a.rect.left - b.rect.left).map((b) => b.column))];
    expect(columns).toEqual(['capability', 'parent', 'obligation', 'flow', 'step', 'design', 'build', 'tests', 'files']);
    expect(whole.boxes.filter((b) => b.focus).map((b) => b.id)).toEqual(['P-D-UC01-R01']);
    expect(whole.boxes.find((b) => b.id === 'P-D-UC01-FL01-S01')).toMatchObject({ kind: 'flow_step', stage: 'interaction-design', name: 'Flow step Librarian lends the thing' });
    // An arrow for each actual link, left to right.
    const arrows = whole.lines.filter((l) => !l.tree).map((l) => `${l.source} > ${l.target}`);
    expect(arrows).toEqual(expect.arrayContaining(['P-D-UC01-R01 > P-D-UC01-FL01', 'P-D-UC01-FL01 > P-D-UC01-FL01-S01', 'P-D-UC01-FL01-S01 > P-D-CMD01', 'P-D-CMD01 > P-D-CMD01-H', 'P-D-UC01-R01 > P-D-UC01-R01-T01', 'P-D-UC01-R01-T01 > file:test/lend.test.ts']));
    // The obligation sits in the middle of the frame.
    const now = await drawn();
    const focus = now.boxes.find((b) => b.focus)!;
    expect(focus.rect.left + focus.rect.width / 2).toBeCloseTo(now.canvas.width / 2, 0);
    // The table under it keeps the chain's five columns of cards.
    const chain = within(access()).getByRole('region', { name: 'Traceability chain' });
    expect([...chain.querySelectorAll('.trace-column-name')].map((c) => c.firstChild!.textContent!.trim())).toEqual(['Obligation', 'Design', 'Build', 'Tests', 'Files']);
    await waitFor(() => expect(counts()).toHaveTextContent(/^UC requirement · /));
  });

  it('LA-V98-R03-T02 A use case\'s and a domain\'s Trace stage draw the why tree from the focus and a lane per obligation', async () => {
    // A use case: its box is the tree's root, as tall as its lanes, each lane's obligation joined to it.
    await openApp('/P-D-UC01?stage=trace', served());
    let whole = await drawn(true);
    const root = whole.boxes.find((b) => b.lane === -1)!;
    expect(root).toMatchObject({ id: 'P-D-UC01', column: 'parent', focus: true });
    const obligations = whole.boxes.filter((b) => b.column === 'obligation');
    expect(obligations.map((b) => b.id)).toEqual(obligationsUnder(modelIndex(), 'P-D-UC01'));
    for (const o of obligations) expect(o.rect.top >= root.rect.top && o.rect.top + o.rect.height <= root.rect.top + root.rect.height + 0.01).toBe(true);
    expect(whole.lines.filter((l) => l.tree).map((l) => l.target)).toEqual(obligations.map((o) => o.id));
    // A domain: its capabilities are the tree's roots, every obligation under it a lane.
    await openApp('/P-D?stage=trace', served());
    whole = await drawn(true);
    expect(whole.boxes.find((b) => b.lane === -1 && b.column === 'capability')?.id).toBe('P-D-CAP01');
    expect(new Set(whole.boxes.filter((b) => b.column === 'obligation' && b.role === 'record').map((b) => b.id))).toEqual(new Set(obligationsUnder(modelIndex(), 'P-D')));
    // The table under it: the five columns, a heading row per parent linking to it.
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
    // The canvas keeps the lanes with a gap, each gap a dashed box in its column.
    const whole = await drawn(true);
    const lanes = new Set(whole.boxes.filter((b) => b.column === 'obligation' && b.role === 'record').map((b) => b.id));
    expect(lanes.size).toBe(gapped);
    const gaps = whole.boxes.filter((b) => b.role === 'gap');
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) expect(g).toMatchObject({ dashed: true, kind: 'gap' });
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
    expect(traceStage()).toHaveTextContent('Each requirement or rule whose chain holds this record');
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

  it('LA-V98-R05-T02 A click on a box opens its record, keeping the stage; a file\'s box opens the record that names it', async () => {
    await openApp('/P-D-UC01-R01?stage=trace', served());
    const whole = await drawn(true);
    expect(whole.boxes.find((b) => b.id === 'file:test/lend.test.ts')?.opens).toBe('P-D-UC01-R01-T01');
    const step = (await drawn()).boxes.find((b) => b.id === 'P-D-UC01-FL01-S01')!;
    const canvas = (await canvasHost()).querySelector('canvas')!;
    const at = { clientX: step.rect.left + step.rect.width / 2, clientY: step.rect.top + step.rect.height / 2, pointerType: 'mouse', pointerId: 1, button: 0 };
    fireEvent.pointerDown(canvas, at);
    fireEvent.pointerUp(canvas, at);
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01-FL01-S01'));
    expect(window.location.search).toBe('?stage=trace');
  });

  it('LA-V98-R09-T01 A record two lanes hold is drawn in both, marked In 2 lanes, and hovering one lights both', async () => {
    const data = modelWorkspace();
    addRows(data, 'happens_in', { source_id: 'P-D-UC01-FL01-S03', target_id: 'P-V01' });
    await openApp('/P-D-UC01?stage=trace', served(data));
    const copies = (await drawn(true)).boxes.filter((b) => b.id === 'P-V01');
    expect(copies.map((b) => b.lane)).toEqual([0, 1]);
    for (const c of copies) expect(c.notes).toEqual(['In 2 lanes']);
    // Hovering the first copy lights both, and the arrows touching them; the rest dims.
    const first = (await drawn()).boxes.find((b) => b.key === copies[0].key)!;
    fireEvent.pointerMove((await canvasHost()).querySelector('canvas')!, { clientX: first.rect.left + first.rect.width / 2, clientY: first.rect.top + first.rect.height / 2, pointerType: 'mouse', pointerId: 1 });
    const lit = await drawn(true);
    expect(lit.boxes.filter((b) => b.id === 'P-V01').every((b) => b.hover && b.lit)).toBe(true);
    expect(lit.boxes.find((b) => b.id === 'P-D-UC01-R02')?.lit).toBe(false);
    expect(lit.lines.filter((l) => l.target === 'P-V01').every((l) => l.lit)).toBe(true);
  });

  it('LA-V98-R10-T01 The table under the canvas carries the keyboard: a focused link rings its box, and the arrow keys walk the table', async () => {
    await openApp('/P-D-UC01?stage=trace', served());
    const host = await canvasHost();
    expect(host.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
    expect(CSS).toMatch(/\.trace-access\s*\{[^}]*clip-path:\s*inset\(50%\)/);
    const table = await matrix();
    expect(access().contains(table)).toBe(true);
    // A step's link takes focus: its box is drawn with the ring.
    const step = within(table).getAllByRole('link', { name: /^P-D-UC01-FL01-S01/ })[0];
    act(() => step.focus());
    await waitFor(async () => expect((await drawn(true)).boxes.filter((b) => b.ring).map((b) => b.id)).toEqual(['P-D-UC01-FL01-S01']));
    // Right to the next link, Down to the same cell of the next row.
    fireEvent.keyDown(step, { key: 'ArrowRight' });
    expect(document.activeElement).toHaveAttribute('data-trace-id', 'P-V01');
    const own = within(table).getByRole('rowheader', { name: /P-D-UC01-R01/ }).querySelector('a')!;
    act(() => own.focus());
    fireEvent.keyDown(own, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveAttribute('data-trace-id', 'P-D-UC01-R02');
  });

  it('LA-V98-R10-T02 On a phone the table is the Trace stage, and no canvas is drawn', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    try {
      await openApp('/P-D-UC01?stage=trace', served());
      const table = await matrix();
      expect(traceStage().querySelector('.trace-access')).toBeNull();
      expect(traceStage().querySelector('.trace-flow')).toBeNull();
      expect(table.closest('.trace-scroll')).toHaveAttribute('tabindex', '0');
      expect(within(traceStage()).getByRole('checkbox', { name: 'Gaps only' })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
