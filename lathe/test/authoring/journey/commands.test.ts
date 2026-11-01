// The Journey aggregate's commands, queries and refusals (LA-AUT-A25), run on a store as the CLI, the MCP tools and the
// HTTP API run them: each command changes one journey through JourneyRepository, holds it to its rules before it saves,
// and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_JOURNEY } from '../../../src/authoring/journey/commands/add-journey.ts';
import { ADD_JOURNEY_STEP } from '../../../src/authoring/journey/commands/add-journey-step.ts';
import { ADD_JOURNEY_TEST } from '../../../src/authoring/journey/commands/add-journey-test.ts';
import { CHANGE_JOURNEY } from '../../../src/authoring/journey/commands/change-journey.ts';
import { CHANGE_JOURNEY_STEP } from '../../../src/authoring/journey/commands/change-journey-step.ts';
import { MOVE_JOURNEY_STEP } from '../../../src/authoring/journey/commands/move-journey-step.ts';
import { REMOVE_JOURNEY } from '../../../src/authoring/journey/commands/remove-journey.ts';
import { REMOVE_JOURNEY_STEP } from '../../../src/authoring/journey/commands/remove-journey-step.ts';
import { GET_JOURNEY, LIST_JOURNEYS, NEXT_JOURNEY_ID } from '../../../src/authoring/journey/queries.ts';
import { GET_BUSINESS_OUTCOME } from '../../../src/authoring/business-outcome/queries.ts';
import { GET_COMMAND } from '../../../src/authoring/command/queries.ts';
import { REMOVE_POLICY } from '../../../src/authoring/command/commands/remove-policy.ts';
import { GET_USE_CASE } from '../../../src/authoring/use-case/queries.ts';
import { ADD_USE_CASE } from '../../../src/authoring/use-case/commands/add-use-case.ts';
import { REMOVE_USE_CASE } from '../../../src/authoring/use-case/commands/remove-use-case.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery as run } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { everyKind, type Data } from '../../store/fixture.ts';
import { writeData } from '../../helpers.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

/** The Tool Library's records of every kind, and a second product with an outcome and a use case of its own. */
const base = (): Data => {
  const data = everyKind();
  return {
    ...data,
    product: [...data.product, { id: 'XX', title: 'Other', description: 'Another product.' }],
    domain: [...data.domain, { id: 'XX-DOM', title: 'Other domain', product_id: 'XX', subdomain_type: 'core', description: 'Another domain.' }],
    business_outcome: [...data.business_outcome, { id: 'XX-BO01', title: 'Elsewhere', product_id: 'XX', statement: 'Something elsewhere.', measure: 'A count.', target: 'Ten.' }],
    capability: [...data.capability, { id: 'XX-DOM-CAP01', title: 'Other capability', domain_id: 'XX-DOM', position: 1, description: 'Another capability.' }],
    use_case: [...data.use_case, { id: 'XX-DOM-UC01', title: 'Do something', capability_id: 'XX-DOM-CAP01', goal: 'Do it.' }],
    use_case_actor: [...data.use_case_actor, { use_case_id: 'XX-DOM-UC01', position: 1, role_name: 'Member' }],
  };
};

async function storeOf(data: Data = base()): Promise<Store> {
  const store = await openStore(writeData(data), { latheDataDir: null });
  open.push(store);
  return store;
}

/** The refusal a command gets, or a failure when it is not refused. */
async function refusal(store: Store, definition: AnyCommand, input: unknown): Promise<StoreError> {
  try {
    await runCommand(store, definition, input);
  } catch (error) {
    if (error instanceof StoreError) return error;
    throw error;
  }
  throw new Error(`${definition.name} was not refused`);
}

/** A query's answer, typed by its definition. */
const runQuery = <I, O>(store: Store, definition: { run: (reader: never, input: I) => O }, input: I): O => run(store, definition as never, input) as O;
const rules = (error: StoreError) => error.problems.map((p) => p.rule);
const fileOf = (store: Store, table: string) => readFileSync(path.join(store.dataDir, `${table}.jsonl`), 'utf8');
const step = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: `Step ${id}`, journey_id: 'TL-JR01', path: 'main', position: 2, ...extra });
/** The ids of a journey's steps, path by path, in order. */
const order = (store: Store, id = 'TL-JR01') => runQuery(store, GET_JOURNEY, { id }).paths.map((p) => `${p.name}: ${p.steps.map((s) => s.step.id.split('-').pop()).join(' ')}`);

describe('LA-AUT-UC33-R01-T01 a journey without its trigger or its result, or under another product, is refused', () => {
  it('refuses each with every reason, and adds one with both', async () => {
    const store = await storeOf();
    const before = fileOf(store, 'journey');
    const journey = { id: 'TL-JR02', title: 'Return a tool', product_id: 'TL', trigger: 'A tool comes back.', result: 'The shelf has it.' };
    await expect(runCommand(store, ADD_JOURNEY, { ...journey, trigger: undefined })).rejects.toThrow(InputError);
    await expect(runCommand(store, ADD_JOURNEY, { ...journey, result: '   ' })).rejects.toThrow(InputError);
    expect((await refusal(store, ADD_JOURNEY, { ...journey, id: 'XX-JR01' })).problems.length).toBeGreaterThan(0);
    expect(fileOf(store, 'journey')).toBe(before);
    const committed = await runCommand(store, ADD_JOURNEY, { ...journey, serves: ['TL-BO01'] });
    expect(committed.tables).toEqual(['journey', 'serves']);
    expect(runQuery(store, GET_JOURNEY, { id: 'TL-JR02' })).toMatchObject({ journey: { trigger: 'A tool comes back.' }, serves: ['TL-BO01'], paths: [], test: null });
    expect(runQuery(store, LIST_JOURNEYS, { product_id: 'TL' }).map((j) => j.id)).toEqual(['TL-JR01', 'TL-JR02']);
  });
});

describe('LA-AUT-UC33-R03-T01 moving a step keeps every path of its journey numbered 1, 2, 3', () => {
  it('moves a step within its path and onto another, renumbering both, and refuses a position off the path', async () => {
    const store = await storeOf();
    await runCommand(store, ADD_JOURNEY_STEP, step('TL-JR01-S02', { carries_out: 'TL-LEND-UC01' }));
    await runCommand(store, ADD_JOURNEY_STEP, step('TL-JR01-S03', { position: 3 }));
    await runCommand(store, ADD_JOURNEY_STEP, step('TL-JR01-S04', { path: 'found outside a return', position: 1 }));
    expect(order(store)).toEqual(['main: S01 S02 S03', 'found outside a return: S04']);
    await runCommand(store, MOVE_JOURNEY_STEP, { id: 'TL-JR01-S03', position: 1 });
    expect(order(store)).toEqual(['main: S03 S01 S02', 'found outside a return: S04']);
    await runCommand(store, MOVE_JOURNEY_STEP, { id: 'TL-JR01-S01', path: 'Found Outside A Return', position: 2 });
    expect(order(store)).toEqual(['main: S03 S02', 'found outside a return: S04 S01']);
    expect(store.rows('journey_step').map((s) => `${s.id} ${s.path} ${s.position}`).sort()).toEqual([
      'TL-JR01-S01 found outside a return 2',
      'TL-JR01-S02 main 2',
      'TL-JR01-S03 main 1',
      'TL-JR01-S04 found outside a return 1',
    ]);
    const before = fileOf(store, 'journey_step');
    expect((await refusal(store, MOVE_JOURNEY_STEP, { id: 'TL-JR01-S02', position: 3 })).problems[0].rule).toBe('position');
    expect((await refusal(store, MOVE_JOURNEY_STEP, { id: 'TL-JR01-S09', position: 1 })).problems[0].rule).toBe('missing');
    expect(fileOf(store, 'journey_step')).toBe(before);
    await runCommand(store, REMOVE_JOURNEY_STEP, { id: 'TL-JR01-S04' });
    expect(store.rows('carries_out').map((l) => l.source_id)).toEqual(['TL-JR01-S01', 'TL-JR01-S02']);
  });
});

describe('LA-AUT-INV189-T two steps at one position of a path are refused, the path compared trimmed and in any letter case', () => {
  it('refuses a step at a taken position of a path spelled another way, and allows the same position on another path', async () => {
    const store = await storeOf();
    const refused = await refusal(store, ADD_JOURNEY_STEP, step('TL-JR01-S02', { path: ' Main ', position: 1 }));
    expect(rules(refused)).toEqual(['journey-step-position']);
    expect(refused.problems[0].message).toContain('TL-JR01-S01');
    await runCommand(store, ADD_JOURNEY_STEP, step('TL-JR01-S02', { path: 'other', position: 1 }));
  });
});

describe('LA-AUT-INV187-T a step with an ID that is not its journey\'s and S<nn> is refused', () => {
  it('refuses a step ID of another shape and one under another journey', async () => {
    const store = await storeOf();
    await runCommand(store, ADD_JOURNEY, { id: 'TL-JR02', title: 'Return a tool', product_id: 'TL', trigger: 'A tool comes back.', result: 'The shelf has it.' });
    expect(rules(await refusal(store, ADD_JOURNEY_STEP, step('TL-JR01-X1')))).toContain('journey-step-id');
    expect(rules(await refusal(store, ADD_JOURNEY_STEP, step('TL-JR02-S01')))).toContain('journey-step-id');
    expect(runQuery(store, NEXT_JOURNEY_ID, { kind: 'journey_step', parent: 'TL-JR01' })).toBe('TL-JR01-S02');
    expect(runQuery(store, NEXT_JOURNEY_ID, { kind: 'journey', parent: 'TL' })).toBe('TL-JR03');
  });
});

describe('LA-AUT-INV188-T a journey test with an ID that is not its journey\'s and T is refused', () => {
  it('refuses a test ID of another shape', async () => {
    const store = await storeOf();
    await runCommand(store, REMOVE_JOURNEY_STEP, { id: 'TL-JR01-S01' });
    const test = { title: 'Second', journey_id: 'TL-JR01', level: 'service', state: 'not automated yet', steps: ['Do it'], expected_result: 'Done.' };
    await runCommand(store, ADD_JOURNEY, { id: 'TL-JR02', title: 'Return a tool', product_id: 'TL', trigger: 'A tool comes back.', result: 'The shelf has it.' });
    expect(rules(await refusal(store, ADD_JOURNEY_TEST, { ...test, id: 'TL-JR02-T2', journey_id: 'TL-JR02' }))).toContain('journey-test-id');
    expect(runQuery(store, NEXT_JOURNEY_ID, { kind: 'journey_test', parent: 'TL-JR02' })).toBe('TL-JR02-T');
  });
});

describe('LA-AUT-UC33-R05-T01 a second journey test of a journey is refused', () => {
  it('adds the first with its ID the journey\'s and T, and refuses a second', async () => {
    const store = await storeOf();
    await runCommand(store, ADD_JOURNEY, { id: 'TL-JR02', title: 'Return a tool', product_id: 'TL', trigger: 'A tool comes back.', result: 'The shelf has it.' });
    const test = { id: 'TL-JR02-T', title: 'A tool comes back', journey_id: 'TL-JR02', level: 'service', state: 'not automated yet', steps: ['Return it'], expected_result: 'It is on the shelf.' };
    await runCommand(store, ADD_JOURNEY_TEST, test);
    expect(runQuery(store, GET_JOURNEY, { id: 'TL-JR02-T' })).toMatchObject({ record: { id: 'TL-JR02-T', kind: 'journey_test' }, test: { test: { id: 'TL-JR02-T' } } });
    expect(() => runQuery(store, NEXT_JOURNEY_ID, { kind: 'journey_test', parent: 'TL-JR02' })).toThrow(/already has its journey test/);
    // TL-JR01 already has TL-JR01-T from the data; any second one is refused.
    expect(rules(await refusal(store, ADD_JOURNEY_TEST, { ...test, id: 'TL-JR01-T9', journey_id: 'TL-JR01' }))).toContain('journey-one-each');
  });
});

describe('LA-AUT-INV190-T a journey has one journey test and a step carries out one record', () => {
  it('names the journey and its test when a second is added', async () => {
    const store = await storeOf();
    const error = await refusal(store, ADD_JOURNEY_TEST, { id: 'TL-JR01-T2', title: 'Second', journey_id: 'TL-JR01', level: 'service', state: 'not automated yet', steps: ['Do it'], expected_result: 'Done.' });
    expect(error.problems.find((p) => p.rule === 'journey-one-each')?.message).toContain('journey TL-JR01 already has its journey test');
  });
});

describe('LA-AUT-INV191-T a journey serving another product\'s outcome, or carrying out another product\'s use case, is refused', () => {
  it('names both products', async () => {
    const store = await storeOf();
    const serving = await refusal(store, CHANGE_JOURNEY, { id: 'TL-JR01', serves: ['XX-BO01'] });
    expect(serving.problems.find((p) => p.rule === 'journey-in-product')?.message).toContain('TL');
    const carrying = await refusal(store, CHANGE_JOURNEY_STEP, { id: 'TL-JR01-S01', carries_out: 'XX-DOM-UC01' });
    expect(carrying.problems.map((p) => p.rule)).toContain('journey-in-product');
  });
});

describe('LA-AUT-INV192-T a step carrying out a record that does not exist is refused', () => {
  it('refuses a link to nothing', async () => {
    const store = await storeOf();
    const error = await refusal(store, CHANGE_JOURNEY_STEP, { id: 'TL-JR01-S01', carries_out: 'TL-LEND-UC99' });
    expect(error.problems.length).toBeGreaterThan(0);
  });
});

describe('LA-AUT-UC33-R06-T01 removing a use case a step carries out is refused naming the step, and removing the journey keeps it', () => {
  it('refuses the use case and the policy, removes the journey with its steps and test, then the use case', async () => {
    const store = await storeOf();
    await runCommand(store, ADD_USE_CASE, { id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'Bring a tool back.', actors: ['Member'] });
    await runCommand(store, ADD_JOURNEY_STEP, step('TL-JR01-S02', { carries_out: 'TL-LEND-UC02' }));
    const useCase = await refusal(store, REMOVE_USE_CASE, { id: 'TL-LEND-UC02' });
    expect(useCase.problems.map((p) => p.message).join(' ')).toContain('TL-JR01-S02');
    const policy = await refusal(store, REMOVE_POLICY, { id: 'TL-LEND-PO01' });
    expect(policy.problems.map((p) => p.message).join(' ')).toContain('TL-JR01-S01');
    const removed = await runCommand(store, REMOVE_JOURNEY, { id: 'TL-JR01' });
    expect(removed.tables).toEqual(expect.arrayContaining(['journey', 'journey_step', 'journey_test', 'carries_out']));
    expect(store.rows('journey_step')).toEqual([]);
    expect(store.rows('journey_test')).toEqual([]);
    expect(store.record('TL-LEND-UC02')).toBeDefined();
    await runCommand(store, REMOVE_USE_CASE, { id: 'TL-LEND-UC02' });
  });
});

describe('LA-AUT-UC33-R04-T02 a journey serves its product\'s outcomes, and its pages and its outcome\'s page say so', () => {
  it('reads a journey into the pages of its use case, its policy and its outcome', async () => {
    const store = await storeOf();
    await runCommand(store, CHANGE_JOURNEY, { id: 'TL-JR01', serves: ['TL-BO01'] });
    await runCommand(store, ADD_JOURNEY_STEP, step('TL-JR01-S02', { carries_out: 'TL-LEND-UC01' }));
    const appearance = { journey: { id: 'TL-JR01', title: 'Borrow a tool and bring it back' } };
    expect(runQuery(store, GET_USE_CASE, { id: 'TL-LEND-UC01' }).journeys).toEqual([{ ...appearance, step: { id: 'TL-JR01-S02', title: 'Step TL-JR01-S02' }, path: 'main', position: 2, before: { id: 'TL-JR01-S01', title: 'The library reminds the borrower' }, after: null }]);
    expect(runQuery(store, GET_COMMAND, { id: 'TL-LEND-CMD01' }).policies[0].journeys).toMatchObject([{ ...appearance, step: { id: 'TL-JR01-S01' }, before: null, after: { id: 'TL-JR01-S02' } }]);
    expect(runQuery(store, GET_BUSINESS_OUTCOME, { id: 'TL-BO01' })).toMatchObject({ servedBy: ['TL-LEND-CAP01'], journeys: [{ id: 'TL-JR01', title: 'Borrow a tool and bring it back' }] });
    const page = runQuery(store, GET_JOURNEY, { id: 'TL-JR01-S01' });
    expect(page.record).toEqual({ id: 'TL-JR01-S01', kind: 'journey_step' });
    expect(page.paths[0].steps.map((s) => s.carriesOut)).toMatchObject([
      { kind: 'policy', id: 'TL-LEND-PO01', hears: { id: 'TL-LEND-EV01' }, sends: { id: 'TL-LEND-CMD01' }, domain: { id: 'TL-LEND' } },
      { kind: 'use_case', id: 'TL-LEND-UC01', actors: ['Member'], capability: { id: 'TL-LEND-CAP01' }, domain: { id: 'TL-LEND' } },
    ]);
  });
});
