import '../graph/setup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addRows } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import type { TraceHost, TraceScene } from '../../src/trace/TraceCanvas';
import { openApp } from '../helpers';

// The Trace stage (LA-V98) in the app: one row per use case on the canvas, from its outcomes to its acceptance tests,
// read from the Trace read (list-trace-rows); its toolbar's Expand row and Expand all, the path a selection lights, its
// camera, its accessible layer, and on a phone one use case at a time. It works on every focus (LA-PAT-APP-UX-R17) and
// is ordered once (LA-PAT-APP-UX-R19).

/** The model product with an outcome its capability serves, and a second use case of no flow. */
const withOutcome = () => {
  const data = modelWorkspace();
  addRows(data, 'business_outcome', { id: 'P-BO01', title: 'More things lent', product_id: 'P', statement: 'Members borrow more.', measure: 'Loans a month', target: 'Up a tenth' });
  addRows(data, 'serves', { source_id: 'P-D-CAP01', target_id: 'P-BO01' });
  addRows(data, 'use_case', { id: 'P-D-UC02', title: 'Return a thing', capability_id: 'P-D-CAP01', goal: 'A member brings a thing back.' });
  return data;
};
const traceStage = () => screen.getByRole('region', { name: 'Trace stage' });
const stageButton = (name: string) => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });
const counts = () => document.querySelector('.header-strip-counts');
/** Opens a page on the Trace stage. */
const openTrace = (path: string, data = withOutcome()) => openApp(path, { data });
/** The canvas, once it is drawn. */
const canvasHost = async () => {
  await waitFor(() => expect(traceStage().querySelector('.trace-flow[data-ready]')).not.toBeNull());
  return traceStage().querySelector<TraceHost>('.trace-flow')!;
};
const drawn = async (whole = true): Promise<TraceScene> => (await canvasHost()).traceScene!(whole);
const box = (scene: TraceScene, key: string) => scene.boxes.find((b) => b.key === key);
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

describe('the Trace stage', () => {
  it('LA-V98-R15-T01 The Trace stage draws one row per use case across the five columns, each use case once, with a line from its outcome, read from list-trace-rows', async () => {
    const { requests } = await openTrace('/P-D-UC01?stage=trace');
    const scene = await drawn();
    expect(requests).toContain('GET /api/trace/list-trace-rows?product_id=P');
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
    await openTrace('/P-D-UC01?stage=trace');
    const scene = await drawn();
    expect(box(scene, 'P-D-UC01|design')).toMatchObject({ role: 'status', title: '1 interface · all designed', dashed: false, opens: true, open: false });
    expect(box(scene, 'P-D-UC01|suite')).toMatchObject({ role: 'gap', title: '3 tests · 1 not proved', dashed: true });
    expect(box(scene, 'P-D-UC02|design')).toMatchObject({ role: 'gap', title: 'No flow', dashed: true });
  });

  it('LA-V98-R17-T02 Boxes open by their toggle, Expand row opens the focus\'s row and Expand all a stage in every row; the place keeps what is open', async () => {
    await openTrace('/P-D-UC01?stage=trace');
    await canvasHost();
    // A box's toggle opens it: its children show under it.
    await click('P-D-UC01|design', true);
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|design/P-D-UC01-FL')).toBeDefined());
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
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|technical/step:P-D-UC01-FL-S01/P-D-CMD01-H')).toBeDefined());
    expect(box(await drawn(), 'P-D-UC01|technical/step:P-D-UC01-FL-S02/P-INT01-AD')).toBeDefined();
    // The place keeps what is open: to the Graph stage and back to the Trace, it is as it was.
    fireEvent.click(stageButton('Graph'));
    await waitFor(() => expect(window.location.search).toBe('?stage=graph'));
    fireEvent.click(stageButton('Trace'));
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|use-case/P-D-UC01-R01')).toBeDefined());
  });

  it('LA-V98-R22-T02 The outcomes a focused row serves are drawn beside it, and follow the focus as it walks to another row', async () => {
    await openTrace('/P-D-UC02?stage=trace');
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
    await openTrace('/P-D-UC01?stage=trace');
    await canvasHost();
    if (toolbarButton('Expand row').getAttribute('aria-pressed') !== 'true') fireEvent.click(toolbarButton('Expand row'));
    await click('P-D-UC01|design/P-D-UC01-FL', true);
    // The flow opens to a box per interface that offers its use case; the web app's opens to its version's steps.
    await click('P-D-UC01|design/P-D-UC01-FL/P-IF01', true);
    await click('P-D-UC01|design/P-D-UC01-FL/P-IF01/P-D-UC01-FL-S01');
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01-FL-S01'));
    // The step's chain in Technical flow, its requirement and its test lit, the line across each column, the rest faded.
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|technical/step:P-D-UC01-FL-S01/P-D-CMD01-H')).toBeDefined());
    await waitFor(async () => {
      const scene = await drawn();
      expect(box(scene, 'P-D-UC01|design/P-D-UC01-FL/P-IF01/P-D-UC01-FL-S01')).toMatchObject({ focus: true, lit: true });
      expect(box(scene, 'P-D-UC01|use-case/P-D-UC01-R01')!.lit).toBe(true);
      expect(box(scene, 'P-D-UC01|use-case/P-D-UC01-R02')!.lit).toBe(false);
      expect(box(scene, 'P-D-UC01|suite/P-D-UC01-R01-T01')!.lit).toBe(true);
      expect(box(scene, 'P-D-UC01|suite/P-D-UC01-R01-T01')!.strength).toBe(1);
      expect(box(scene, 'P-D-UC02|use-case')!.strength).toBeLessThan(1);
      expect(scene.lines.filter((l) => l.kind === 'path').map((l) => `${l.from}>${l.to}`)).toEqual(expect.arrayContaining([
        'P-D-UC01|use-case/P-D-UC01-R01>P-D-UC01|design/P-D-UC01-FL/P-IF01/P-D-UC01-FL-S01',
        'P-D-UC01|design/P-D-UC01-FL/P-IF01/P-D-UC01-FL-S01>P-D-UC01|technical/step:P-D-UC01-FL-S01/P-UI01',
      ]));
    });
    // The wiki card follows the selection.
    await screen.findByRole('heading', { level: 1, name: 'Librarian lends the thing' });
  });

  it('LA-V98-R21-T01 Under the canvas, the list is its accessible layer; on a phone it is the view, one use case at a time, each stage opening', async () => {
    await openTrace('/P-D-UC01?stage=trace');
    await canvasHost();
    expect(traceStage().querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
    const access = traceStage().querySelector<HTMLElement>('.trace-access')!;
    expect(within(access).getByRole('combobox', { name: 'Use case' })).toHaveValue('P-D-UC01');
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    try {
      await openTrace('/P-D-UC01?stage=trace');
      const list = await within(traceStage()).findByRole('region', { name: 'Trace rows' });
      expect(traceStage().querySelector('.trace-flow')).toBeNull();
      expect(within(list).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Outcome', 'Use case', 'Design flow', 'Technical flow', 'Acceptance test suite']);
      const design = within(list).getByRole('region', { name: 'Design flow' });
      // Open (the place may keep it open from before).
      const toggle = within(design).getByRole('button', { name: /1 interface · all designed/ });
      if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
      expect(within(design).getByRole('link', { name: /^Flow · P-D-UC01-FL(?!-)/ })).toBeInTheDocument();
      // Another use case.
      fireEvent.change(within(list).getByRole('combobox', { name: 'Use case' }), { target: { value: 'P-D-UC02' } });
      expect(within(within(list).getByRole('region', { name: 'Design flow' })).getByText('No flow', { selector: '.trace-col-title' })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('LA-V96-R36-T03 With Highlight changes on, the Trace stage gives a new record its pill, rolls its row\'s changes up on its use case and its column\'s in its header', async () => {
    const committed = modelWorkspace().sources[0].tables;
    const baseline = (since: string) => ({ state: 'ok' as const, commit: 'a'.repeat(40), short: 'aaaaaaa', subject: since, date: '2026-10-27T10:00:00Z', base: null, tables: committed });
    await openApp('/P?stage=trace', { data: withOutcome(), baseline });
    const tools = await screen.findByRole('group', { name: 'Changes' });
    await waitFor(() => expect(tools.textContent).toMatch(/Changes\s*\d/), { timeout: 4000 });
    fireEvent.click(within(tools).getByRole('button', { name: 'Highlight changes' }));
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC02|use-case')?.pill).toBe('added'));
    const scene = await drawn();
    expect(box(scene, 'outcome/P-BO01')!.pill).toBe('added');
    expect(scene.columns[1].rollup).toBe('1 new');
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|design')!.strength).toBeLessThanOrEqual(0.2 + 1e-9));
  });
  it('LA-V98-R01-T01 Trace works on every focus: Ctrl+3 or the switch shows it, never disabled, on a use case, a requirement and a record no row shows', async () => {
    // On a use case: Ctrl+3 switches to the Trace stage, its row drawn and focused; Alt+E to the ERD (off a Mac).
    await openApp('/P-D-UC01?stage=erd', { data: withOutcome() });
    await screen.findByRole('heading', { level: 1, name: /lend/i });
    expect(stageButton('Trace')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(document.body, { key: '3', code: 'Digit3', ctrlKey: true });
    expect(window.location.search).toBe('?stage=trace');
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|use-case')).toMatchObject({ focus: true }));
    fireEvent.keyDown(document.body, { key: 'e', code: 'KeyE', altKey: true });
    expect(window.location.search).toBe('?stage=erd');

    // A requirement and a term have a Trace stage too: the switch never dims or hides it, and the rows are drawn.
    for (const [path, name] of [['/P-D-UC01-R01', /./], ['/P-D-TM01', /./]] as const) {
      await openTrace(`${path}?stage=trace`);
      await screen.findByRole('heading', { level: 1, name });
      expect(stageButton('Trace')).toHaveAttribute('aria-pressed', 'true');
      expect(stageButton('Trace')).not.toHaveAttribute('aria-disabled');
      expect(within(screen.getByRole('group', { name: 'Stage' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Graph', 'ERD', 'Trace']);
      await waitFor(async () => expect((await drawn()).rows).toEqual(['P-D-UC01', 'P-D-UC02']));
    }
  });

  it('LA-PAT-APP-UX-R17-T03 On the Trace stage a record a row shows stands on its box, and any other record shows the product\'s rows', async () => {
    // A requirement and a flow step: their boxes focused in their row (the row opened to them), their paths lit.
    for (const [path, key] of [['/P-D-UC01-R01', 'P-D-UC01|use-case/P-D-UC01-R01'], ['/P-D-UC01-FL-S01', 'P-D-UC01|design/P-D-UC01-FL/P-IF01/P-D-UC01-FL-S01']] as const) {
      await openTrace(`${path}?stage=trace`);
      await canvasHost();
      if (toolbarButton('Expand row').getAttribute('aria-pressed') !== 'true') fireEvent.click(toolbarButton('Expand row'));
      if (path.includes('-FL-')) {
        for (const opens of ['P-D-UC01|design/P-D-UC01-FL', 'P-D-UC01|design/P-D-UC01-FL/P-IF01']) {
          await waitFor(async () => expect(box(await drawn(), opens)).toBeDefined());
          if (!box(await drawn(), opens)!.open) await click(opens, true);
        }
      }
      await waitFor(async () => expect(box(await drawn(), key)).toMatchObject({ focus: true, lit: true }));
      expect(box(await drawn(), 'P-D-UC02|use-case')!.strength).toBeLessThan(1);
    }
    // An entity and a term: the product's rows, nothing focused, the Trace button enabled.
    for (const path of ['/P-D-EN03', '/P-D-TM01']) {
      await openTrace(`${path}?stage=trace`);
      await waitFor(async () => expect((await drawn()).rows).toEqual(['P-D-UC01', 'P-D-UC02']));
      expect((await drawn()).boxes.filter((b) => b.focus)).toEqual([]);
      expect(stageButton('Trace')).not.toHaveAttribute('aria-disabled');
    }
  });

  it('LA-PAT-APP-UX-R19-T03 The Trace stage is ordered once: focusing two rows moves only the camera and the fade, never a row', async () => {
    await openApp('/P-D-UC01', { data: withOutcome() });
    await screen.findByRole('heading', { level: 1, name: /lend/i });
    fireEvent.keyDown(document.body, { key: '3', code: 'Digit3', ctrlKey: true });
    await canvasHost();
    // The use case opened to its requirements (the place may keep it open from before).
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|use-case')).toBeDefined());
    if (!box(await drawn(), 'P-D-UC01|use-case')!.open) await click('P-D-UC01|use-case', true);
    await waitFor(async () => expect(box(await drawn(), 'P-D-UC01|use-case/P-D-UC01-R01')).toBeDefined());
    /** Every box but the outcomes, in the map's units: its place from the page and the camera. */
    const places = async () => {
      const { camera: v, canvas: c, boxes } = await drawn(true);
      return boxes.filter((b) => b.column > 0).map((b) => [b.key, (b.rect.left - c.left - v.x) / v.zoom, (b.rect.top - c.top - v.y) / v.zoom, b.rect.width / v.zoom, b.rect.height / v.zoom].map((n) => (typeof n === 'number' ? Math.round(n) : n)));
    };
    // Once the opened row has glided to its place: two reads apart give the same places.
    const before = await waitFor(async () => {
      const was = await places();
      await new Promise((r) => setTimeout(r, 100));
      expect(await places()).toEqual(was);
      return was;
    }, { timeout: 3000 });
    const camera = (await drawn()).camera;
    await click('P-D-UC02|use-case');
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC02'));
    await waitFor(async () => expect(box(await drawn(true), 'P-D-UC01|use-case')!.strength).toBeLessThan(1));
    expect(await places()).toEqual(before);
    await click('P-D-UC01|use-case/P-D-UC01-R01');
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01-R01'));
    await waitFor(async () => expect((await drawn()).camera).not.toEqual(camera));
    expect(await places()).toEqual(before);
  });

  it('LA-V98-R11-T01 Scroll pans, Cmd/Ctrl+scroll zooms and a drag pans the trace\'s camera, and . frames the focus again with a glide, as on the graph', async () => {
    await openTrace('/P-D-UC01?stage=trace');
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

  it('LA-V98-R06-T03 Only what is in view is drawn: fitting a large product draws its rows as bars, at most 260 boxes', async () => {
    const data = withOutcome();
    addRows(data, 'uc_requirement', ...Array.from({ length: 400 }, (_, n) => ({ id: `P-D-UC01-R${String(n + 10).padStart(3, '0')}`, title: `Rule ${n + 10}`, use_case_id: 'P-D-UC01', statement: `Rule ${n + 10} MUST hold.` })));
    await openTrace('/P?stage=trace', data);
    await canvasHost();
    // Every row's stages open: the use case's 400 requirements among them.
    const every = within(traceStage()).getByRole('group', { name: 'Expand all' });
    for (const stage of ['Use case', 'Design', 'Technical', 'Suite']) {
      const button = within(every).getByRole('button', { name: stage });
      if (button.getAttribute('aria-pressed') !== 'true') fireEvent.click(button);
    }
    await waitFor(async () => expect((await drawn(true)).boxes.length).toBeGreaterThan(400));
    fireEvent.click(within(traceStage()).getByRole('button', { name: 'Fit the whole map' }));
    await waitFor(async () => {
      const now = await drawn(false);
      expect(now.bars).toBeGreaterThan(0);
      expect(now.boxes.length).toBeLessThanOrEqual(260);
    });
  });
});
