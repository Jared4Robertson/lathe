import { expect, test } from '@playwright/test';
import { openPage } from './measure';
import { rowsOf, served, testsText } from './flows';
import { PRODUCT } from './scenarios';

// Traceability's flows that the Reader walks in the app, each on its main path, over the suite's copy
// of this repo's data: the product's and the domains' coverage, a trace in the graph, every
// obligation kind and test state, the patterns a domain follows, tests by state, and what designs,
// builds and proves a record. Each page is checked against the coverage the engine worked out
// (GET /api/spec). The flows run from the command line are in lathe/test/flows/traceability.test.ts.

/** A domain with UC requirements, their flows, tests and gaps. */
const TRC = 'LA-TRC';
/** A domain that follows patterns. */
const EXP = 'LA-EXP';
/** A UC requirement with a flow step that fulfills it, in a view, and a test. */
const REQUIREMENT = 'LA-TRC-UC10-R03';
const WIKI = '.pane-wiki';

test.describe('Traceability flows', () => {
  test('LA-TRC-UC09-FL01-T see each domain\'s coverage and the product\'s summary', async ({ page }) => {
    const spec = await served(page);
    await openPage(page, PRODUCT);
    const wiki = page.locator(WIKI);
    // S01: each domain card's coverage bars, as coverage counts them.
    const domains = rowsOf(spec, 'domain').filter((d) => d.product_id === 'LA');
    for (const d of domains) {
      const card = wiki.locator('article.domain-card').filter({ has: page.getByRole('link', { name: `${d.id} ${d.title}` }) });
      const c = spec.coverage.find((x) => x.domain === d.id)!;
      for (const o of c.obligations.filter((x) => x.total > 0 && !x.proof_only)) {
        await expect(card.locator(`.coverage-group[data-kind="${o.kind}"]`).getByRole('img', { name: `designed: ${o.designed} of ${o.total}` })).toBeVisible();
        await expect(card.locator(`.coverage-group[data-kind="${o.kind}"]`).getByRole('img', { name: `proved: ${o.proved} of ${o.total}` })).toBeAttached();
      }
    }
    // S02: the product's Summary: coverage, tests by state, open questions, errors and warnings.
    const summary = wiki.locator('dl.summary-list');
    const sum = (key: 'automated' | 'manual' | 'not_automated') => spec.coverage.filter((c) => c.product === 'LA').reduce((n, c) => n + c.tests[key], 0);
    await expect(summary.locator('div', { has: page.locator('dt', { hasText: /^Tests$/ }) }).locator('dd')).toHaveText(testsText({ automated: sum('automated'), manual: sum('manual'), not_automated: sum('not_automated') }));
    const errors = spec.problems.filter((p) => p.record && p.severity === 'error').length;
    await expect(summary.locator('div', { has: page.locator('dt', { hasText: /^Errors$/ }) }).locator('dd')).toHaveText(String(errors));
    for (const label of ['Designed', 'Built', 'Proved', 'Open questions', 'Warnings']) await expect(summary.locator('dt', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
    // S03: the product's open questions and problems.
    const questions = rowsOf(spec, 'question').length;
    await expect(wiki.getByRole('heading', { name: `Open questions ${questions}`, level: 2 })).toBeVisible();
    await expect(wiki.getByRole('heading', { name: /^Problems in this product \d+$/, level: 2 })).toBeVisible();
    await expect(wiki.getByRole('list', { name: 'Problems' }).getByRole('listitem').first()).toBeVisible();
    // S04: a domain card opens its domain page.
    await wiki.getByRole('link', { name: 'LA-TRC Traceability' }).click();
    await page.waitForURL((u) => u.pathname === `/${TRC}`);
    await expect(page.locator(`${WIKI} .pane-title h1`)).toHaveText('Traceability');
  });

  test('LA-TRC-UC10-FL01-T trace an obligation in the graph', async ({ page }) => {
    const spec = await served(page);
    // The chain coverage traces, and what it is for: the steps that fulfill it, their flows, what they invoke and where they
    // happen, the handlers of what they invoke, and the tests under it.
    const steps = rowsOf(spec, 'fulfills').filter((l) => l.target_id === REQUIREMENT).map((l) => String(l.source_id));
    const flows = rowsOf(spec, 'flow_step').filter((s) => steps.includes(String(s.id))).map((s) => String(s.flow_id));
    const operations = rowsOf(spec, 'invokes').filter((l) => steps.includes(String(l.source_id))).map((l) => String(l.target_id));
    const views = rowsOf(spec, 'happens_in').filter((l) => steps.includes(String(l.source_id))).map((l) => String(l.target_id));
    const handlers = [...rowsOf(spec, 'command_handler'), ...rowsOf(spec, 'query_handler')].filter((h) => operations.includes(String(h.command_id ?? h.query_id))).map((h) => String(h.id));
    const tests = rowsOf(spec, 'use_case_test').filter((t) => t.uc_requirement_id === REQUIREMENT).map((t) => String(t.id));
    // Why it is there: its use case, the use case's capability and the business outcomes that capability serves.
    const useCase = String(rowsOf(spec, 'uc_requirement').find((r) => r.id === REQUIREMENT)!.use_case_id);
    const capability = String(rowsOf(spec, 'use_case').find((u) => u.id === useCase)!.capability_id);
    const outcomes = rowsOf(spec, 'serves').filter((l) => l.source_id === capability).map((l) => String(l.target_id));
    expect(steps.length && tests.length && outcomes.length).toBeTruthy();
    // S01: the Reader focuses the obligation in the graph.
    await openPage(page, `/${REQUIREMENT}?view=graph`, '.pane-graph .graph-flow .graph-box');
    const boxes = () => page.locator('.pane-graph .graph-flow .graph-box').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')!).sort());
    // S02: trace mode shows its chain alone, and the side bar lists it.
    await page.getByRole('checkbox', { name: 'Trace mode' }).check();
    await page.locator('.pane-graph .graph-flow[data-layout="trace"] .graph-box').first().waitFor({ state: 'attached' });
    await expect.poll(boxes).toEqual([...new Set([...outcomes, capability, useCase, REQUIREMENT, ...flows, ...steps, ...operations, ...handlers, ...views, ...tests])].sort());
    const chain = page.getByRole('complementary', { name: 'Side bar' }).getByRole('region', { name: /^Traceability chain \d+$/ });
    for (const id of [...steps, ...tests]) await expect(chain.getByRole('link', { name: new RegExp(`^${id} `) })).toBeVisible();
  });

  test('LA-TRC-UC11-FL01-T see every obligation kind and test state', async ({ page }) => {
    const spec = await served(page);
    const coverage = spec.coverage.find((c) => c.domain === TRC)!;
    // S01: a product, then a domain, with one coverage group per obligation kind it has.
    await openPage(page, PRODUCT);
    await page.locator(WIKI).getByRole('link', { name: 'LA-TRC Traceability' }).click();
    await page.waitForURL((u) => u.pathname === `/${TRC}`);
    const section = page.locator(`${WIKI} .coverage`).last();
    await expect(section.locator('.coverage-group')).toHaveCount(coverage.obligations.filter((o) => o.total > 0).length);
    for (const o of coverage.obligations.filter((x) => x.total > 0)) await expect(section.locator(`.coverage-group[data-kind="${o.kind}"] .coverage-heading`)).toContainText(String(o.total));
    // S02: they open a gap on its record page.
    const gap = page.getByRole('list', { name: 'Coverage gaps' }).getByRole('link').first();
    const gapId = (await gap.locator('code').textContent())!;
    await gap.click();
    await page.waitForURL((u) => u.pathname === `/${gapId}`);
    await expect(page.locator(`${WIKI} .pane-title`)).toContainText(gapId);
    // S03: on a record page each test shows its state.
    await openPage(page, `/${REQUIREMENT}`);
    const proved = page.locator(WIKI).getByRole('list', { name: 'Proved by' });
    for (const t of rowsOf(spec, 'use_case_test').filter((x) => x.uc_requirement_id === REQUIREMENT)) {
      await expect(proved.getByRole('listitem').filter({ hasText: String(t.id) })).toContainText(String(t.state));
    }
  });

  test('LA-TRC-UC12-FL01-T see the patterns a domain follows and the rules it owes', async ({ page }) => {
    const spec = await served(page);
    const followed = rowsOf(spec, 'follows').filter((l) => l.source_id === EXP).map((l) => String(l.target_id));
    expect(followed.length).toBeGreaterThan(0);
    const pattern = followed[0];
    const rules = rowsOf(spec, 'pattern_rule').filter((r) => r.pattern_id === pattern);
    // S01: the domain page's Patterns we follow, each pattern's rules with this domain's standing.
    await openPage(page, `/${EXP}`);
    const list = page.getByRole('list', { name: 'Patterns we follow' });
    await expect(list.getByRole('link', { name: new RegExp(`^${pattern} `) })).toBeVisible();
    await list.getByRole('button', { name: `Expand ${EXP}:${pattern}` }).click();
    const owed = page.getByRole('list', { name: `Rules of ${pattern}` }).getByRole('listitem');
    await expect(owed).toHaveCount(rules.length);
    for (const item of await owed.all()) await expect(item).toHaveText(/(not proved|proved|not applicable|waived)$/);
    // S02: the pattern's page: its settings, its rules and who follows it, domain by domain.
    await list.getByRole('link', { name: new RegExp(`^${pattern} `) }).click();
    await page.waitForURL((u) => u.pathname === `/${pattern}`);
    const wiki = page.locator(WIKI);
    const settings = rowsOf(spec, 'pattern_setting').filter((s) => s.pattern_id === pattern).length;
    await expect(wiki.getByRole('heading', { name: `Settings ${settings}`, level: 2 })).toBeVisible();
    await expect(wiki.getByRole('heading', { name: `Rules ${rules.length}`, level: 2 })).toBeVisible();
    await expect(wiki.getByRole('region', { name: `Followed in ${EXP}` })).toBeVisible();
    // S03: in the graph, the rules sit under the pattern and its followers are linked to it.
    await openPage(page, `/${pattern}?view=graph`, '.pane-graph .graph-flow .graph-box');
    const ids = await page.locator('.pane-graph .graph-flow .graph-box').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
    for (const r of rules) expect(ids).toContain(r.id);
    const traced = page.getByRole('complementary', { name: 'Side bar' }).getByRole('region', { name: 'Traceability' });
    await expect(traced.getByRole('link', { name: EXP, exact: true })).toBeVisible();
  });

  test('LA-TRC-UC13-FL01-T see tests by state with each domain\'s coverage', async ({ page }) => {
    const spec = await served(page);
    const ofDomain = (id: string) => spec.coverage.find((c) => c.domain === id)!.tests;
    // S01: each domain card's tests by state.
    await openPage(page, PRODUCT);
    const wiki = page.locator(WIKI);
    for (const d of rowsOf(spec, 'domain').filter((x) => x.product_id === 'LA')) {
      const card = wiki.locator('article.domain-card').filter({ has: page.getByRole('link', { name: `${d.id} ${d.title}` }) });
      await expect(card.getByLabel('Tests by state')).toHaveText(`Tests ${testsText(ofDomain(String(d.id)))}`);
    }
    // S02: the Summary's tests by state in total.
    const total = spec.coverage.filter((c) => c.product === 'LA').reduce((t, c) => ({ automated: t.automated + c.tests.automated, manual: t.manual + c.tests.manual, not_automated: t.not_automated + c.tests.not_automated }), { automated: 0, manual: 0, not_automated: 0 });
    await expect(wiki.locator('dl.summary-list div', { has: page.locator('dt', { hasText: /^Tests$/ }) }).locator('dd')).toHaveText(testsText(total));
    // S03: a domain's own Coverage section says the same.
    await wiki.getByRole('link', { name: 'LA-TRC Traceability' }).click();
    await page.waitForURL((u) => u.pathname === `/${TRC}`);
    await expect(page.locator(`${WIKI} .coverage`).last().getByLabel('Tests by state')).toHaveText(`Tests ${testsText(ofDomain(TRC))}`);
  });

  test('LA-TRC-UC14-FL01-T see what designs, builds and proves a record', async ({ page }) => {
    const spec = await served(page);
    const steps = rowsOf(spec, 'fulfills').filter((l) => l.target_id === REQUIREMENT).map((l) => String(l.source_id));
    const tests = rowsOf(spec, 'use_case_test').filter((t) => t.uc_requirement_id === REQUIREMENT);
    // S01: the Reader opens a domain, searches for a requirement and opens it.
    await openPage(page, `/${TRC}`);
    await page.locator(WIKI).getByRole('searchbox', { name: 'Filter records' }).fill(REQUIREMENT);
    await page.locator(WIKI).getByRole('link', { name: new RegExp(`^${REQUIREMENT} `) }).first().click();
    await page.waitForURL((u) => u.pathname === `/${REQUIREMENT}`);
    // S02: its Traceability: what designs it, what proves it, and a callout for each gap.
    const wiki = page.locator(WIKI);
    await expect(wiki.getByRole('heading', { name: 'Traceability', level: 2 })).toBeVisible();
    for (const s of steps) await expect(wiki.getByRole('list', { name: 'Designed by' }).getByRole('link', { name: new RegExp(`^${s} `) })).toBeVisible();
    for (const t of tests) await expect(wiki.getByRole('list', { name: 'Proved by' }).getByRole('listitem').filter({ hasText: String(t.id) })).toContainText(String(t.state));
    const gaps = spec.coverage.flatMap((c) => c.gaps).filter((g) => g.id === REQUIREMENT);
    const callouts = wiki.getByRole('list', { name: `Gaps in ${REQUIREMENT}` }).getByRole('listitem');
    await expect(callouts).toHaveCount(gaps.length);
    // S03: a test's page: what it proves and its run by.
    const test0 = tests[0];
    await wiki.getByRole('list', { name: 'Proved by' }).getByRole('link', { name: new RegExp(`^${test0.id} `) }).click();
    await page.waitForURL((u) => u.pathname === `/${test0.id}`);
    await expect(wiki.getByRole('list', { name: 'Proves' }).getByRole('link', { name: new RegExp(`^${REQUIREMENT} `) })).toBeVisible();
    await expect(wiki.getByRole('heading', { name: 'Run by', level: 3 })).toBeVisible();
    await expect(wiki.locator('dt', { hasText: /^Level$/ }).locator('xpath=following-sibling::dd[1]')).toHaveText(String(test0.level));
    // S04: a gap's callout leads to the page of the check that reports it.
    await page.goBack();
    await page.waitForURL((u) => u.pathname === `/${REQUIREMENT}`);
    // The suite serves the data without the code, so the requirement is not built there.
    expect(gaps.length).toBeGreaterThan(0);
    const check = callouts.first().getByRole('link');
    const name = (await check.textContent())!.trim();
    await check.click();
    await page.waitForURL((u) => u.pathname === `/format/checks/${name}`);
    await expect(page.locator('#main h1')).toHaveText(name);
  });
});
