import '../graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addRows } from '../fixtures/load';
import { modelIndex, modelWorkspace } from '../fixtures/model';
import { TRACE_PAGE } from '../../src/trace/views';
import type { AllHost, AllScene } from '../../src/trace/TraceAll';
import { gapKey } from '../../src/trace/all';
import { DEFAULT_VIEW, readView } from '../../src/views/place';
import { obligationsUnder, untracedUnder } from '../../src/trace/chain';
import { traced } from './traces';
import { openApp } from '../helpers';

// The Trace stage (LA-V98): its All-at-once view drawn on the canvas, the product's whole trace in five columns, each
// record once with its links as lines, laid out once per product and data change (LA-PAT-APP-UX-R19): focusing a record
// lights its whole path and fades the rest, Gaps only keeps the gaps' paths; and under it, its accessible layer, the
// table of the chains under the focus. On a phone, one column at a time. It works on every focus (LA-PAT-APP-UX-R17).

const served = (data = modelWorkspace()) => ({ data });
/** The model product with an outcome its capability serves. */
const withOutcome = () => {
  const data = modelWorkspace();
  addRows(data, 'business_outcome', { id: 'P-BO01', title: 'More things lent', product_id: 'P', statement: 'Members borrow more.', measure: 'Loans a month', target: 'Up a tenth' });
  addRows(data, 'serves', { source_id: 'P-D-CAP01', target_id: 'P-BO01' });
  return data;
};
const traceStage = () => screen.getByRole('region', { name: 'Trace stage' });
const stageButton = (name: string) => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });
const matrix = () => within(traceStage()).findByRole('table');
/** What the header strip says the trace holds. */
const counts = () => document.querySelector('.header-strip-counts');
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
/** The canvas, once it is laid out. */
const canvasHost = async () => {
  await waitFor(() => expect(traceStage().querySelector('.trace-flow[data-ready]')).not.toBeNull());
  return traceStage().querySelector<AllHost>('.trace-flow')!;
};
/** What the canvas draws now, or (`whole`) every box and link of the view. */
const drawn = async (whole = false): Promise<AllScene> => (await canvasHost()).traceScene!(whole);
/** A drawn box's place in the map, from its place on the page and the camera. */
const inMap = (scene: AllScene, b: AllScene['boxes'][number]) => {
  const { camera: v, canvas: c } = scene;
  return [b.key, (b.rect.left - c.left - v.x) / v.zoom, (b.rect.top - c.top - v.y) / v.zoom, b.rect.width / v.zoom, b.rect.height / v.zoom].map((n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n));
};
/** Whether a drawn box lies inside the canvas. */
const inView = (scene: AllScene, b: AllScene['boxes'][number]) => b.rect.left >= scene.canvas.left - 0.5 && b.rect.left + b.rect.width <= scene.canvas.left + scene.canvas.width + 0.5 && b.rect.top >= scene.canvas.top - 0.5 && b.rect.top <= scene.canvas.top + scene.canvas.height;
/** A box of the scene by its key. */
const box = (scene: AllScene, key: string) => scene.boxes.find((b) => b.key === key)!;
/** Clicks a drawn box. */
const click = async (key: string) => {
  const b = await waitFor(async () => { const at = (await drawn()).boxes.find((x) => x.key === key); expect(at).toBeDefined(); return at!; });
  const canvas = (await canvasHost()).querySelector('canvas')!;
  const at = { clientX: b.rect.left + b.rect.width / 2, clientY: b.rect.top + b.rect.height / 2, pointerType: 'mouse', pointerId: 1, button: 0 };
  fireEvent.pointerDown(canvas, at);
  fireEvent.pointerUp(canvas, at);
};
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

  it('LA-V98-R02-T02 An obligation\'s Trace stage draws the five columns, each record once, the obligation as the focus with its use case to its left and what builds and proves it to its right', async () => {
    const { requests } = await openApp('/P-D-UC01-R01?stage=trace', served(withOutcome()));
    const whole = await drawn(true);
    // Its links, gaps and untraced records are the Trace read's.
    expect(requests).toContain('GET /api/trace/list-traces?product_id=P');
    expect(whole.columns.map((c) => c.name)).toEqual(['Outcomes', 'Use cases', 'Obligations', 'Built by', 'Proved by']);
    // Each record once, every box one size.
    expect(new Set(whole.boxes.map((b) => b.key)).size).toBe(whole.boxes.length);
    expect(new Set(whole.boxes.map((b) => `${Math.round(b.rect.width)}x${Math.round(b.rect.height)}`)).size).toBe(1);
    const own = box(whole, 'P-D-UC01-R01');
    expect(own).toMatchObject({ focus: true, column: 2, kind: 'uc_requirement' });
    expect(box(whole, 'P-BO01').column).toBe(0);
    expect(box(whole, 'P-D-UC01')).toMatchObject({ column: 1, name: 'Use case Lend a thing' });
    expect(box(whole, 'P-D-UC01').rect.left).toBeLessThan(own.rect.left);
    for (const k of ['P-D-CMD01-H', 'P-D-UC01-R01-T01']) expect(box(whole, k).rect.left, k).toBeGreaterThan(own.rect.left + own.rect.width);
    // A record the view does not draw (a flow step) is in none of its columns.
    expect(whole.boxes.some((b) => b.id === 'P-D-UC01-FL01-S01')).toBe(false);
    // The obligation is in view.
    await waitFor(async () => { const now = await drawn(); expect(inView(now, box(now, 'P-D-UC01-R01'))).toBe(true); });
    // The table under it keeps the chain's five columns of cards.
    const chain = within(access()).getByRole('region', { name: 'Traceability chain' });
    expect([...chain.querySelectorAll('.trace-column-name')].map((c) => c.firstChild!.textContent!.trim())).toEqual(['Obligation', 'Design', 'Build', 'Tests', 'Files']);
    await waitFor(() => expect(counts()).toHaveTextContent(/^UC requirement · /));
  });

  it('LA-V98-R03-T02 Each link is a line of its kind between two columns; a record two use cases reach has a line from each and one box', async () => {
    const data = withOutcome();
    addRows(data, 'use_case', { id: 'P-D-UC02', title: 'Renew a loan', capability_id: 'P-D-CAP01', goal: 'A member keeps a thing longer.' });
    addRows(data, 'flow', { id: 'P-D-UC02-FL01', title: 'Renew a loan in the web app', use_case_id: 'P-D-UC02', interface_id: 'P-IF01' });
    addRows(data, 'flow_step', { id: 'P-D-UC02-FL01-S01', title: 'Librarian renews the loan', flow_id: 'P-D-UC02-FL01', path: 'main', position: 1 });
    addRows(data, 'invokes', { source_id: 'P-D-UC02-FL01-S01', target_id: 'P-D-CMD01' });
    await openApp('/P-D-INV01?stage=trace', served(data));
    const whole = await drawn(true);
    const lines = whole.lines.map((l) => `${l.kind}:${l.from}>${l.to}`);
    expect(lines).toEqual(expect.arrayContaining(['serves:P-BO01>P-D-UC01', 'reaches:P-D-UC01>P-D-INV01', 'built:P-D-INV01>P-D-INV01-RL', 'proved:P-D-INV01>P-D-INV01-T']));
    expect(lines.filter((l) => l.startsWith('reaches:') && l.endsWith('>P-D-INV01'))).toEqual(['reaches:P-D-UC01>P-D-INV01', 'reaches:P-D-UC02>P-D-INV01']);
    expect(whole.boxes.filter((b) => b.id === 'P-D-INV01')).toHaveLength(1);
    // A frame draws the lines touching the boxes it draws.
    const now = await drawn();
    expect(now.lines.length).toBeGreaterThan(0);
    const shown = new Set(now.boxes.map((b) => b.key));
    for (const l of now.lines) expect(shown.has(l.from) || shown.has(l.to)).toBe(true);
  });



  it('LA-V98-R04-T02 Empty cells show as gaps, the header strip counts them, and Gaps only keeps those rows and fades the complete branches', async () => {
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
    // The canvas keeps every obligation, those with a gap and their paths at full strength and the rest faded; each gap a
    // dashed box in the column of what is missing.
    const whole = await drawn(true);
    const domain = obligationsUnder(modelIndex(), 'P-D');
    expect(whole.boxes.filter((b) => b.column === 2 && domain.includes(b.id)).length).toBe(all);
    await waitFor(async () => expect((await drawn(true)).boxes.filter((b) => b.column === 2 && domain.includes(b.id) && b.strength === 1).length).toBe(gapped));
    const gaps = (await drawn(true)).boxes.filter((b) => b.role === 'gap');
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) expect(g).toMatchObject({ dashed: true, kind: 'gap', strength: 1 });
    expect(box(await drawn(true), gapKey('P-D-INV02', 'tests')).column).toBe(4);
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
    const { index, traces } = traced(modelWorkspace());
    const expected = untracedUnder(index, traces, 'P-D');
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
    // A command three chains hold: the requirement a step invokes it for, the domain service it calls and the
    // specification it checks; a row for each, the command marked in its cell.
    await openApp('/P-D-CMD01?stage=trace', served());
    let table = await matrix();
    expect(within(table).getAllByRole('rowheader').map((h) => h.querySelector('.trace-id')!.textContent).sort()).toEqual(['P-D-DS01', 'P-D-SP01', 'P-D-UC01-R01']);
    const marked = table.querySelector('a[aria-current="page"]')!;
    expect(marked).toHaveClass('is-focus');
    expect(marked.querySelector('.trace-id')).toHaveTextContent('P-D-CMD01');
    expect(traceStage()).toHaveTextContent('Each requirement or rule whose chain holds this record');
    await waitFor(() => expect(counts()).toHaveTextContent('3 obligations hold this record'));
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
    await waitFor(() => expect(counts()).toHaveTextContent(/^Untraced · Loan: 2 obligations · \d+ with gaps/));

    // An entity, outside every chain: the matrix of its aggregate, with no untraced warning.
    await openApp('/P-D-EN03?stage=trace', served());
    table = await matrix();
    expect(within(table).getAllByRole('rowheader').map((h) => h.querySelector('.trace-id')!.textContent)).toEqual(['P-D-INV01', 'P-D-INV02']);
    expect(traceStage().querySelector('.trace-note.is-untraced')).toBeNull();
    expect(traceStage()).toHaveTextContent('This record sits outside every chain');
    await waitFor(() => expect(counts()).toHaveTextContent(/^Outside the chains · Loan: 2 obligations · \d+ with gaps/));
  });

  it('LA-V98-R05-T02 A click on a box opens its record, keeping the stage; a gap opens nothing', async () => {
    const data = withOutcome();
    await openApp('/P-D-UC01-R01?stage=trace', served(data));
    await click('P-D-UC01');
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01'));
    expect(window.location.search).toBe('?stage=trace');
    await waitFor(async () => expect((await drawn(true)).boxes.filter((b) => b.focus).map((b) => b.key)).toEqual(['P-D-UC01']));
    // A gap is no record: a click on it leaves the focus where it is.
    await openApp('/P-D-INV02?stage=trace', served(data));
    await click(gapKey('P-D-INV02', 'tests'));
    await new Promise((r) => setTimeout(r, 50));
    expect(window.location.pathname).toBe('/P-D-INV02');
    // From the keyboard: Left from the requirement goes along its link to its use case.
    await openApp('/P-D-UC01-R01?stage=trace', served(data));
    await canvasHost();
    fireEvent.keyDown(document.body, { key: 'ArrowLeft', code: 'ArrowLeft' });
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01'));
  });

  it('LA-V98-R11-T01 Scroll pans, Cmd/Ctrl+scroll zooms and a drag pans the trace\'s camera, and . frames the focus again with a glide, as on the graph', async () => {
    await openApp('/P-D-UC01?stage=trace', served());
    const host = await canvasHost();
    // The camera at rest once the trace's read is drawn and framed: two reads apart give the same camera.
    const framed = await waitFor(async () => {
      const before = (await drawn()).camera;
      await new Promise((r) => setTimeout(r, 50));
      expect((await drawn()).camera).toEqual(before);
      return before;
    }, { timeout: 3000 });
    const canvas = host.querySelector('canvas')!;
    // Scroll pans, by the pixels it scrolled; Cmd or Ctrl with scroll zooms.
    fireEvent.wheel(canvas, { deltaY: 40, clientX: 200, clientY: 200 });
    await waitFor(async () => expect((await drawn()).camera.y).toBeCloseTo(framed.y - 40, 0));
    expect((await drawn()).camera.zoom).toBe(framed.zoom);
    // A new scroll after a pause: within one scroll, pressing Ctrl would drop the rest of it (wheelLatch).
    await new Promise((r) => setTimeout(r, 200));
    fireEvent.wheel(canvas, { deltaY: -200, ctrlKey: true, clientX: 200, clientY: 200 });
    await waitFor(async () => expect((await drawn()).camera.zoom).toBeGreaterThan(framed.zoom));
    fireEvent.pointerDown(canvas, { clientX: 300, clientY: 300, pointerType: 'mouse', pointerId: 1, button: 0 });
    fireEvent.pointerMove(canvas, { clientX: 340, clientY: 320, pointerType: 'mouse', pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 340, clientY: 320, pointerType: 'mouse', pointerId: 1 });
    expect((await drawn()).camera).not.toEqual(framed);
    expect(within(traceStage()).getByRole('button', { name: 'Frame the focus' })).toHaveAttribute('aria-keyshortcuts', '.');
    fireEvent.keyDown(document.body, { key: '.', code: 'Period' });
    await waitFor(async () => {
      const now = (await drawn()).camera;
      expect(now.x).toBeCloseTo(framed.x, 0);
      expect(now.y).toBeCloseTo(framed.y, 0);
      expect(now.zoom).toBeCloseTo(framed.zoom, 4);
    });
  });

  it('LA-V98-R08-T03 Focusing an outcome lights its whole path and fades the rest; hovering a box lights its path while the pointer is on it', async () => {
    await openApp('/P-BO01?stage=trace', served(withOutcome()));
    await waitFor(async () => {
      const whole = await drawn(true);
      for (const k of ['P-BO01', 'P-D-UC01', 'P-D-UC01-R01', 'P-D-CMD01-H', 'P-D-UC01-R01-T01']) expect(box(whole, k).strength, k).toBe(1);
      // A policy no use case reaches is off the outcome's path: faded, never taken out.
      expect(box(whole, 'P-D-PO01').strength).toBeLessThan(1);
    });
    const whole = await drawn(true);
    expect(whole.lines.filter((l) => l.lit).map((l) => `${l.from}>${l.to}`)).toContain('P-BO01>P-D-UC01');
    // The key names the faded.
    expect(within(within(traceStage()).getByRole('region', { name: 'Key' })).getByText('Faded')).toBeInTheDocument();
    // Hovering the use case lights its path; its outcome and obligations lit, the policy not.
    const uc = await waitFor(async () => { const b = (await drawn()).boxes.find((x) => x.key === 'P-D-UC01'); expect(b).toBeDefined(); return b!; });
    fireEvent.pointerMove((await canvasHost()).querySelector('canvas')!, { clientX: uc.rect.left + uc.rect.width / 2, clientY: uc.rect.top + uc.rect.height / 2, pointerType: 'mouse', pointerId: 1 });
    const lit = await drawn(true);
    expect(box(lit, 'P-D-UC01')).toMatchObject({ hover: true, lit: true });
    expect(box(lit, 'P-BO01').lit).toBe(true);
    expect(box(lit, 'P-D-INV01').lit).toBe(true);
    expect(box(lit, 'P-D-PO01').lit).toBe(false);
  });

  it('LA-V98-R06-T03 Only what is in view is drawn: fitting a large product draws its columns as bars, at most 260 boxes', async () => {
    const data = withOutcome();
    addRows(data, 'uc_requirement', ...Array.from({ length: 400 }, (_, n) => ({ id: `P-D-UC01-R${String(n + 10).padStart(3, '0')}`, title: `Rule ${n + 10}`, use_case_id: 'P-D-UC01', statement: `Rule ${n + 10} MUST hold.` })));
    await openApp('/P?stage=trace', served(data));
    await canvasHost();
    expect((await drawn(true)).boxes.length).toBeGreaterThan(400);
    fireEvent.click(within(traceStage()).getByRole('button', { name: 'Fit the whole map' }));
    await waitFor(async () => {
      const now = await drawn();
      expect(now.bars).toBeGreaterThan(0);
      expect(now.boxes.length).toBeLessThanOrEqual(260);
    });
  });

  it('LA-V98-R10-T01 The table under the canvas carries the keyboard: a focused link rings its box, and the arrow keys walk the table', async () => {
    await openApp('/P-D-UC01?stage=trace', served());
    const host = await canvasHost();
    expect(host.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
    expect(CSS).toMatch(/\.trace-access\s*\{[^}]*clip-path:\s*inset\(50%\)/);
    const table = await matrix();
    expect(access().contains(table)).toBe(true);
    // A requirement's link takes focus: its box is drawn with the ring.
    const own = within(table).getByRole('rowheader', { name: /P-D-UC01-R01/ }).querySelector('a')!;
    act(() => own.focus());
    await waitFor(async () => expect((await drawn(true)).boxes.filter((b) => b.ring).map((b) => b.id)).toEqual(['P-D-UC01-R01']));
    const step = within(table).getAllByRole('link', { name: /^P-D-UC01-FL01-S01/ })[0];
    act(() => step.focus());
    // Right to the next link, Down to the same cell of the next row.
    fireEvent.keyDown(step, { key: 'ArrowRight' });
    expect(document.activeElement).toHaveAttribute('data-trace-id', 'P-V01');
    act(() => own.focus());
    fireEvent.keyDown(own, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveAttribute('data-trace-id', 'P-D-UC01-R02');
  });

  it.each(['LA-PAT-APP-UX-R19-T01', 'LA-V98-R12-T01'])('%s The All-at-once view is laid out once: focusing two records and Gaps only move the camera and fade, never a box; a stage switch lands on the focus', async () => {
    // A stage switch from the graph keeps the focus and lands the camera on it at once: a requirement, framed.
    await openApp('/P-D-UC01-R01?stage=graph', served(withOutcome()));
    await screen.findByRole('heading', { level: 1 });
    fireEvent.keyDown(document.body, { key: '3', code: 'Digit3', ctrlKey: true });
    expect(window.location.search).toBe('?stage=trace');
    let scene = await drawn();
    expect(inView(scene, box(scene, 'P-D-UC01-R01'))).toBe(true);
    expect(box(scene, 'P-D-UC01-R01').focus).toBe(true);
    const before = (await drawn(true)).boxes.map((b) => inMap(scene, b));
    const camera = scene.camera;
    // Focusing its test, then its command's handler, from the table: the camera moves, every box keeps its place.
    for (const id of ['P-D-UC01-R01-T01', 'P-D-CMD01-H']) {
      const at = access().querySelector(`[data-trace-id="${id}"]`)!;
      fireEvent.click(at.closest('a') ?? at.querySelector('a')!);
      await waitFor(() => expect(window.location.pathname).toBe(`/${id}`));
      if (id === 'P-D-UC01-R01-T01') await waitFor(async () => expect((await drawn()).camera).not.toEqual(camera));
      scene = await drawn(true);
      expect(scene.boxes.map((b) => inMap(scene, b))).toEqual(before);
      expect(scene.boxes.filter((b) => b.focus).map((b) => b.key)).toEqual([id]);
    }
    // Gaps only fades what is off the gaps' paths, and moves nothing.
    fireEvent.click(within(traceStage()).getByRole('checkbox', { name: 'Gaps only' }));
    await waitFor(async () => expect(box(await drawn(true), 'P-D-UC01-R01-T01').strength).toBeLessThan(1));
    scene = await drawn(true);
    expect(scene.boxes.map((b) => inMap(scene, b))).toEqual(before);
  });

  it('LA-V98-R13-T01 The toolbar switches the Trace\'s view, All at once or Delivery, kept by the place', async () => {
    await openApp('/P-D-UC01?stage=trace', served());
    await canvasHost();
    const views = within(traceStage()).getByRole('group', { name: 'Trace view' });
    expect(within(views).getByRole('button', { name: 'All at once' })).toHaveAttribute('aria-pressed', 'true');
    // Delivery is offered once its view is built.
    expect(within(views).getByRole('button', { name: 'Delivery' })).toBeDisabled();
    // The view is the place's, kept with its depth: each tab its own, All at once by default.
    expect(DEFAULT_VIEW.trace).toBe('all-at-once');
    expect(readView({ ...DEFAULT_VIEW, trace: 'delivery' }).trace).toBe('delivery');
    expect(readView({ depth: 1, hiddenKinds: [] }).trace).toBe('all-at-once');
    // The Tree and its v key are gone.
    expect(within(traceStage()).queryByRole('group', { name: 'Layout' })).toBeNull();
  });

  it('LA-V98-R14-T01 On a phone the Trace is one column at a time, the focus\'s links listed above it, and no canvas is drawn', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    try {
      await openApp('/P-D-UC01-R01?stage=trace', served(withOutcome()));
      const list = await within(traceStage()).findByRole('region', { name: 'Trace columns' });
      expect(traceStage().querySelector('.trace-flow')).toBeNull();
      expect(within(traceStage()).getByRole('checkbox', { name: 'Gaps only' })).toBeInTheDocument();
      // The focus's column first, its own links by kind.
      const columns = within(list).getByRole('group', { name: 'Column' });
      expect(within(columns).getByRole('button', { name: /^Obligations/ })).toHaveAttribute('aria-pressed', 'true');
      const links = within(list).getByRole('region', { name: 'The focus\'s links' });
      expect(links).toHaveTextContent('Reached by');
      expect(links).toHaveTextContent('Built by');
      expect(links).toHaveTextContent('Proved by');
      // Another column, and a link that moves the focus.
      fireEvent.click(within(columns).getByRole('button', { name: /^Use cases/ }));
      expect(within(list).getByRole('heading', { level: 3 })).toHaveTextContent('Use cases');
      fireEvent.click(within(links).getByRole('link', { name: /P-D-UC01-R01-T01/ }));
      await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01-R01-T01'));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('LA-V96-R36-T02 With Highlight changes on, the All-at-once view gives a new record its pill, dims the rest and rolls each column\'s changes up in its header', async () => {
    const committed = modelWorkspace().sources[0].tables;
    const baseline = (since: string) => ({ state: 'ok' as const, commit: 'a'.repeat(40), short: 'aaaaaaa', subject: since, date: '2026-10-27T10:00:00Z', base: null, tables: committed });
    await openApp('/P?stage=trace', { data: withOutcome(), baseline });
    const tools = await screen.findByRole('group', { name: 'Changes' });
    await waitFor(() => expect(tools.textContent).toMatch(/Changes\s*2/), { timeout: 4000 });
    expect((await drawn(true)).boxes.find((b) => b.id === 'P-BO01')?.pill).toBeNull();
    fireEvent.click(within(tools).getByRole('button', { name: 'Highlight changes' }));
    await waitFor(async () => expect((await drawn(true)).boxes.find((b) => b.id === 'P-BO01')?.pill).toBe('added'));
    const scene = await drawn(true);
    // The unchanged boxes dim to a fifth (the capability the outcome is served by changed with its link); the new outcome stays whole, and its column says so.
    expect(scene.boxes.find((b) => b.id === 'P-BO01')!.strength).toBe(1);
    await waitFor(async () => expect((await drawn(true)).boxes.filter((b) => !b.pill).every((b) => b.strength <= 0.2 + 1e-9)).toBe(true));
    expect(scene.columns[0]!.rollup).toBe('1 new');
  });
});
