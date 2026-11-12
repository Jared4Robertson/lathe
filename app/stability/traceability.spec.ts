import { expect, test } from './test';
import { openPage, showCard } from './measure';
import { rowsOf, servedWorkspace, testsMetricText, testsText } from './flows';
import { keepData, PRODUCT } from './scenarios';
import { expectKeyWhole, traceDrawn, traceSceneOf } from './scene';
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { openStore } from '../../lathe/src/platform/data/index';
import { servesOf } from '../../lathe/src/trace/serves';

// Traceability's flows that the Reader walks in the app, each on its main path, over the suite's copy
// of this repo's data: the product's and the domains' coverage, the Trace stage, every
// obligation kind and test state, the patterns a domain follows, tests by state, and what designs,
// builds and proves a record. Each page is checked against the coverage the engine worked out
// (read through the products' own stores). The flows run from the command line are in lathe/test/flows/traceability.test.ts.

/** A domain with UC requirements, their flows, tests and gaps. */
const TRC = 'LA-TRC';
/** A domain that follows patterns. */
const EXP = 'LA-EXP';
/** A UC requirement with a flow step that fulfills it, in a view, and a test. */
const REQUIREMENT = 'LA-TRC-UC10-R03';
/** An aggregate with no root entity, command or repository: it opens gaps in its domain, which Lathe's own data has none of. */
const GAPPED_AGGREGATE = { id: 'LA-TRC-A90', title: 'An aggregate nothing roots', domain_id: TRC, description: 'An aggregate with no root entity.', identity: 'Name' };
const WIKI = '.wiki-panel';
const repo = path.resolve(import.meta.dirname, '../..');
/** An Agent's write to the suite's copy, through the command layer. */
const lathe = (...args: string[]) => execFileSync('node', [path.join(repo, 'lathe/bin/lathe.ts'), ...args, '--root', process.env.STABILITY_ROOT!], { stdio: 'pipe' }).toString();

test.describe('Traceability flows', () => {
  test('LA-TRC-UC01-R06-T01 the Reader sees how complete each domain is and what is undecided or broken', async ({ page }) => {
    const spec = await servedWorkspace();
    await openPage(page, PRODUCT);
    const wiki = page.locator(WIKI);
    // LA-TRC-UC01-FL-S01: each domain's coverage by obligation kind, here its card's bars, as coverage counts them.
    const domains = rowsOf(spec, 'domain').filter((d) => d.product_id === 'LA');
    for (const d of domains) {
      const card = wiki.getByRole('list', { name: 'Domains' }).locator('.card').filter({ has: page.getByRole('link', { name: `${d.id} ${d.title}` }) });
      const c = spec.coverage.find((x) => x.domain === d.id)!;
      for (const o of c.obligations.filter((x) => x.total > 0 && !x.proof_only)) {
        await expect(card.locator(`.coverage-group[data-kind="${o.kind}"]`).getByRole('img', { name: `designed: ${o.designed} of ${o.total}` })).toBeVisible();
        await expect(card.locator(`.coverage-group[data-kind="${o.kind}"]`).getByRole('img', { name: `proved: ${o.proved} of ${o.total}` })).toBeAttached();
      }
    }
    // LA-TRC-UC01-FL-S03 and S04: the product's tests by state in total, its open questions and problems, here in its Key metrics.
    const metrics = wiki.locator('dl.metrics');
    const sum = (key: 'automated' | 'manual' | 'not_automated') => spec.coverage.filter((c) => c.product === 'LA').reduce((n, c) => n + c.tests[key], 0);
    await expect(metrics.locator('[data-metric="testsAutomated"] dd')).toHaveText(testsMetricText({ automated: sum('automated'), manual: sum('manual'), not_automated: sum('not_automated') }));
    for (const label of ['Outcomes served', 'Designed', 'Built', 'Proved', 'Tests automated', 'Errors', 'Warnings', 'Open questions']) await expect(metrics.locator('dt', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
    await expect(metrics.getByRole('link', { name: /^Errors: \d+$/ })).toBeVisible();
    // LA-TRC-UC01-FL-S04: the product's open questions and problems.
    const questions = rowsOf(spec, 'question').length;
    await expect(wiki.getByRole('heading', { name: `Open questions ${questions}`, level: 2 })).toBeVisible();
    await expect(wiki.getByRole('heading', { name: /^Problems in this product \d+$/, level: 2 })).toBeVisible();
    await expect(wiki.getByRole('list', { name: 'Problems' }).getByRole('listitem').first()).toBeVisible();
    // A domain card opens its domain page.
    await wiki.getByRole('link', { name: 'LA-TRC Traceability' }).click();
    await page.waitForURL((u) => u.pathname === `/${TRC}`);
    await expect(page.locator(`.header-strip h1`)).toHaveText('Traceability');
  });

  test('LA-TRC-UC10-FL-T trace a use case\'s row from its outcome to its tests on the Trace stage', async ({ page }) => {
    const spec = await servedWorkspace();
    const useCase = String(rowsOf(spec, 'uc_requirement').find((r) => r.id === REQUIREMENT)!.use_case_id);
    const capability = String(rowsOf(spec, 'use_case').find((u) => u.id === useCase)!.capability_id);
    const outcomes = rowsOf(spec, 'serves').filter((l) => l.source_id === capability).map((l) => String(l.target_id));
    const flows = rowsOf(spec, 'flow').filter((f) => f.use_case_id === useCase).map((f) => String(f.id));
    const tests = rowsOf(spec, 'use_case_test').filter((t) => t.uc_requirement_id === REQUIREMENT).map((t) => String(t.id));
    expect(outcomes.length && flows.length && tests.length).toBeTruthy();
    const box = (scene: Awaited<ReturnType<typeof traceSceneOf>>, key: string) => scene.boxes.find((b) => b.key === key);
    // S01, S02: the use case's row, once, focused: its outcomes with a line to it, and a status per stage.
    await openPage(page, `/${useCase}?stage=trace`);
    await traceDrawn(page, 900);
    const row = await traceSceneOf(page, true);
    expect(row.columns.map((c) => c.name)).toEqual(['Outcome', 'Journey', 'Use case', 'Flow', 'Technical flow', 'Acceptance test suite']);
    expect(row.rows.filter((r) => r === useCase)).toHaveLength(1);
    expect(box(row, `${useCase}|use-case`)).toMatchObject({ focus: true });
    expect(row.lines.filter((l) => l.kind === 'serves' && l.to === `${useCase}|use-case`).map((l) => l.from).sort()).toEqual(outcomes.map((o) => `outcome/${o}`).sort());
    for (const stage of ['flow', 'technical', 'suite']) expect(['status', 'gap'], stage).toContain(box(row, `${useCase}|${stage}`)!.role);
    await expectKeyWhole(page);
    // S03: Expand row opens every stage of the row: its requirements, its flows, its tests.
    const expandRow = page.locator('.focus-stage .stage-toolbar').getByRole('button', { name: 'Expand row' });
    if ((await expandRow.getAttribute('aria-pressed')) !== 'true') await expandRow.click();
    await expect.poll(async () => !!box(await traceSceneOf(page, true), `${useCase}|use-case/${REQUIREMENT}`), { timeout: 5000 }).toBe(true);
    const open = await traceSceneOf(page, true);
    for (const f of flows) expect(box(open, `${useCase}|flow/${f}`), f).toBeTruthy();
    for (const t of tests) expect(box(open, `${useCase}|suite/${t}`), t).toBeTruthy();
    // S04: the requirement selected (by its address, as a click or the walk does): its path lit across the row, from its
    // outcomes to the flows whose steps fulfill it and its tests, every other row faded.
    await page.evaluate((id) => { window.history.pushState(null, '', `/${id}?stage=trace`); window.dispatchEvent(new PopStateEvent('popstate')); }, REQUIREMENT);
    await expect.poll(async () => box(await traceSceneOf(page, true), `${useCase}|use-case/${REQUIREMENT}`)?.focus, { timeout: 5000 }).toBe(true);
    await traceDrawn(page, 600);
    const lit = await traceSceneOf(page, true);
    expect(box(lit, `${useCase}|use-case/${REQUIREMENT}`)!.lit).toBe(true);
    for (const t of tests) expect(box(lit, `${useCase}|suite/${t}`)!.lit, t).toBe(true);
    for (const o of outcomes) expect(box(lit, `outcome/${o}`)!.lit, o).toBe(true);
    expect(lit.lines.some((l) => l.kind === 'path' && l.lit && l.from === `${useCase}|use-case/${REQUIREMENT}`)).toBe(true);
    expect(lit.boxes.some((b) => b.row !== null && b.row !== useCase && b.strength < 1), 'the other rows faded').toBe(true);
  });

  test('LA-TRC-UC11-FL-T see every obligation kind and test state', async ({ page }) => {
    test.setTimeout(180_000);
    const spec = await servedWorkspace();
    const coverage = spec.coverage.find((c) => c.domain === TRC)!;
    // S01: a product, then a domain, with one coverage group per obligation kind it has.
    await openPage(page, PRODUCT);
    await page.locator(WIKI).getByRole('link', { name: 'LA-TRC Traceability' }).click();
    await page.waitForURL((u) => u.pathname === `/${TRC}`);
    const section = page.locator(`${WIKI} .coverage`).last();
    await expect(section.locator('.coverage-group')).toHaveCount(coverage.obligations.filter((o) => o.total > 0).length);
    for (const o of coverage.obligations.filter((x) => x.total > 0)) await expect(section.locator(`.coverage-group[data-kind="${o.kind}"] .coverage-heading`)).toContainText(String(o.total));
    // S02: they open a gap on its record page, on a domain that has one. Lathe has no gaps of its own, so the test adds an
    // aggregate no entity, command or repository serves to this domain, and puts the data back after.
    const restore = keepData();
    try {
      appendFileSync(path.join(process.env.STABILITY_ROOT!, 'data', 'aggregate.jsonl'), `${JSON.stringify(GAPPED_AGGREGATE)}\n`);
      await expect.poll(async () => (await servedWorkspace()).coverage.find((c) => c.domain === TRC)!.gaps.some((g) => g.id === GAPPED_AGGREGATE.id), { timeout: 60_000 }).toBe(true);
      // The domain's page is open from S01; it shows the data's change as the server reads it, without a reload.
      const gap = page.getByRole('list', { name: 'Coverage gaps' }).getByRole('link').filter({ hasText: GAPPED_AGGREGATE.id }).first();
      await expect(gap).toBeVisible({ timeout: 60_000 });
      const gapId = (await gap.locator('code').textContent())!;
      await gap.click();
      await page.waitForURL((u) => u.pathname === `/${gapId}`);
      await expect(page.locator(".header-strip-id")).toHaveText(gapId);
    } finally {
      restore();
    }
    // S03: on a record page each test shows its state.
    await openPage(page, `/${REQUIREMENT}`);
    const proved = page.locator(WIKI).getByRole('list', { name: 'Proved by' });
    for (const t of rowsOf(spec, 'use_case_test').filter((x) => x.uc_requirement_id === REQUIREMENT)) {
      await expect(proved.getByRole('listitem').filter({ hasText: String(t.id) })).toContainText(String(t.state));
    }
  });

  test('LA-TRC-UC12-FL-T see the pattern rules a domain owes', async ({ page }) => {
    const spec = await servedWorkspace();
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
    // S03: in the graph, the rules sit under the pattern; the wiki card beside it still lists its followers.
    await openPage(page, `/${pattern}?stage=graph`, '.focus-stage .graph-flow .graph-box');
    // A pattern with many rules keeps them in one "pattern_rule" group under it; with few, each rule is drawn on its own.
    const drawnIds = () => page.locator('.focus-stage .graph-flow .graph-box').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
    await expect.poll(async () => {
      const ids = await drawnIds();
      return ids.includes(`${pattern}/pattern_rule`) ? [] : rules.filter((r) => !ids.includes(String(r.id))).map((r) => r.id);
    }).toEqual([]);
    await expect(page.locator(WIKI).getByRole('region', { name: `Followed in ${EXP}` })).toBeVisible();
  });

  test('LA-TRC-UC06-R04-T01 the Reader sees each domain\'s tests by state beside its coverage', async ({ page }) => {
    const spec = await servedWorkspace();
    const ofDomain = (id: string) => spec.coverage.find((c) => c.domain === id)!.tests;
    // LA-TRC-UC06-FL-S01: each domain's tests by state, here on its card.
    await openPage(page, PRODUCT);
    const wiki = page.locator(WIKI);
    for (const d of rowsOf(spec, 'domain').filter((x) => x.product_id === 'LA')) {
      const card = wiki.getByRole('list', { name: 'Domains' }).locator('.card').filter({ has: page.getByRole('link', { name: `${d.id} ${d.title}` }) });
      await expect(card.getByLabel('Tests by state')).toHaveText(`Tests ${testsText(ofDomain(String(d.id)))}`);
    }
    // LA-TRC-UC06-FL-S03: the product's tests by state in total, here in its Key metrics.
    const total = spec.coverage.filter((c) => c.product === 'LA').reduce((t, c) => ({ automated: t.automated + c.tests.automated, manual: t.manual + c.tests.manual, not_automated: t.not_automated + c.tests.not_automated }), { automated: 0, manual: 0, not_automated: 0 });
    await expect(wiki.locator('dl.metrics [data-metric="testsAutomated"] dd')).toHaveText(testsMetricText(total));
    // LA-TRC-UC06-FL-S01 again: a domain's own Coverage section says the same.
    await wiki.getByRole('link', { name: 'LA-TRC Traceability' }).click();
    await page.waitForURL((u) => u.pathname === `/${TRC}`);
    await expect(page.locator(`${WIKI} .coverage`).last().getByLabel('Tests by state')).toHaveText(`Tests ${testsText(ofDomain(TRC))}`);
  });

  test('LA-TRC-UC14-FL-T trace a record', async ({ page }) => {
    const restore = keepData();
    try {
      // The suite serves the code too, so the requirement is built; its test, made not automated yet, leaves it a gap to follow.
      lathe('use-case', 'change-use-case-test', '--id', `${REQUIREMENT}-T01`, '--state', 'not automated yet', '--manual_reason', '');
      const spec = await servedWorkspace();
      // What designs and builds it is the engine's chain, the one the Trace stage draws.
      const chain = spec.chains.find((c) => c.obligation === REQUIREMENT)!;
      const tests = rowsOf(spec, 'use_case_test').filter((t) => t.uc_requirement_id === REQUIREMENT);
      // S01: the Reader opens a domain, searches for a requirement and opens it.
      await openPage(page, `/${TRC}`);
      await page.locator(WIKI).getByRole('searchbox', { name: 'Filter records' }).fill(REQUIREMENT);
      await page.locator(WIKI).getByRole('link', { name: new RegExp(`^${REQUIREMENT} `) }).first().click();
      await page.waitForURL((u) => u.pathname === `/${REQUIREMENT}`);
      // S02: its Traceability: what designs it, what builds it, what proves it, and a callout for each gap.
      const wiki = page.locator(WIKI);
      await expect(wiki.getByRole('heading', { name: 'Traceability', level: 2 })).toBeVisible();
      for (const id of chain.design) await expect(wiki.getByRole('list', { name: 'Designed by' }).getByRole('link', { name: new RegExp(`^${id} `) })).toBeVisible();
      for (const id of chain.build) await expect(wiki.getByRole('list', { name: 'Built by' }).getByRole('link', { name: new RegExp(`^${id} `) })).toBeVisible();
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
      expect(gaps.length).toBeGreaterThan(0);
      const check = callouts.first().getByRole('link');
      const name = (await check.textContent())!.trim();
      await check.click();
      // It opens in the wiki card over the stage, which keeps its focus (LA-PAT-APP-UX-R20).
      await page.waitForURL((u) => u.pathname === `/${REQUIREMENT}` && u.search.endsWith(`page=format/checks/${name}`));
      await expect(page.locator('.wiki-panel.is-format .wiki-panel-title h2')).toHaveText(name);
    } finally {
      restore();
    }
  });

  test('LA-PAT-PAGE-STEPS-R01-T05 see the outcomes a record serves', async ({ page }) => {
    const spec = await servedWorkspace();
    // What each record serves, as the Serves reach works it out over Lathe's own data.
    const store = await openStore(path.resolve(import.meta.dirname, '../..'));
    const served = (() => { try { return servesOf({ schema: store.schema, rows: (t) => store.rows(t) }); } finally { void store.close(); } })();
    const wiki = page.locator(WIKI);
    const servesLine = () => wiki.locator('[data-fact="serves"] dd');
    /** The card's whole page (More), where a record's facts are. */
    const whole = () => showCard(page, 'whole');
    // S01, S02: an aggregate, a storage requirement and a view requirement each name the outcomes they serve, each a link.
    const aggregate = 'LA-UCS-A11';
    const storage = String(rowsOf(spec, 'storage_requirement').find((r) => r.aggregate_id === aggregate)?.id ?? rowsOf(spec, 'storage_requirement').find((r) => served.has(String(r.id)))!.id);
    const viewRequirement = 'LA-V92-R78';
    for (const id of [aggregate, storage, viewRequirement]) {
      await openPage(page, `/${id}`);
      await whole();
      const outcomes = served.get(id)!.outcomes;
      expect(outcomes.length).toBeGreaterThan(0);
      const list = wiki.getByRole('list', { name: `Outcomes ${id} serves` });
      // One item per outcome; an outcome a journey carries also names that journey after "via" (a link of its own).
      await expect(list.getByRole('listitem')).toHaveCount(outcomes.length);
      for (const o of outcomes) await expect(list.getByRole('link', { name: new RegExp(`^${o} `) })).toBeVisible();
      const journeys = served.get(id)!.journeys;
      const via = await list.locator('a[href^="/LA-JR"]').evaluateAll((links) => links.map((a) => a.getAttribute('href')!.slice(1)));
      expect([...new Set(via)].sort()).toEqual(journeys);
    }
    // S03: an outcome leads to its own page.
    const first = served.get(viewRequirement)!.outcomes[0];
    await wiki.getByRole('list', { name: `Outcomes ${viewRequirement} serves` }).getByRole('link', { name: new RegExp(`^${first} `) }).click();
    await page.waitForURL((u) => u.pathname === `/${first}`);
    await whole();
    await expect(wiki.locator('dt', { hasText: /^Kind$/ })).toBeVisible();
    await expect(servesLine()).toHaveCount(0);
    // S04: Tools › Checks lists each serves-no-outcome warning the engine finds; an Agent adds a read model nothing reaches.
    const restore = keepData();
    try {
      lathe('read-model', 'add-read-model', '--id', 'LA-TRC-RM99', '--title', 'Unread counts', '--domain_id', TRC, '--description', 'A read model nothing queries, added by the stability suite.');
      const unserved = (await servedWorkspace()).problems.filter((p) => p.check === 'serves-no-outcome' && p.record?.startsWith('LA-'));
      expect(unserved.length).toBeGreaterThan(0);
      await openPage(page, `${PRODUCT}?panel=checks`);
      const panel = page.locator('.tool-panel.checks-panel');
      await expect(panel.getByText('serves-no-outcome').first()).toBeVisible();
      await expect(panel.getByText(unserved[0].message).first()).toBeAttached();
    } finally {
      restore();
    }
  });
});
