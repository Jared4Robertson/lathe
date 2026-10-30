import '../graph/setup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addRows } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import type { DeliveryHost, DeliveryScene } from '../../src/trace/delivery/TraceDelivery';
import { openApp } from '../helpers';

// The Trace stage's Delivery view (LA-V98) in the app: one row per use case on the canvas, from its outcomes to its
// acceptance tests, read from the Delivery read (list-delivery); its toolbar's Expand row and Expand all, the path a
// selection lights, its accessible layer, and on a phone one use case at a time.

/** The model product with an outcome its capability serves, and a second use case of no flow. */
const withOutcome = () => {
  const data = modelWorkspace();
  addRows(data, 'business_outcome', { id: 'P-BO01', title: 'More things lent', product_id: 'P', statement: 'Members borrow more.', measure: 'Loans a month', target: 'Up a tenth' });
  addRows(data, 'serves', { source_id: 'P-D-CAP01', target_id: 'P-BO01' });
  addRows(data, 'use_case', { id: 'P-D-UC02', title: 'Return a thing', capability_id: 'P-D-CAP01', goal: 'A member brings a thing back.' });
  return data;
};
const traceStage = () => screen.getByRole('region', { name: 'Trace stage' });
const counts = () => document.querySelector('.header-strip-counts');
/** Opens a page on the Trace stage and switches it to Delivery. */
async function openDelivery(path: string, data = withOutcome()) {
  const opened = await openApp(path, { data });
  const views = await within(traceStage()).findByRole('group', { name: 'Trace view' });
  fireEvent.click(within(views).getByRole('button', { name: 'Delivery' }));
  return opened;
}
/** The canvas, once it is drawn. */
const canvasHost = async () => {
  await waitFor(() => expect(traceStage().querySelector('.trace-flow[data-view="delivery"][data-ready]')).not.toBeNull());
  return traceStage().querySelector<DeliveryHost>('.trace-flow[data-view="delivery"]')!;
};
const drawn = async (whole = true): Promise<DeliveryScene> => (await canvasHost()).deliveryScene!(whole);
const box = (scene: DeliveryScene, key: string) => scene.boxes.find((b) => b.key === key);
/** Clicks a drawn box at its middle, or (`toggle`) its toggle. */
const click = async (key: string, toggle = false) => {
  const b = await waitFor(async () => { const found = box(await drawn(false), key); expect(found).toBeDefined(); return found!; });
  const canvas = (await canvasHost()).querySelector('canvas')!;
  const at = toggle ? { clientX: b.toggle!.x, clientY: b.toggle!.y } : { clientX: b.rect.left + b.rect.width / 2, clientY: b.rect.top + b.rect.height / 2 };
  const point = { ...at, pointerType: 'mouse', pointerId: 1, button: 0 };
  fireEvent.pointerDown(canvas, point);
  fireEvent.pointerUp(canvas, point);
};
const toolbarButton = (name: string) => within(traceStage()).getByRole('button', { name });

describe('the Trace stage\'s Delivery view', () => {
  it('LA-V98-R15-T01 Delivery draws one row per use case across the five columns, each use case once, with a line from its outcome, read from list-delivery', async () => {
    const { requests } = await openDelivery('/P-D-UC01?stage=trace');
    const scene = await drawn();
    expect(requests).toContain('GET /api/delivery/list-delivery?product_id=P');
    expect(scene.columns.map((c) => c.name)).toEqual(['Outcome', 'Use case', 'Design flow', 'Technical flow', 'Acceptance test suite']);
    expect(scene.rows).toEqual(['P-D-UC01', 'P-D-UC02']);
    // Each use case once, in the Use case column; the outcome once, with a line to each row it serves.
    expect(scene.boxes.filter((b) => b.id === 'P-D-UC01')).toHaveLength(1);
    expect(box(scene, 'P-D-UC01|use-case')).toMatchObject({ column: 1, focus: true, kind: 'use_case' });
    expect(box(scene, 'outcome/P-BO01')).toMatchObject({ column: 0 });
    expect(scene.lines.filter((l) => l.kind === 'serves').map((l) => `${l.from}>${l.to}`)).toEqual(['outcome/P-BO01>P-D-UC01|use-case', 'outcome/P-BO01>P-D-UC02|use-case']);
    await waitFor(() => expect(counts()).toHaveTextContent('2 use cases · 2 with gaps · 0 serve no outcome'));
  });

  it('LA-V98-R16-T02 A closed row shows a status per stage, a stage with a gap a dashed box', async () => {
    await openDelivery('/P-D-UC01?stage=trace');
    const scene = await drawn();
    expect(box(scene, 'P-D-UC01|design')).toMatchObject({ role: 'status', title: '1 flow · all designed', dashed: false, opens: true, open: false });
    expect(box(scene, 'P-D-UC01|suite')).toMatchObject({ role: 'gap', title: '3 tests · 1 not proved', dashed: true });
    expect(box(scene, 'P-D-UC02|design')).toMatchObject({ role: 'gap', title: 'No flows', dashed: true });
  });

  it('LA-V98-R17-T02 Boxes open by their toggle, Expand row opens the focus\'s row and Expand all a stage in every row; the place keeps what is open', async () => {
    await openDelivery('/P-D-UC01?stage=trace');
    await canvasHost();
    // A box's toggle opens it: its children show under it.
    await click('P-D-UC01|design', true);
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|design/P-D-UC01-FL01')).toBeDefined());
    expect(box(await drawn(), 'P-D-UC01|design')!.open).toBe(true);
    // Expand row: every stage of the focus's row.
    fireEvent.click(toolbarButton('Expand row'));
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|use-case/P-D-UC01-R01')).toBeDefined());
    expect(box(await drawn(), 'P-D-UC01|technical/hint')).toMatchObject({ role: 'hint', title: 'Select a step to show its chain' });
    expect(toolbarButton('Expand row')).toHaveAttribute('aria-pressed', 'true');
    // Expand all, Suite: the suite of every row, and the column's name says so.
    const every = within(traceStage()).getByRole('group', { name: 'Expand all' });
    fireEvent.click(within(every).getByRole('button', { name: 'Suite' }));
    await waitFor(async () => expect((await drawn()).columns[4].open).toBe(true));
    expect(box(await drawn(), 'P-D-UC02|suite')!.open).toBe(true);
    expect(within(every).getByRole('button', { name: 'Suite' })).toHaveAttribute('aria-pressed', 'true');
    // Expand all, Technical: every step's chain, grouped by step.
    fireEvent.click(within(every).getByRole('button', { name: 'Technical' }));
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|technical/step:P-D-UC01-FL01-S01/P-D-CMD01-H')).toBeDefined());
    expect(box(await drawn(), 'P-D-UC01|technical/step:P-D-UC01-FL01-S02/P-INT01-AD')).toBeDefined();
    // The place keeps what is open: back to All at once and to Delivery again, it is as it was.
    const views = within(traceStage()).getByRole('group', { name: 'Trace view' });
    fireEvent.click(within(views).getByRole('button', { name: 'All at once' }));
    await waitFor(() => expect(traceStage().querySelector('.trace-flow[data-view="all-at-once"]')).not.toBeNull());
    fireEvent.click(within(within(traceStage()).getByRole('group', { name: 'Trace view' })).getByRole('button', { name: 'Delivery' }));
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|use-case/P-D-UC01-R01')).toBeDefined());
  });

  it('LA-V98-R22-T02 The outcomes a focused row serves are drawn beside it, and follow the focus as it walks to another row', async () => {
    await openDelivery('/P-D-UC02?stage=trace');
    await canvasHost();
    const level = async (u: string) => {
      const scene = await drawn();
      expect(box(scene, 'outcome/P-BO01')!.rect.top).toBeCloseTo(box(scene, `${u}|use-case`)!.rect.top, 3);
    };
    await waitFor(() => level('P-D-UC02'));
    // The walk to the other row's use case: the outcome glides with it.
    const above = (await drawn()).rows.indexOf('P-D-UC01') < (await drawn()).rows.indexOf('P-D-UC02');
    fireEvent.click(toolbarButton(above ? 'Step to the box above in its column' : 'Step to the box below in its column'));
    await waitFor(() => expect(window.location.pathname).not.toBe('/P-D-UC02'));
    // A box of the other row (its last when it is open): the outcome level with that row's use case.
    await waitFor(() => level('P-D-UC01'));
  });

  it('LA-V98-R18-T02 Clicking a box opens its record and lights its path across its row, fading the rest; the chain shows for the selected step', async () => {
    await openDelivery('/P-D-UC01?stage=trace');
    await canvasHost();
    if (toolbarButton('Expand row').getAttribute('aria-pressed') !== 'true') fireEvent.click(toolbarButton('Expand row'));
    await click('P-D-UC01|design/P-D-UC01-FL01', true);
    await click('P-D-UC01|design/P-D-UC01-FL01/P-D-UC01-FL01-S01');
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01-FL01-S01'));
    // The step's chain in Technical flow, its requirement and its test lit, the line across each column, the rest faded.
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|technical/step:P-D-UC01-FL01-S01/P-D-CMD01-H')).toBeDefined());
    await waitFor(async () => {
      const scene = await drawn();
      expect(box(scene, 'P-D-UC01|design/P-D-UC01-FL01/P-D-UC01-FL01-S01')).toMatchObject({ focus: true, lit: true });
      expect(box(scene, 'P-D-UC01|use-case/P-D-UC01-R01')!.lit).toBe(true);
      expect(box(scene, 'P-D-UC01|use-case/P-D-UC01-R02')!.lit).toBe(false);
      expect(box(scene, 'P-D-UC01|suite/P-D-UC01-R01-T01')!.lit).toBe(true);
      expect(box(scene, 'P-D-UC01|suite/P-D-UC01-R01-T01')!.strength).toBe(1);
      expect(box(scene, 'P-D-UC02|use-case')!.strength).toBeLessThan(1);
      expect(scene.lines.filter((l) => l.kind === 'path').map((l) => `${l.from}>${l.to}`)).toEqual(expect.arrayContaining([
        'P-D-UC01|use-case/P-D-UC01-R01>P-D-UC01|design/P-D-UC01-FL01/P-D-UC01-FL01-S01',
        'P-D-UC01|design/P-D-UC01-FL01/P-D-UC01-FL01-S01>P-D-UC01|technical/step:P-D-UC01-FL01-S01/P-UI01',
      ]));
    });
    // The wiki card follows the selection.
    await screen.findByRole('heading', { level: 1, name: 'Librarian lends the thing' });
  });

  it('LA-V98-R21-T01 Under the canvas, the list is its accessible layer; on a phone it is the view, one use case at a time, each stage opening', async () => {
    await openDelivery('/P-D-UC01?stage=trace');
    await canvasHost();
    expect(traceStage().querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
    const access = traceStage().querySelector<HTMLElement>('.trace-access')!;
    expect(within(access).getByRole('combobox', { name: 'Use case' })).toHaveValue('P-D-UC01');
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    try {
      await openDelivery('/P-D-UC01?stage=trace');
      const list = await within(traceStage()).findByRole('region', { name: 'Delivery' });
      expect(traceStage().querySelector('.trace-flow')).toBeNull();
      expect(within(list).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Outcome', 'Use case', 'Design flow', 'Technical flow', 'Acceptance test suite']);
      const design = within(list).getByRole('region', { name: 'Design flow' });
      // Open (the place may keep it open from before).
      const toggle = within(design).getByRole('button', { name: /1 flow · all designed/ });
      if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
      expect(within(design).getByRole('link', { name: /^Flow · P-D-UC01-FL01(?!-)/ })).toBeInTheDocument();
      // Another use case.
      fireEvent.change(within(list).getByRole('combobox', { name: 'Use case' }), { target: { value: 'P-D-UC02' } });
      expect(within(within(list).getByRole('region', { name: 'Design flow' })).getByText('No flows', { selector: '.trace-col-title' })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('LA-V96-R36-T03 With Highlight changes on, the Delivery view gives a new record its pill, rolls its row\'s changes up on its use case and its column\'s in its header', async () => {
    const committed = modelWorkspace().sources[0].tables;
    const baseline = (since: string) => ({ state: 'ok' as const, commit: 'a'.repeat(40), short: 'aaaaaaa', subject: since, date: '2026-10-27T10:00:00Z', base: null, tables: committed });
    await openApp('/P?stage=trace', { data: withOutcome(), baseline });
    fireEvent.click(within(within(traceStage()).getByRole('group', { name: 'Trace view' })).getByRole('button', { name: 'Delivery' }));
    const tools = await screen.findByRole('group', { name: 'Changes' });
    await waitFor(() => expect(tools.textContent).toMatch(/Changes\s*\d/), { timeout: 4000 });
    fireEvent.click(within(tools).getByRole('button', { name: 'Highlight changes' }));
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC02|use-case')?.pill).toBe('added'));
    const scene = await drawn();
    expect(box(scene, 'outcome/P-BO01')!.pill).toBe('added');
    expect(scene.columns[1].rollup).toBe('1 new');
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|design')!.strength).toBeLessThanOrEqual(0.2 + 1e-9));
  });
});
