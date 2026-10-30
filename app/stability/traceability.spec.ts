import { expect, test } from './test';
import { openPage, showCard } from './measure';
import { rowsOf, servedWorkspace, testsText } from './flows';
import { keepData, PRODUCT } from './scenarios';
import { expectKeyWhole, traceDrawn, traceSceneOf } from './scene';
import { execFileSync } from 'node:child_process';
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
const WIKI = '.wiki-panel';
const repo = path.resolve(import.meta.dirname, '../..');
/** An Agent's write to the suite's copy, through the command layer. */
const lathe = (...args: string[]) => execFileSync('node', [path.join(repo, 'lathe/bin/lathe.ts'), ...args, '--root', process.env.STABILITY_ROOT!], { stdio: 'pipe' }).toString();

test.describe('Traceability flows', () => {
  test('LA-TRC-UC09-FL01-T see each domain\'s coverage and the product\'s summary', async ({ page }) => {
    const spec = await servedWorkspace();
    await openPage(page, PRODUCT);
    const wiki = page.locator(WIKI);
    // S01: each domain card's coverage bars, as coverage counts them.
    const domains = rowsOf(spec, 'domain').filter((d) => d.product_id === 'LA');
    for (const d of domains) {
      const card = wiki.getByRole('list', { name: 'Domains' }).locator('.card').filter({ has: page.getByRole('link', { name: `${d.id} ${d.title}` }) });
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
    await expect(page.locator(`.header-strip h1`)).toHaveText('Traceability');
  });

  test('LA-TRC-UC10-FL01-T trace obligations on the Trace stage', async ({ page }) => {
    const spec = await servedWorkspace();
    // The chain: the steps that fulfill it, their flows, what they invoke and where they happen, the handlers of what
    // they invoke, the tests under it.
    const steps = rowsOf(spec, 'fulfills').filter((l) => l.target_id === REQUIREMENT).map((l) => String(l.source_id));
    const flows = rowsOf(spec, 'flow_step').filter((s) => steps.includes(String(s.id))).map((s) => String(s.flow_id));
    const operations = rowsOf(spec, 'invokes').filter((l) => steps.includes(String(l.source_id))).map((l) => String(l.target_id));
    const views = rowsOf(spec, 'happens_in').filter((l) => steps.includes(String(l.source_id))).map((l) => String(l.target_id));
    const handlers = [...rowsOf(spec, 'command_handler'), ...rowsOf(spec, 'query_handler')].filter((h) => operations.includes(String(h.command_id ?? h.query_id))).map((h) => String(h.id));
    const tests = rowsOf(spec, 'use_case_test').filter((t) => t.uc_requirement_id === REQUIREMENT).map((t) => String(t.id));
    expect(steps.length && tests.length).toBeTruthy();
    const pane = page.locator('.focus-stage');
    const column = (name: string) => pane.locator('.trace-column').filter({ has: page.locator('.trace-column-name', { hasText: new RegExp(`^${name}`) }) });
    const ids = (name: string) => column(name).locator('a.card-title code').allTextContents();
    // S01, S02: the requirement's Trace stage: its box in the Obligations column, its use case to its left with a line to
    // it, what builds it and its tests to its right with lines from it, framed; the same chain in the table under it.
    const useCase = String(rowsOf(spec, 'uc_requirement').find((r) => r.id === REQUIREMENT)!.use_case_id);
    await openPage(page, `/${REQUIREMENT}?stage=trace`);
    await traceDrawn(page);
    const chain = await traceSceneOf(page, true);
    expect(chain.columns.map((c) => c.name)).toEqual(['Outcomes', 'Use cases', 'Obligations', 'Built by', 'Proved by']);
    expect(chain.boxes.filter((b) => b.focus).map((b) => b.key)).toEqual([REQUIREMENT]);
    expect(new Set(chain.boxes.map((b) => b.key)).size, 'each record once').toBe(chain.boxes.length);
    const lines = chain.lines.map((l) => `${l.kind}:${l.from}>${l.to}`);
    expect(lines).toContain(`reaches:${useCase}>${REQUIREMENT}`);
    for (const h of handlers) expect(lines, h).toContain(`built:${REQUIREMENT}>${h}`);
    for (const t of tests) expect(lines, t).toContain(`proved:${REQUIREMENT}>${t}`);
    const own = (await traceSceneOf(page)).boxes.find((b) => b.focus)!;
    expect(own.rect.left >= chain.canvas.left && own.rect.left + own.rect.width <= chain.canvas.left + chain.canvas.width, 'the camera frames the requirement').toBe(true);
    await expect(pane.locator('.trace-access [aria-current="page"]')).toContainText(REQUIREMENT);
    expect((await ids('Design')).sort()).toEqual([...new Set([...steps, ...flows, ...views, ...operations])].sort());
    expect((await ids('Tests')).sort()).toEqual([...tests].sort());
    // S03: the use case's path: its requirements lit, the rest faded; then an outcome's, a line to each use case of the
    // capabilities serving it; then the domain, which has no box: the table's matrix around it.
    const requirements = rowsOf(spec, 'uc_requirement').filter((r) => r.use_case_id === useCase).map((r) => String(r.id));
    await openPage(page, `/${useCase}?stage=trace`);
    await traceDrawn(page, 900);
    const uc = await traceSceneOf(page, true);
    for (const r of requirements) expect(uc.boxes.find((b) => b.key === r)!.strength, r).toBe(1);
    expect(uc.boxes.some((b) => b.strength < 1), 'off the path, faded').toBe(true);
    const rows = pane.locator('.trace-matrix tbody tr:not(.group-row)');
    await expect(rows).toHaveCount(requirements.length);
    const capability = String(rowsOf(spec, 'use_case').find((u) => u.id === useCase)!.capability_id);
    const outcome = rowsOf(spec, 'serves').filter((l) => l.source_id === capability).map((l) => String(l.target_id)).sort()[0];
    const serving = rowsOf(spec, 'serves').filter((l) => l.target_id === outcome).map((l) => String(l.source_id));
    await openPage(page, `/${outcome}?stage=trace`);
    await traceDrawn(page);
    const outcomeScene = await traceSceneOf(page, true);
    await expectKeyWhole(page);
    const servedUseCases = rowsOf(spec, 'use_case').filter((u) => serving.includes(String(u.capability_id))).map((u) => String(u.id));
    expect(outcomeScene.lines.filter((l) => l.kind === 'serves' && l.from === outcome).map((l) => l.to).sort()).toEqual([...servedUseCases].sort());
    await openPage(page, `/${TRC}?stage=trace`);
    await traceDrawn(page);
    const domain = await traceSceneOf(page, true);
    expect(domain.boxes.some((b) => b.focus), 'a domain has no box').toBe(false);
    expect(domain.boxes.some((b) => b.kind === 'capability' || b.kind === 'domain'), 'no capability or domain is drawn').toBe(false);
    expect(await pane.locator('.trace-matrix tr.group-row').count()).toBeGreaterThan(1);
    // S04: Gaps only fades what is off the gaps' paths and keeps every box in its place; each gap's box at full strength. The table keeps the rows with one.
    const before = (await traceSceneOf(page, true)).boxes.length;
    await pane.getByRole('checkbox', { name: 'Gaps only' }).check();
    await traceDrawn(page);
    const gapped = await traceSceneOf(page, true);
    expect(gapped.boxes.length, 'no box is taken out').toBe(before);
    expect(gapped.boxes.filter((b) => b.role === 'gap').every((b) => b.dashed && b.strength === 1)).toBe(true);
    expect(gapped.boxes.some((b) => b.role === 'record' && b.strength < 1), 'the complete paths are faded').toBe(true);
    const left = await rows.count();
    for (let i = 0; i < Math.min(left, 20); i++) await expect(rows.nth(i).locator('td.is-gap').first()).toBeAttached();
    // The arrows walk the view (LA-V61-R49): from the requirement, Left goes along a link to a use case reaching it, Right back to a box it links to.
    await openPage(page, `/${REQUIREMENT}?stage=trace`);
    await traceDrawn(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ArrowLeft');
    await page.waitForURL((u) => u.pathname !== `/${REQUIREMENT}`);
    const reachedBy = chain.lines.filter((l) => l.kind === 'reaches' && l.to === REQUIREMENT).map((l) => l.from);
    expect(reachedBy).toContain(decodeURIComponent(new URL(page.url()).pathname.slice(1)));
    // Every stage works on every focus (LA-PAT-APP-UX-R17): a step, which the view does not draw, marked in the table's rows that hold it.
    await openPage(page, `/${steps[0]}?stage=trace`);
    await traceDrawn(page);
    expect((await traceSceneOf(page, true)).boxes.some((b) => b.focus)).toBe(false);
    await expect(pane.locator('.trace-matrix td [aria-current="page"]').first()).toContainText(steps[0]);
  });

  test('LA-V98-R08-T04 focusing an outcome or a test lights its whole path both ways and fades the rest; hovering a box lights its path', async ({ page }) => {
    const spec = await servedWorkspace();
    const test0 = rowsOf(spec, 'use_case_test').find((t) => t.uc_requirement_id === REQUIREMENT)!;
    const useCase = String(rowsOf(spec, 'uc_requirement').find((r) => r.id === REQUIREMENT)!.use_case_id);
    const capability = String(rowsOf(spec, 'use_case').find((u) => u.id === useCase)!.capability_id);
    const outcomes = rowsOf(spec, 'serves').filter((l) => l.source_id === capability).map((l) => String(l.target_id));
    // An outcome: its use cases, their obligations and what builds and proves them lit; another outcome faded.
    await openPage(page, `/${outcomes[0]}?stage=trace`);
    await traceDrawn(page, 900);
    const lit = await traceSceneOf(page, true);
    for (const k of [outcomes[0], useCase, REQUIREMENT, String(test0.id)]) expect(lit.boxes.find((b) => b.key === k)!.strength, k).toBe(1);
    expect(lit.boxes.some((b) => b.column === 0 && b.key !== outcomes[0] && b.strength < 1), 'another outcome faded').toBe(true);
    expect(lit.lines.filter((l) => l.lit).some((l) => l.from === outcomes[0] && l.to === useCase)).toBe(true);
    // A test: back to its requirement, the use cases reaching it and their outcomes; its siblings faded.
    await openPage(page, `/${test0.id}?stage=trace`);
    await traceDrawn(page, 900);
    const back = await traceSceneOf(page, true);
    for (const k of [String(test0.id), REQUIREMENT, useCase, ...outcomes]) expect(back.boxes.find((b) => b.key === k)!.strength, k).toBe(1);
    expect(back.boxes.filter((b) => b.column === 4 && b.key !== test0.id).every((b) => b.strength < 1)).toBe(true);
    // Hovering the requirement lights its path while the pointer is on it.
    const box = (await traceSceneOf(page)).boxes.find((b) => b.key === REQUIREMENT)!;
    await page.mouse.move(box.rect.left + box.rect.width / 2, box.rect.top + box.rect.height / 2);
    await expect.poll(async () => (await traceSceneOf(page, true)).boxes.find((b) => b.key === useCase)?.lit).toBe(true);
    expect((await traceSceneOf(page, true)).boxes.find((b) => b.key === REQUIREMENT)!.hover).toBe(true);
  });

  test('LA-TRC-UC11-FL01-T see every obligation kind and test state', async ({ page }) => {
    const spec = await servedWorkspace();
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
    await expect(page.locator(".header-strip-id")).toHaveText(gapId);
    // S03: on a record page each test shows its state.
    await openPage(page, `/${REQUIREMENT}`);
    const proved = page.locator(WIKI).getByRole('list', { name: 'Proved by' });
    for (const t of rowsOf(spec, 'use_case_test').filter((x) => x.uc_requirement_id === REQUIREMENT)) {
      await expect(proved.getByRole('listitem').filter({ hasText: String(t.id) })).toContainText(String(t.state));
    }
  });

  test('LA-TRC-UC12-FL01-T see the pattern rules a domain owes', async ({ page }) => {
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
    const ids = await page.locator('.focus-stage .graph-flow .graph-box').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
    for (const r of rules) expect(ids).toContain(r.id);
    await expect(page.locator(WIKI).getByRole('region', { name: `Followed in ${EXP}` })).toBeVisible();
  });

  test('LA-TRC-UC13-FL01-T see tests by state with each domain\'s coverage', async ({ page }) => {
    const spec = await servedWorkspace();
    const ofDomain = (id: string) => spec.coverage.find((c) => c.domain === id)!.tests;
    // S01: each domain card's tests by state.
    await openPage(page, PRODUCT);
    const wiki = page.locator(WIKI);
    for (const d of rowsOf(spec, 'domain').filter((x) => x.product_id === 'LA')) {
      const card = wiki.getByRole('list', { name: 'Domains' }).locator('.card').filter({ has: page.getByRole('link', { name: `${d.id} ${d.title}` }) });
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

  test('LA-TRC-UC14-FL01-T trace a record', async ({ page }) => {
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

  test('LA-TRC-UC20-FL01-T see the outcomes a record serves', async ({ page }) => {
    const spec = await servedWorkspace();
    // What each record serves, as the Serves reach works it out over Lathe's own data.
    const store = await openStore(path.resolve(import.meta.dirname, '../..'));
    const served = (() => { try { return servesOf({ schema: store.schema, rows: (t) => store.rows(t) }); } finally { void store.close(); } })();
    const wiki = page.locator(WIKI);
    const servesLine = () => wiki.locator('[data-fact="serves"] dd');
    /** The card's whole page (More), where a record's facts are. */
    const whole = () => showCard(page, 'whole');
    // S01, S02: an aggregate, a storage requirement and a view requirement each name the outcomes they serve, each a link.
    const aggregate = 'LA-AUT-A11';
    const storage = String(rowsOf(spec, 'storage_requirement').find((r) => r.aggregate_id === aggregate)?.id ?? rowsOf(spec, 'storage_requirement').find((r) => served.has(String(r.id)))!.id);
    const viewRequirement = 'LA-V92-R78';
    for (const id of [aggregate, storage, viewRequirement]) {
      await openPage(page, `/${id}`);
      await whole();
      const outcomes = served.get(id)!.outcomes;
      expect(outcomes.length).toBeGreaterThan(0);
      await expect(wiki.getByRole('list', { name: `Outcomes ${id} serves` }).getByRole('link')).toHaveCount(outcomes.length);
      for (const o of outcomes) await expect(wiki.getByRole('list', { name: `Outcomes ${id} serves` }).getByRole('link', { name: new RegExp(`^${o} `) })).toBeVisible();
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
