import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MetricFigure, MetricKey } from '../src/specs/metrics';
import type { ListedProblem } from '../../lathe/src/checking/problems/read-model';
import type { TraceJourney } from '../../lathe/src/traceability/trace/read-model';
import { COMPLETE, LADDER, NOTHING_TO_JUDGE, statusOf } from '../src/traceability/dashboard/status';
import { needsAttention } from '../src/traceability/dashboard/attention';
import { stageTable, heatOf, STAGES } from '../src/traceability/dashboard/stages';
import { firstSentence } from '../src/traceability/dashboard/DashboardPanel';
import { stageCounts } from '../src/exploring/folder-tree/stage-counts';
import { carryOverlays, closeTopmostHref, overlaysOf, panelHref } from '../src/views/overlays';
import { addRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { openApp } from './helpers';
import { recordIndexOf } from './read-view';

// The Dashboard (LA-V157, LA-TRC-UC26): one product's health, full-window over the stage. The status ladder
// (LA-TRC-UC26-R01) is tested row by row from its own table; the figures come from the fixture's own coverage and records.

const dashboard = () => screen.findByRole('dialog', { name: 'Dashboard' });
const tile = (root: HTMLElement, key: string) => root.querySelector<HTMLElement>(`[data-metric="${key}"]`)!;

/** Six tiles, all complete unless a row of the ladder says otherwise. */
function tiles(over: Partial<Record<MetricKey, Partial<MetricFigure>>> = {}): MetricFigure[] {
  const base: Record<string, MetricFigure> = {
    errors: { key: 'errors', value: 0 },
    designed: { key: 'designed', value: 10, total: 10 },
    built: { key: 'built', value: 10, total: 10 },
    proved: { key: 'proved', value: 12, total: 12 },
    journeysProved: { key: 'journeysProved', value: 3, total: 3 },
    gaps: { key: 'gaps', value: 0 },
  };
  return LADDER.map(({ key }) => ({ ...base[key], ...over[key] }));
}

/** A journey with its steps proved or not, and its test counted or not. */
const journeyOf = (id: string, proved: boolean[], testProved: boolean, test: string | null = `${id}-T`): TraceJourney => ({
  id, product: 'DM', outcomes: [],
  steps: proved.map((p, i) => ({ id: `${id}-S${i + 1}`, path: 'main', position: i + 1, carriesOut: 'x', kind: 'use_case', actors: [], designed: true, built: true, proved: p })),
  test, testProved, proved: testProved && proved.every(Boolean),
  status: { steps: proved.length, unlinked: 0, stepsProved: proved.filter(Boolean).length, designed: proved.length, built: proved.length },
});

const problem = (check: string, severity: 'error' | 'warning', record: string | null = null): ListedProblem => ({ severity, check, record, message: `${check} message` }) as ListedProblem;

describe('LA-TRC-UC26-R01-T02 LA-V157-R05-T02 the status ladder', () => {
  const rows: [Partial<Record<MetricKey, Partial<MetricFigure>>>, string, MetricKey | null][] = [
    [{ errors: { value: 2 } }, 'Failing its own checks', 'errors'],
    [{ designed: { value: 9 } }, 'Not fully designed', 'designed'],
    [{ built: { value: 9 } }, 'Designed, not fully built', 'built'],
    [{ proved: { value: 11 } }, 'Built, not fully proved', 'proved'],
    [{ journeysProved: { value: 2 } }, 'Proved piece by piece, not yet end to end', 'journeysProved'],
    [{ gaps: { value: 4 } }, 'Proved end to end, with gaps between spec and code', 'gaps'],
    [{}, COMPLETE, null],
  ];
  it.each(rows)('%j reads "%s"', (over, text, rung) => {
    const status = statusOf(tiles(over))!;
    expect(status.text).toBe(text);
    expect(status.rung).toBe(rung);
  });

  it('reads the first rung when several are short, and names every shortfall in order, however far down', () => {
    const status = statusOf(tiles({ built: { value: 5 }, journeysProved: { value: 0 }, gaps: { value: 3 } }))!;
    expect(status.text).toBe('Designed, not fully built');
    expect(status.rung).toBe('built');
    expect(status.short.map((c) => c.text)).toEqual(['5 of 10 obligations built', '0 of 3 journeys proved', '3 gaps']);
  });

  it('claims every obligation on its own only when designed, built and proved are complete', () => {
    expect(statusOf(tiles({ journeysProved: { value: 0 }, gaps: { value: 17 } }))!.closing).toBe('Every obligation is designed, built and proved on its own.');
    expect(statusOf(tiles({ proved: { value: 1 } }))!.closing).toBe('');
    expect(statusOf(tiles())!.closing).toBe('Every obligation is designed, built and proved, every journey is proved and there are no gaps.');
  });

  it('warnings do not move it; no score or percentage is ever written', () => {
    const status = statusOf(tiles({ errors: { value: 0, detail: '11 warnings' } }))!;
    expect(status.text).toBe(COMPLETE);
    expect(JSON.stringify(status)).not.toMatch(/%|score/i);
  });

  it('no journeys at all is not proved end to end', () => {
    expect(statusOf(tiles({ journeysProved: { value: 0, total: 0 } }))!.text).toBe('Proved piece by piece, not yet end to end');
  });

  it('nothing to judge with no obligations, unless its own checks fail', () => {
    const empty = { designed: { value: 0, total: 0 }, built: { value: 0, total: 0 }, proved: { value: 0, total: 0 }, journeysProved: { value: 0, total: 0 } };
    expect(statusOf(tiles(empty))).toEqual({ text: NOTHING_TO_JUDGE, rung: null, short: [], closing: 'It has no obligations to design, build or prove yet.' });
    expect(statusOf(tiles({ ...empty, errors: { value: 1 } }))!.text).toBe('Failing its own checks');
  });

  it('is never judged from a figure not read', () => {
    expect(statusOf(tiles({ gaps: { value: undefined } }))).toBeNull();
    expect(statusOf(tiles({ errors: { value: undefined } }))).toBeNull();
  });
});

describe('the Dashboard', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it('LA-TRC-UC26-R03-T01 LA-V157-R07-T01 cells count everything folded under a stage, with gaps and tests not automated yet, and lead there', async () => {
    const data = workspace();
    const index = recordIndexOf(data, 'DM');
    const counts = stageCounts(index.folders);
    // A cell counts what is folded under the stage's entries: more than the folder tree's count of its entries.
    const shop = index.folders.domains.find((d) => d.owner === 'DM-SHOP')!;
    const domainModel = shop.stages.find((s) => s.stage === 'domain-model')!;
    const folded = (e: (typeof domainModel.folders)[number]['entries'][number]): number => 1 + e.folded.reduce((n, f) => n + folded(f), 0);
    expect(counts['DM-SHOP']['domain-model']).toBe(domainModel.folders.flatMap((f) => f.entries).reduce((n, e) => n + folded(e), 0));
    expect(counts['DM-SHOP']['domain-model']!).toBeGreaterThan(domainModel.count);
    const covered = recordIndexOf(data, 'DM');
    const table = stageTable(covered, counts, true);
    expect(table.rows.map((r) => r.owner)).toEqual([...covered.domains.map((d) => d.id), 'DM']);
    expect(table.rows.at(-1)!.title).toBe('Shared');
    const row = table.rows.find((r) => r.owner === 'DM-SHOP')!;
    const scope = covered.coverage.get('DM-SHOP')!;
    expect(row.cells.map((c) => c.label)).toEqual(STAGES.map((s) => s.label));
    expect(row.cells.find((c) => c.stage === 'test-plan')!.marks).toBeGreaterThanOrEqual(scope.tests.notAutomated);
    expect(row.marks).toBe(scope.gaps.length + scope.tests.notAutomated);
    expect(table.gaps).toBe([...covered.coverage.values()].reduce((n, s) => n + s.gaps.length, 0));
    // Nothing is claimed before it is read.
    const unread = stageTable(covered, undefined, false);
    expect(unread.rows[0].cells[0].records).toBeUndefined();
    expect(unread.rows[0].marks).toBeUndefined();
    expect(heatOf(49, 1000)).toBe(6);
    expect(heatOf(143, 1000)).toBe(24);
    expect(heatOf(900, 1000)).toBe(34);

    await openApp('/DM?panel=dashboard', { data });
    const panel = await dashboard();
    const body = within(panel);
    await waitFor(() => expect(body.getByRole('link', { name: /^Domain model, DM-SHOP: \d+ record/ })).toHaveAttribute('href', '/DM-SHOP/domain-model'));
    // The Domains by stage table names every stage for a screen reader, whatever the screen shows.
    for (const { label } of STAGES) expect(body.getByRole('columnheader', { name: label })).toBeInTheDocument();
    expect(body.getByRole('link', { name: 'DM-SHOP Shopping' })).toHaveAttribute('href', '/DM-SHOP');
  });

  it('LA-TRC-UC26-R04-T01 LA-V157-R08-T01 a journey shows one mark per step and one for its test, and leads to its page', async () => {
    const data = workspace();
    addRows(data, 'journey', { id: 'DM-JR01', title: 'Shop end to end', product_id: 'DM', trigger: 'Someone wants to buy.', result: 'Bought.' });
    addRows(data, 'journey_step', { id: 'DM-JR01-S01', title: 'Buy it', journey_id: 'DM-JR01', path: 'main', position: 1 });
    addRows(data, 'journey_test', { id: 'DM-JR01-T', title: 'Shop end to end test', journey_id: 'DM-JR01', level: 'system', state: 'not automated yet', steps: ['x'], expected_result: 'x' });
    await openApp('/DM?panel=dashboard', { data });
    const panel = await dashboard();
    const link = await waitFor(() => { const a = panel.querySelector<HTMLElement>('a.dashboard-journey[href="/DM-JR01"]'); expect(a).not.toBeNull(); return a!; });
    expect(link).toHaveAttribute('href', '/DM-JR01');
    await waitFor(() => expect(link.querySelectorAll('.dashboard-marks i')).toHaveLength(2));
    expect(link).toHaveTextContent('0 of 1 step · journey test not automated yet');
    expect(within(link).getByRole('img', { name: '0 of 1 steps proved, journey test not automated yet' })).toBeInTheDocument();
  });

  it('LA-TRC-UC26-R05-T01 LA-V157-R09-T01 Needs attention takes the first of each kind in turn, in fixed order, and leads to Checks', async () => {
    const data = workspace();
    const index = recordIndexOf(data, 'DM');
    const question = { id: 'DM-Q01', title: 'A question', owner: 'Owner', description: 'd', about: [] } as never;
    const rows = needsAttention(index, [problem('c-rule', 'error'), problem('c-rule', 'error'), problem('a-rule', 'warning')], [question], [journeyOf('DM-JR01', [true, true], false), journeyOf('DM-JR02', [true, false], false)], [...index.coverage.values()]);
    expect(rows.map((r) => [r.id, r.lead])).toEqual([['c-rule', 'Checks'], ['DM-Q01', 'Question'], ['DM-JR02', 'Journey']]);
    expect(rows[0].detail).toBe('2 errors from this check');
    expect(rows[2].to).toBe('/DM-JR02');
    await openApp('/DM?panel=dashboard', { data });
    const panel = await dashboard();
    expect(await within(panel).findByRole('link', { name: 'All of it in Checks' })).toHaveAttribute('href', expect.stringContaining('panel=checks'));
  });

  it('LA-TRC-UC26-R02-T01 LA-V157-R06-T01 LA-TRC-UC26-R01-T01 the six tiles are the key metrics, in order, and the Status wears the heavier border', async () => {
    const { requests } = await openApp('/DM?panel=dashboard', { data: workspace() });
    const panel = await dashboard();
    await waitFor(() => expect(tile(panel, 'gaps')).not.toHaveTextContent('…'));
    await waitFor(() => expect(panel.querySelector('.dashboard-body[data-reading]')).toBeNull());
    expect([...panel.querySelectorAll('[data-metric]')].map((m) => m.getAttribute('data-metric'))).toEqual(['errors', 'designed', 'built', 'proved', 'journeysProved', 'gaps']);
    expect(within(tile(panel, 'gaps')).getByRole('link')).toHaveAttribute('href', expect.stringContaining('panel=checks'));
    expect(within(tile(panel, 'gaps')).getByRole('link').getAttribute('href')).toContain('#gaps');
    expect(within(tile(panel, 'journeysProved')).getByRole('link')).toHaveAttribute('href', '/DM?stage=trace');
    expect(within(tile(panel, 'designed')).getByRole('link')).toHaveAttribute('href', '/DM#domains');
    expect(panel.querySelectorAll('.metric.is-rung')).toHaveLength(1);
    expect(requests.some((u) => u.includes('list-journey-proofs') && u.includes('DM'))).toBe(true);
    expect(panel.textContent).not.toMatch(/\d+%/);
  });

  it('LA-V157-R05-T01 the Status line names the shortfalls; a product with no obligations says Nothing to judge yet', async () => {
    const data = workspace();
    await openApp('/DM?panel=dashboard', { data });
    const panel = await dashboard();
    const status = panel.querySelector<HTMLElement>('.dashboard-status')!;
    await waitFor(() => expect(status).not.toHaveTextContent('Reading'));
    expect(within(status).getAllByRole('link').length).toBeGreaterThan(0);
    const bare = workspace();
    bare.coverage = bare.coverage.filter((c) => c.product !== 'NF').concat([{ product: 'NF', domain: null, obligations: [], tests: { automated: 0, manual: 0, not_automated: 0 }, proved_by: {}, pattern_rules: [], debt: [], gaps: [], chains: [] } as never]);
    bare.problems = [];
    await openApp('/NF?panel=dashboard', { data: bare });
    const empty = await dashboard();
    await waitFor(() => expect(empty.querySelector('.dashboard-status')).toHaveTextContent('Nothing to judge yet'), { timeout: 4000 });
  });

  it('LA-V157-R04-T01 the header shows the name, the first sentence, the Outcomes and the counts leading to the Product page', async () => {
    expect(firstSentence('It does `one` thing. And **another**.')).toBe('It does one thing.');
    expect(firstSentence('One line, no period')).toBe('One line, no period');
    const data = setRow(workspace(), 'product', 'DM', { description: 'A shop for testing. It has more words.' });
    addRows(data, 'business_outcome', { id: 'DM-BO01', title: 'More baskets', product_id: 'DM', statement: 's', measure: 'm', target: 't' });
    await openApp('/DM?panel=dashboard', { data });
    const panel = await dashboard();
    const body = within(panel);
    expect(await body.findByText('A shop for testing.')).toBeInTheDocument();
    expect(body.getByRole('link', { name: 'More baskets' })).toHaveAttribute('href', '/DM-BO01');
    const facts = panel.querySelector('.dashboard-facts')!;
    expect(within(facts as HTMLElement).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/DM#domains', '/DM#discovery', '/DM#roles', '/DM#interfaces']);
  });

  it('LA-TRC-UC26-R07-T01 LA-V157-R01-T01 opens and closes with its shortcut and Escape, focus going back, and the app never opens on it', async () => {
    const dashboardShut = () => expect(screen.queryByRole('dialog', { name: 'Dashboard' })).toBeNull();
    await openApp('/DM');
    dashboardShut();
    const press = () => { fireEvent.keyDown(document.activeElement ?? window, { key: 'd', code: 'KeyD', ...(navigator.platform.toLowerCase().includes('mac') ? { metaKey: true } : { ctrlKey: true }), shiftKey: true, bubbles: true }); };
    const opener = screen.getByRole('button', { name: /Go to/ });
    opener.focus();
    press();
    await waitFor(() => expect(window.location.search).toContain('panel=dashboard'));
    expect(await dashboard()).toBeInTheDocument();
    expect(overlaysOf(window.location.search)).toMatchObject({ panel: 'dashboard', top: 'panel' });
    // Modal: focus is in it, and nothing behind it can be reached.
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Dashboard' }).contains(document.activeElement)).toBe(true));
    expect(document.querySelector('.app > .menu')?.hasAttribute('inert')).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(dashboardShut);
    expect(window.location.search).not.toContain('panel=');
    expect(document.querySelector('.app > .menu')?.hasAttribute('inert')).toBe(false);
    // Off a mac key: still its address.
    expect(closeTopmostHref('?panel=dashboard')).toBe(panelHref(null));
  });

  it('LA-V157-R03-T01 shows one product only, and none at the products picker', async () => {
    await openApp('/?panel=dashboard');
    expect(screen.queryByRole('dialog', { name: 'Dashboard' })).toBeNull();
    await openApp('/NF?panel=dashboard', { data: workspace() });
    const panel = await dashboard();
    expect(await within(panel).findByRole('heading', { name: /NF/ })).toBeInTheDocument();
    await waitFor(() => expect(panel.querySelector('[data-owner="NF-NOTE"]')).not.toBeNull());
    expect(panel.querySelector('[data-owner^="DM"]')).toBeNull();
  });

  it('LA-TRC-UC26-R06-T01 LA-V157-R02-T01 following an element closes the Dashboard and goes there, Back returns, and Checks swaps', async () => {
    const user = userEvent.setup();
    await openApp('/DM?panel=dashboard', { data: workspace() });
    const panel = await dashboard();
    await user.click(await within(panel).findByRole('link', { name: 'DM-SHOP Shopping' }));
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP'));
    expect(window.location.search).not.toContain('panel');
    expect(screen.queryByRole('dialog', { name: 'Dashboard' })).toBeNull();
    act(() => window.history.back());
    await waitFor(() => expect(window.location.search).toContain('panel=dashboard'));
    const again = await dashboard();
    await user.click(await within(again).findByRole('link', { name: 'All of it in Checks' }));
    await waitFor(() => expect(window.location.search).toContain('panel=checks'));
    expect(await screen.findByRole('region', { name: 'Checks' })).toBeInTheDocument();
    expect(carryOverlays('/DM-SHOP', new URLSearchParams('?panel=dashboard'))).toBe('/DM-SHOP');
  });

  it('LA-V157-R10-T01 a figure not read yet is never shown as zero, and tiles keep their place', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => { release = r; });
    await openApp('/DM?panel=dashboard', { data: workspace(), hold: (u) => (u.includes('list-journey-proofs') ? held : undefined) });
    const panel = await dashboard();
    expect(tile(panel, 'journeysProved')).toHaveTextContent('…');
    expect(tile(panel, 'journeysProved').textContent).not.toMatch(/\b0\b/);
    expect(panel.querySelector('.dashboard-status')).toHaveTextContent('Reading');
    release();
  });

  it('LA-V157-R12-T01 Checks lists gaps and tests not automated yet, each at its address', async () => {
    const data = workspace();
    await openApp('/DM?panel=checks#gaps', { data });
    const panel = await screen.findByRole('region', { name: 'Checks' });
    await waitFor(() => expect(panel.querySelector('#gaps')).not.toBeNull());
    const gaps = panel.querySelector<HTMLElement>('#gaps')!;
    expect(within(gaps).getByRole('heading', { name: /Gaps/ })).toBeInTheDocument();
    const notAutomated = panel.querySelector<HTMLElement>('#not-automated')!;
    expect(within(notAutomated).getByRole('heading', { name: /Not automated yet/ })).toBeInTheDocument();
    expect(within(notAutomated).getAllByRole('link').length).toBeGreaterThan(0);
  });
});
