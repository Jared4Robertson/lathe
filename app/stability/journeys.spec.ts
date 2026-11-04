import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { openPage, showCard } from './measure';
import { JOURNEY, JOURNEY_USE_CASE, keepData } from './scenarios';
import { GRAPH, graphDrawn, sceneOf, traceDrawn, traceSceneOf } from './scene';
import type { TraceScene } from '../src/trace/TraceCanvas';

// The journey pages in a real browser (LA-V156, LA-V101-R13): open a journey, follow a step to the use case it carries
// out and back through the use case's In journeys fact, and move a step up and down; the data is put back.
// Following a journey step by step (LA-EXP-UC16) and seeing how far it is proved (LA-TRC-UC22-R02), over the suite's
// copy of Lathe's spec: Lathe's own journeys carry out use cases only, so the scenarios that need a handoff write a
// journey of their own through the real CLI first, and put the data back after.

const WIKI = '.wiki-panel';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT = () => process.env.STABILITY_ROOT!;
/** Runs the real `lathe` command on the suite's copy, as an Agent would. */
const lathe = (...args: string[]) => execFileSync('node', [path.join(repo, 'lathe/bin/lathe.ts'), ...args, '--root', ROOT()], { stdio: 'pipe' }).toString();

type Row = Record<string, unknown>;
/** The rows of one of the copy's data files, as they stand now. */
function rows(table: string): Row[] {
  const file = path.join(ROOT(), 'data', `${table}.jsonl`);
  return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as Row) : [];
}
const byPosition = (a: Row, b: Row) => Number(a.position) - Number(b.position);
/** What a record carries out, by step: the carries_out links. */
const carriesOut = () => new Map(rows('carries_out').map((l) => [String(l.source_id), String(l.target_id)]));

/** A journey's steps, path by path, the main path first and the others by name, each in position order. */
function stepsOf(journey: string): { id: string; path: string; position: number }[] {
  const steps = rows('journey_step').filter((s) => s.journey_id === journey);
  const paths = [...new Set(steps.map((s) => String(s.path)))].sort((a, b) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)));
  return paths.flatMap((p) => steps.filter((s) => s.path === p).sort(byPosition).map((s) => ({ id: String(s.id), path: p, position: Number(s.position) })));
}

/** Who acts in a use case, in its capability and domain, as its records say. */
function useCaseOf(id: string) {
  const useCase = rows('use_case').find((u) => u.id === id)!;
  const capability = rows('capability').find((c) => c.id === useCase.capability_id)!;
  const domain = rows('domain').find((d) => d.id === capability.domain_id)!;
  const actors = rows('use_case_actor').filter((a) => a.use_case_id === id).sort(byPosition).map((a) => String(a.role_name));
  return { actors, capability: String(capability.title), domain: String(domain.title) };
}

/** Each journey step that carries the record out, with its journey, path, position and the steps before and after it on its path. */
function appearancesOf(id: string) {
  const out = carriesOut();
  return rows('journey_step').filter((s) => out.get(String(s.id)) === id).map((s) => {
    const path = rows('journey_step').filter((o) => o.journey_id === s.journey_id && o.path === s.path);
    const at = (p: number) => path.find((o) => Number(o.position) === p)?.id ?? null;
    return { journey: String(s.journey_id), path: String(s.path), position: Number(s.position), before: at(Number(s.position) - 1), after: at(Number(s.position) + 1) };
  });
}

/** Waits until the server answers the journey as `ready` wants it: the data reload after a CLI write has landed. */
async function served(page: Page, journey: string, ready: (answer: { paths: { name: string; steps: { step: { id: string } }[] }[] }) => boolean = () => true) {
  await expect.poll(async () => {
    const res = await page.request.get(`/api/journey/get-journey?id=${journey}`);
    return res.ok() && ready(await res.json());
  }, { timeout: 20_000 }).toBe(true);
}

/** A journey of the suite's own: its main path a use case of the Owner's, a handoff and a use case of the Reader's, and an alternate path written first. */
const HANDOFF_JOURNEY = 'LA-JR99';
const POLICY = 'LA-EXP-PO01';
const MAIN = [
  { id: `${HANDOFF_JOURNEY}-S02`, carries: 'LA-CHK-UC07' },
  { id: `${HANDOFF_JOURNEY}-S03`, carries: POLICY },
  { id: `${HANDOFF_JOURNEY}-S04`, carries: 'LA-TRC-UC14' },
];
const ALTERNATE = { id: `${HANDOFF_JOURNEY}-S01`, path: 'sent back', carries: JOURNEY_USE_CASE.slice(1) };

/** Writes the handoff journey through the real CLI, the alternate path's step first (S01), then the main path in order. */
function writeHandoffJourney() {
  lathe('journey', 'add-journey', '--id', HANDOFF_JOURNEY, '--title', 'Hand a reviewed problem on to be traced', '--product_id', 'LA',
    '--trigger', 'The Owner finds a problem the check reports.', '--result', 'A Reader has traced the requirement it names to its proof.');
  lathe('journey', 'add-journey-step', '--id', ALTERNATE.id, '--title', 'The Owner writes the use case again', '--journey_id', HANDOFF_JOURNEY, '--path', ALTERNATE.path, '--position', '1', '--carries_out', ALTERNATE.carries);
  const titles = ['The Owner reviews the problem', 'The product remembers the page in its space', 'The Reader traces the requirement to its proof'];
  MAIN.forEach((s, i) => lathe('journey', 'add-journey-step', '--id', s.id, '--title', titles[i], '--journey_id', HANDOFF_JOURNEY, '--path', 'main', '--position', String(i + 1), '--carries_out', s.carries));
}

/**
 * A journey's proof as counts, from either wording: a page's "11 steps · 3 proved · journey test not proved" or the
 * Trace box's "11 steps · 3 proved · test ✗".
 */
function proofOf(text: string) {
  const test = /no (journey )?test/.test(text) ? 'none' : /test (✓|proved)/.test(text) ? 'proved' : /test (✗|not proved)/.test(text) ? 'not proved' : null;
  return {
    steps: text.match(/(\d+) steps?\b/)?.[1] ?? null,
    proved: text.match(/(\d+) proved/)?.[1] ?? null,
    unlinked: text.match(/(\d+) (carrying out nothing yet|unlinked)/)?.[1] ?? '0',
    test,
  };
}

/** Whether a Trace line starts at the journey: its box, or one of its steps' boxes while it is open. */
const fromJourney = (scene: TraceScene, from: string, journey: string) => {
  const id = scene.boxes.find((b) => b.key === from)?.id;
  return from === `journey/${journey}` || (!!id && id.startsWith(`${journey}-S`));
};

test.describe('Journeys', () => {
  test('LA-V156-R04-T02 a journey lists its steps in order, and a step leads to its use case and back by In journeys', async ({ page }) => {
    await openPage(page, JOURNEY);
    await showCard(page, 'whole');
    const steps = page.locator(`${WIKI} [data-aggregate="journey"] ol.journey-steps`).first();
    await expect(steps.locator('li.journey-step').first()).toBeVisible();
    const order = await steps.locator('li.journey-step .step-order').allTextContents();
    expect(order.map(Number)).toEqual([...order].map(Number).sort((a, b) => a - b));
    // The first step that carries out a use case leads to it.
    const link = steps.locator('.journey-carries a.record-link').first();
    const target = (await link.getAttribute('href'))!;
    await link.click();
    await page.waitForURL((u) => u.pathname === target);
    // Its In journeys fact leads back to the journey.
    await showCard(page, 'whole');
    const back = page.locator(`${WIKI} .in-journeys a.record-link[href="${JOURNEY}"]`).first();
    await expect(back).toBeVisible();
    await back.click();
    await page.waitForURL((u) => u.pathname === JOURNEY);
  });

  test('LA-V156-R02-T02 a step moves down and up again, the page holding still', async ({ page }) => {
    const restore = keepData();
    try {
      await openPage(page, JOURNEY);
      await showCard(page, 'whole');
      const first = page.locator(`${WIKI} ol.journey-steps`).first().locator('li.journey-step').first();
      const id = (await first.getAttribute('data-step'))!;
      await first.getByRole('button', { name: `Move down ${id}` }).click();
      await expect(page.locator(`${WIKI} ol.journey-steps`).first().locator('li.journey-step').nth(1)).toHaveAttribute('data-step', id);
      await page.locator(`${WIKI} ol.journey-steps`).first().locator('li.journey-step').nth(1).getByRole('button', { name: `Move up ${id}` }).click();
      await expect(page.locator(`${WIKI} ol.journey-steps`).first().locator('li.journey-step').first()).toHaveAttribute('data-step', id);
    } finally {
      restore();
    }
  });

  test('LA-V101-R13-T02 a use case in a journey shows In journeys', async ({ page }) => {
    await openPage(page, JOURNEY_USE_CASE);
    await showCard(page, 'whole');
    await expect(page.locator(`${WIKI} .in-journeys`).first()).toBeVisible();
  });

  test('LA-EXP-UC16-R01-T01 The Reader reads a journey step by step, and where the acting role changes', async ({ page }) => {
    const restore = keepData();
    try {
      writeHandoffJourney();
      await served(page, HANDOFF_JOURNEY, (j) => j.paths.reduce((n, p) => n + p.steps.length, 0) === MAIN.length + 1);
      await openPage(page, `/${HANDOFF_JOURNEY}`);
      await showCard(page, 'whole');
      const journey = page.locator(`${WIKI} [data-aggregate="journey"]`).first();

      // A list per path, the main path first though its steps were written after the alternate's.
      const paths = journey.locator('section.flow-path');
      await expect(paths).toHaveCount(2);
      await expect(paths.nth(0)).toHaveAttribute('aria-label', 'Main path');
      await expect(paths.nth(1)).toHaveAttribute('aria-label', 'Sent back path');

      // The main path's steps in order, each with what it carries out, who acts and where it sits.
      const main = paths.nth(0).locator('ol.journey-steps > li.journey-step');
      await expect(main).toHaveCount(MAIN.length);
      expect(await main.evaluateAll((els) => els.map((e) => e.getAttribute('data-step')))).toEqual(MAIN.map((s) => s.id));
      expect(await main.locator('.step-order').allTextContents()).toEqual(['1', '2', '3']);
      for (const [i, s] of MAIN.entries()) {
        const step = main.nth(i);
        await expect(step.locator('.journey-carries a.record-link')).toHaveAttribute('href', `/${s.carries}`);
        const kind = step.locator('[data-meta="carries-out-kind"]');
        const actors = step.locator('[data-meta="actors"]');
        const place = step.locator('[data-meta="place"]');
        if (s.carries === POLICY) {
          // A handoff: the product acts, hearing the policy's event and sending its command, in its domain.
          const policy = rows('policy').find((p) => p.id === POLICY)!;
          const hears = rows('hears').find((l) => l.source_id === POLICY)!;
          const domain = rows('domain').find((d) => d.id === POLICY.split('-').slice(0, 2).join('-'))!;
          await expect(kind).toHaveText('Handoff');
          await expect(actors).toHaveText('The product');
          await expect(place).toContainText(`hears ${String(hears.target_id)}`);
          await expect(place).toContainText(`sends ${String(policy.command_id)}`);
          await expect(place).toContainText(String(domain.title));
        } else {
          const useCase = useCaseOf(s.carries);
          await expect(kind).toHaveText(/^use case$/i);
          await expect(actors).toHaveText(useCase.actors.join(', '));
          await expect(place).toHaveText(`${useCase.capability} · ${useCase.domain}`);
        }
      }

      // Where the acting role changes: a lane per actor in the order each first acts, each step's mark in its own lane.
      const lanes = paths.nth(0).locator('.journey-lanes .journey-lane');
      expect(await lanes.locator('.journey-lane-name').allTextContents()).toEqual([useCaseOf(MAIN[0].carries).actors[0], 'The product', useCaseOf(MAIN[2].carries).actors[0]]);
      for (let lane = 0; lane < MAIN.length; lane++) {
        const marks = await lanes.nth(lane).locator('.journey-lane-cell').evaluateAll((cells) => cells.map((c) => c.querySelector('.journey-mark')?.textContent ?? null));
        expect(marks, `lane ${lane + 1}`).toEqual(MAIN.map((_, at) => (at === lane ? String(at + 1) : null)));
      }
      await expect(lanes.nth(1).locator('.journey-mark')).toHaveClass(/is-handoff/);

      // The alternate path after it, its one step with its use case and actors.
      const alternate = paths.nth(1).locator('ol.journey-steps > li.journey-step');
      await expect(alternate).toHaveCount(1);
      await expect(alternate).toHaveAttribute('data-step', ALTERNATE.id);
      await expect(alternate.locator('.journey-carries a.record-link')).toHaveAttribute('href', `/${ALTERNATE.carries}`);
      await expect(alternate.locator('[data-meta="actors"]')).toHaveText(useCaseOf(ALTERNATE.carries).actors.join(', '));
    } finally {
      restore();
    }
  });

  test('LA-EXP-UC16-R02-T01 A use case names the journeys it is a step of, with the steps before and after it', async ({ page }) => {
    const restore = keepData();
    try {
      writeHandoffJourney();
      await served(page, HANDOFF_JOURNEY, (j) => j.paths.reduce((n, p) => n + p.steps.length, 0) === MAIN.length + 1);
      const useCase = JOURNEY_USE_CASE.slice(1);
      for (const id of [useCase, POLICY]) {
        const expected = appearancesOf(id);
        // The use case is a step of Lathe's journeys and of the alternate path; the policy is the handoff.
        expect(expected.length, id).toBeGreaterThanOrEqual(id === POLICY ? 1 : 3);
        expect(new Set(expected.map((a) => a.journey)).size, `${id}: one step per journey`).toBe(expected.length);
        await openPage(page, `/${id}`);
        await showCard(page, 'whole');
        const list = page.locator(`${WIKI} ul.in-journeys[aria-label="Journeys ${id} is a step of"]`).first();
        await expect(list).toBeVisible();
        await expect(list.locator('li[data-journey]')).toHaveCount(expected.length);
        for (const a of expected) {
          const item = list.locator(`li[data-journey="${a.journey}"]`);
          await expect(item, `${id} in ${a.journey}`).toHaveCount(1);
          await expect(item).toContainText(`Step ${a.position} of`);
          await expect(item.locator(`a.record-link[href="/${a.journey}"]`)).toHaveCount(1);
          if (a.path === 'main') await expect(item.locator('[data-meta="path"]')).toHaveCount(0);
          else await expect(item.locator('[data-meta="path"]')).toContainText(`path: ${a.path}`);
          for (const [meta, other] of [['previous', a.before], ['next', a.after]] as const) {
            const link = item.locator(`[data-meta="${meta}"] a.record-link`);
            if (other === null) await expect(link, `${id} ${meta} in ${a.journey}`).toHaveCount(0);
            else await expect(link, `${id} ${meta} in ${a.journey}`).toHaveAttribute('href', `/${String(other)}`);
          }
        }
      }
      // The handoff's next step leads on along the journey.
      const next = page.locator(`${WIKI} ul.in-journeys li[data-journey="${HANDOFF_JOURNEY}"] [data-meta="next"] a.record-link`).first();
      await next.click();
      await page.waitForURL((u) => u.pathname === `/${MAIN[2].id}`);

      // A use case in no journey names none.
      const inSome = new Set(carriesOut().values());
      const alone = rows('use_case').map((u) => String(u.id)).find((u) => !inSome.has(u))!;
      expect(alone).toBeTruthy();
      await openPage(page, `/${alone}`);
      await showCard(page, 'whole');
      await page.locator(`${WIKI} [data-aggregate="use-case"]`).first().waitFor();
      await expect(page.locator(`${WIKI} .in-journeys`)).toHaveCount(0);
    } finally {
      restore();
    }
  });

  test('LA-EXP-UC16-R03-T01 In the graph a journey\'s steps sit under it, in order on each path', async ({ page }) => {
    const restore = keepData();
    try {
      const journey = JOURNEY.slice(1);
      const before = stepsOf(journey).filter((s) => s.path === 'main');
      const last = before[before.length - 1].id;
      expect(last).not.toBe(before[0].id);
      // An Agent moves the last main step first: the steps' order is no longer their IDs'.
      lathe('journey', 'move-journey-step', '--id', last, '--path', 'main', '--position', '1');
      const steps = stepsOf(journey);
      const order = steps.map((s) => s.id);
      expect(order[0]).toBe(last);
      expect(order).not.toEqual([...order].sort());
      await served(page, journey, (j) => j.paths[0]?.steps[0]?.step.id === last);

      await openPage(page, `${JOURNEY}?stage=graph`, `${GRAPH} .graph-box`);
      await graphDrawn(page);
      await page.locator('.focus-stage .graph-layout button', { hasText: 'Map' }).click();
      await graphDrawn(page, 'map', 900);
      const own = new Set(order);
      const expectedThen = steps.slice(1).flatMap((s, i) => (steps[i].path === s.path ? [`${steps[i].id}>${s.id}`] : [])).sort();
      const thenLines = async () => (await sceneOf(page)).lines.filter((l) => l.id.includes('|then|') && own.has(l.source)).map((l) => `${l.source}>${l.target}`).sort();
      await expect.poll(thenLines, { timeout: 10_000 }).toEqual(expectedThen);

      // Each step nested in the journey's box, laid out in path and position order: rows left to right, top to bottom.
      const s = await sceneOf(page);
      const box = s.boxes.find((b) => b.id === journey);
      expect(box, `${journey} is drawn`).toBeTruthy();
      const outer = box!.map;
      const placed = order.map((id) => ({ id, at: s.boxes.find((b) => b.id === id)?.map }));
      for (const { id, at } of placed) {
        expect(at, `${id} is drawn`).toBeTruthy();
        const inside = at!.x >= outer.x - 0.5 && at!.y >= outer.y - 0.5 && at!.x + at!.w <= outer.x + outer.w + 0.5 && at!.y + at!.h <= outer.y + outer.h + 0.5;
        expect(inside, `${id} inside ${journey}`).toBe(true);
      }
      const reading = [...placed].sort((a, b) => Math.round(a.at!.y) - Math.round(b.at!.y) || a.at!.x - b.at!.x).map((p) => p.id);
      expect(reading).toEqual(order);

      // Framing the journey draws each step's line to what it carries out.
      const out = carriesOut();
      const expectedCarries = order.filter((id) => out.has(id)).map((id) => `${id}>${out.get(id)}`).sort();
      expect(expectedCarries.length).toBeGreaterThan(1);
      expect(s.lines.filter((l) => l.id.includes('|carries_out|') && own.has(l.source)).map((l) => `${l.source}>${l.target}`).sort()).toEqual(expectedCarries);
    } finally {
      restore();
    }
  });

  test('LA-TRC-UC22-R02-T01 A journey\'s proof shows with the journey, with its outcome and between the outcomes and use cases of the trace', async ({ page }) => {
    const journey = JOURNEY.slice(1);
    const outcomes = rows('serves').filter((l) => l.source_id === journey).map((l) => String(l.target_id));
    expect(outcomes.length).toBeGreaterThan(0);

    // With the journey: its proof line on its page.
    await openPage(page, JOURNEY);
    await showCard(page, 'whole');
    const line = page.locator(`${WIKI} [data-aggregate="journey"] .journey-proof-line`).first();
    await expect(line).toBeVisible();
    const words = (await line.textContent())!.replace(/^(✓ Proved|Not proved yet): /, '');
    const proof = proofOf(words);
    expect(proof.steps).toBe(String(stepsOf(journey).length));
    expect(proof.proved).not.toBeNull();
    expect(proof.test).not.toBeNull();

    // With each outcome it serves: the same line.
    for (const outcome of outcomes) {
      await openPage(page, `/${outcome}`);
      await showCard(page, 'whole');
      const row = page.locator(`${WIKI} .outcome-journeys .journey-line[data-journey="${journey}"] [data-meta="proof"]`).first();
      await expect(row, outcome).toBeVisible();
      expect((await row.textContent())!.replace(/^✓ /, ''), outcome).toBe(words);
    }

    // In the trace, between the outcomes and the use cases: its box with the same proof, a line from each outcome it
    // serves to it, and from it to each use case its steps carry out.
    await openPage(page, `${JOURNEY}?stage=trace`);
    await traceDrawn(page, 900);
    await expect.poll(async () => (await traceSceneOf(page, true)).boxes.some((b) => b.key === `journey/${journey}`), { timeout: 10_000 }).toBe(true);
    const trace = await traceSceneOf(page, true);
    const traced = trace.boxes.find((b) => b.key === `journey/${journey}`)!;
    expect(proofOf(traced.status)).toEqual(proof);
    for (const outcome of outcomes) {
      expect(trace.lines.some((l) => l.kind === 'serves' && l.from === `outcome/${outcome}` && l.to === `journey/${journey}`), `${outcome} to ${journey}`).toBe(true);
    }
    const useCases = new Set(rows('use_case').map((u) => String(u.id)));
    const out = carriesOut();
    const carried = [...new Set(stepsOf(journey).map((s) => out.get(s.id)).filter((id): id is string => !!id && useCases.has(id)))];
    expect(carried.length).toBeGreaterThan(1);
    for (const useCase of carried) {
      expect(trace.lines.some((l) => l.kind === 'carries' && fromJourney(trace, l.from, journey) && l.to === `${useCase}|use-case`), `${journey} to ${useCase}`).toBe(true);
    }

    // And each use case shows in its trace the journeys it is a step of.
    const useCase = JOURNEY_USE_CASE.slice(1);
    const journeys = [...new Set(appearancesOf(useCase).map((a) => a.journey))];
    expect(journeys.length).toBeGreaterThan(1);
    await openPage(page, `${JOURNEY_USE_CASE}?stage=trace`);
    await traceDrawn(page, 900);
    const own = await traceSceneOf(page, true);
    for (const j of journeys) {
      expect(own.lines.some((l) => l.kind === 'carries' && fromJourney(own, l.from, j) && l.to === `${useCase}|use-case`), `${j} to ${useCase}`).toBe(true);
    }
  });
});
