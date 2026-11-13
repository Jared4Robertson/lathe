import type { ServedData } from './read-view';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Coverage } from '../../lathe/src/types';
import type { ProductProblems } from '../../lathe/src/checking/problems/read-model';
import { LIST_PROBLEMS } from '../../lathe/src/checking/problems/queries';
import { answerQuery } from '../../lathe/src/platform/commands/run';
import { METRICS } from '../src/specs/metrics';
import { addRows } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { checksPanel, findSection, main, openApp } from './helpers';
import { readViewOf, recordIndexOf } from './read-view';

// Key metrics (LA-V51-R03, LA-V91-R55, LA-PAT-APP-UX-R25): every number is worked out here from the fixture's own
// coverage, problems and rows, never written down, so a change to the fixture moves the expectation with it.

/** The demo shop with two business outcomes, one of them served by the Basket aggregate. */
function withOutcomes(): ServedData {
  const w = workspace();
  addRows(
    w,
    'business_outcome',
    { id: 'DM-BO01', title: 'More baskets checked out', product_id: 'DM', statement: 'More baskets are checked out.', measure: 'Baskets checked out each week.', target: 'Two in three within a quarter.' },
    { id: 'DM-BO02', title: 'Fewer refunds', product_id: 'DM', statement: 'Fewer refunds.', measure: 'Refunds per hundred orders.', target: 'Under two within a year.' },
  );
  addRows(w, 'serves', { source_id: 'DM-SHOP-A1', target_id: 'DM-BO01' });
  return w;
}

const sum = (values: number[]) => values.reduce((a, v) => a + v, 0);
const rows = (data: ServedData, table: string) => data.sources.flatMap((s) => s.tables[table] ?? []);

/** What each tile should read, from the scopes' coverage: "3 of 7 obligations". */
function coverageTexts(scopes: Coverage[]): Record<string, string> {
  const groups = scopes.flatMap((s) => s.obligations);
  const asked = groups.filter((g) => !g.proof_only);
  const all = sum(groups.map((g) => g.total));
  const tests = (key: 'automated' | 'manual' | 'not_automated') => sum(scopes.map((s) => s.tests[key]));
  const testsTotal = tests('automated') + tests('manual') + tests('not_automated');
  return {
    designed: `${sum(asked.map((g) => g.designed))} of ${sum(asked.map((g) => g.total))} obligations`,
    built: `${sum(asked.map((g) => g.built))} of ${sum(asked.map((g) => g.total))} obligations`,
    proved: `${sum(groups.map((g) => g.proved))} of ${all} obligations`,
    testsAutomated: `${tests('automated')} of ${testsTotal} tests ${tests('manual')} manual, ${tests('not_automated')} not automated yet`,
  };
}

/** The product's problems as the check query (list-problems) answers them. */
const problemsOf = (data: ServedData, product: string) => answerQuery(readViewOf(data), LIST_PROBLEMS, { product_id: product }) as ProductProblems;

/** Each tile's label and what it reads, by metric. */
function tiles(section: HTMLElement): Record<string, { label: string; text: string; title: string }> {
  return Object.fromEntries([...section.querySelectorAll<HTMLElement>('.metric')].map((m) => [
    m.dataset.metric!,
    { label: m.querySelector('dt')!.textContent!, text: m.querySelector('dd')!.textContent!, title: m.title },
  ]));
}

const metricsOnPage = () => findSection('Key metrics');

describe('key metrics', () => {
  it("LA-V51-R03-T01 The product page leads with its key metrics, each worked out from the product's reads", async () => {
    const data = withOutcomes();
    await openApp('/DM', { data });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const section = await metricsOnPage();
    // It leads: the first section of the page.
    expect(main().querySelector('.spec-section')).toBe(section);
    const problems = problemsOf(data, 'DM');
    await waitFor(() => expect(tiles(section).errors.text).toBe(String(problems.errors)));
    const read = tiles(section);
    const outcomes = rows(data, 'business_outcome').filter((o) => o.product_id === 'DM');
    const served = outcomes.filter((o) => rows(data, 'serves').some((s) => s.target_id === o.id));
    const coverage = coverageTexts(data.coverage.filter((c) => c.product === 'DM'));
    const index = recordIndexOf(data);
    const questions = [...index.byId.values()].filter((r) => r.kind === 'question' && r.product === 'DM').length;
    expect(Object.fromEntries(Object.entries(read).map(([k, v]) => [k, v.text]))).toEqual({
      outcomesServed: `${served.length} of ${outcomes.length} outcomes`,
      ...coverage,
      errors: String(problems.errors),
      warnings: String(problems.warnings),
      openQuestions: String(questions),
    });
    expect(served.length).toBeGreaterThan(0);
    expect(served.length).toBeLessThan(outcomes.length);
  });

  it('LA-V51-R03-T02 A product with nothing to count shows zeros, not an empty row', async () => {
    const data = workspace();
    await openApp('/NF', { data });
    await screen.findByRole('heading', { level: 1, name: 'Notebook' });
    const section = await metricsOnPage();
    await waitFor(() => expect(tiles(section).errors.text).toBe(String(problemsOf(data, 'NF').errors)));
    const read = tiles(section);
    expect(read.outcomesServed.text).toBe('0 of 0 outcomes');
    expect(read.designed.text).toBe(coverageTexts(data.coverage.filter((c) => c.product === 'NF')).designed);
  });

  it("LA-V51-R03-T03 Errors and warnings lead to the Checks panel, which counts them the same", async () => {
    const data = workspace();
    await openApp('/DM', { data });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const section = await metricsOnPage();
    const errors = await within(section).findByRole('link', { name: /^Errors: \d+$/ });
    const warnings = within(section).getByRole('link', { name: /^Warnings: \d+$/ });
    const problems = problemsOf(data, 'DM');
    expect(errors).toHaveAccessibleName(`Errors: ${problems.errors}`);
    expect(warnings).toHaveAccessibleName(`Warnings: ${problems.warnings}`);
    // An error is worth a look now, and a warning worth a look.
    expect(errors.closest('.metric')?.classList.contains('is-attention')).toBe(problems.errors > 0);
    expect(warnings.closest('.metric')?.classList.contains('is-caution')).toBe(problems.warnings > 0);
    await userEvent.setup().click(errors);
    expect(checksPanel()).toHaveTextContent(`${problems.errors} error${problems.errors === 1 ? '' : 's'} · ${problems.warnings} warning${problems.warnings === 1 ? '' : 's'}`);
  });

  it("LA-V91-R55-T01 The domain page leads with the domain's key metrics, its own figures only", async () => {
    const data = workspace();
    await openApp('/DM-SHOP', { data });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const section = await metricsOnPage();
    const index = recordIndexOf(data);
    const inDomain = (record: string | null) => record !== null && index.byId.get(record)?.domain === 'DM-SHOP';
    const problems = problemsOf(data, 'DM');
    const listed = [...problems.own, ...problems.workspace].flatMap((g) => g.problems).filter((p) => inDomain(p.record));
    const errors = listed.filter((p) => p.severity === 'error').length;
    await waitFor(() => expect(tiles(section).errors.text).toBe(String(errors)));
    const questions = [...index.byId.values()].filter((r) => r.kind === 'question' && r.domain === 'DM-SHOP').length;
    expect(Object.fromEntries(Object.entries(tiles(section)).map(([k, v]) => [k, v.text]))).toEqual({
      ...coverageTexts(data.coverage.filter((c) => c.domain === 'DM-SHOP')),
      errors: String(errors),
      warnings: String(listed.length - errors),
      openQuestions: String(questions),
    });
    // A domain has no outcomes of its own: its product's page counts them.
    expect(tiles(section).outcomesServed).toBeUndefined();
  });

  it('LA-PAT-APP-UX-R25-T01 LA-PAT-APP-UX-R25-T02 Key metrics read the same on every page: one label, unit and meaning per metric', async () => {
    const seen: Record<string, { label: string; title: string }>[] = [];
    for (const [path, title] of [['/DM', 'Demo shop'], ['/DM-SHOP', 'Shopping']] as const) {
      await openApp(path, { data: withOutcomes() });
      await screen.findByRole('heading', { level: 1, name: title });
      const section = await metricsOnPage();
      await within(section).findByRole('link', { name: /^Errors: \d+$/ });
      const read = tiles(section);
      for (const [key, tile] of Object.entries(read)) {
        const metric = METRICS[key as keyof typeof METRICS];
        expect(tile.label).toBe(metric.label);
        expect(tile.title).toBe(metric.meaning);
        if (metric.unit) expect(tile.text).toMatch(new RegExp(`^\\d+ of \\d+ ${metric.unit}`));
        else expect(tile.text).toMatch(/^\d+$/);
      }
      seen.push(read);
    }
    // The metrics both pages show read the same.
    const [product, domain] = seen;
    for (const key of Object.keys(domain)) expect([domain[key].label, domain[key].title]).toEqual([product[key].label, product[key].title]);
  });
});
