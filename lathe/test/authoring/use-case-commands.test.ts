// The Use case aggregate's commands, queries and refusals (LA-AUT-A11), run on a store as the CLI, the MCP tools and
// the HTTP API run them: each command changes one use case through UseCaseRepository, holds it to its rules before it
// saves, and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_FLOW } from '../../src/authoring/use-case/commands/add-flow.ts';
import { ADD_FLOW_STEP } from '../../src/authoring/use-case/commands/add-flow-step.ts';
import { ADD_UC_REQUIREMENT } from '../../src/authoring/use-case/commands/add-uc-requirement.ts';
import { ADD_USE_CASE } from '../../src/authoring/use-case/commands/add-use-case.ts';
import { CHANGE_FLOW_STEP } from '../../src/authoring/use-case/commands/change-flow-step.ts';
import { CHANGE_USE_CASE } from '../../src/authoring/use-case/commands/change-use-case.ts';
import { CHANGE_USE_CASE_TEST } from '../../src/authoring/use-case/commands/change-use-case-test.ts';
import { MOVE_USE_CASE } from '../../src/authoring/use-case/commands/move-use-case.ts';
import { REMOVE_FLOW } from '../../src/authoring/use-case/commands/remove-flow.ts';
import { REMOVE_UC_REQUIREMENT } from '../../src/authoring/use-case/commands/remove-uc-requirement.ts';
import { REMOVE_USE_CASE } from '../../src/authoring/use-case/commands/remove-use-case.ts';
import { REMOVE_USE_CASE_TEST } from '../../src/authoring/use-case/commands/remove-use-case-test.ts';
import { GET_USE_CASE, LIST_USE_CASES, NEXT_USE_CASE_ID } from '../../src/authoring/use-case/queries.ts';
import { UseCaseRepository } from '../../src/authoring/use-case/repository.ts';
import { InputError, type AnyCommand } from '../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../src/platform/commands/run.ts';
import { DataFiles } from '../../src/platform/data/data-files.ts';
import { StoreError } from '../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../src/platform/data/store.ts';
import { everyKind, type Data } from '../store/fixture.ts';
import { writeData } from '../helpers.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

/** A store on the data, with a second use case, UC02, that nothing outside it references. */
async function storeOf(data: Data = everyKind()): Promise<Store> {
  const store = await openStore(writeData(data), { latheDataDir: null });
  open.push(store);
  await runCommand(store, ADD_USE_CASE, { id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'Bring a borrowed tool back.', actors: ['Member'] });
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

const fileOf = (store: Store, table: string) => readFileSync(path.join(store.dataDir, `${table}.jsonl`), 'utf8');

describe('LA-AUT-UC06-R12-T01 each Use case command (LA-AUT-A11) changes one use case through UseCaseRepository, held to its rules', () => {
  it('adds a use case whole with its actors, and writes only its own tables', async () => {
    const store = await storeOf();
    const committed = await runCommand(store, CHANGE_USE_CASE, { id: 'TL-LEND-UC02', notes: 'Late returns are fined.', actors: ['Member', 'Librarian'] });
    expect(committed.tables).toEqual(['use_case', 'use_case_actor']);
    expect(store.rows('use_case_actor').filter((a) => a.use_case_id === 'TL-LEND-UC02')).toEqual([
      { use_case_id: 'TL-LEND-UC02', position: 1, role_name: 'Member' },
      { use_case_id: 'TL-LEND-UC02', position: 2, role_name: 'Librarian' },
    ]);
    // null clears an optional column; a field left out keeps its value.
    await runCommand(store, CHANGE_USE_CASE, { id: 'TL-LEND-UC02', notes: null });
    expect(store.record('TL-LEND-UC02')?.row).toEqual({ id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'Bring a borrowed tool back.' });
  });

  it('adds a requirement, a flow and a step with its links, and reads the use case whole by any record in it', async () => {
    const store = await storeOf();
    await runCommand(store, ADD_UC_REQUIREMENT, { id: 'TL-LEND-UC02-R01', title: 'Tool is on loan', use_case_id: 'TL-LEND-UC02', statement: 'The library MUST refuse a tool not on loan.' });
    await runCommand(store, ADD_FLOW, { id: 'TL-LEND-UC02-FL', title: 'Return a tool', use_case_id: 'TL-LEND-UC02' });
    const step = { id: 'TL-LEND-UC02-FL-S01', title: 'Scan the tool', flow_id: 'TL-LEND-UC02-FL', path: 'main', position: 1, fulfills: ['TL-LEND-UC02-R01'], interface_id: 'TL-IF01' };
    const committed = await runCommand(store, ADD_FLOW_STEP, step);
    expect(committed.tables).toEqual(['flow_step', 'fulfills']);
    const whole = runQuery(store, GET_USE_CASE, { id: 'TL-LEND-UC02-FL-S01' }) as ReturnType<typeof GET_USE_CASE.run>;
    expect(whole.record).toEqual({ id: 'TL-LEND-UC02-FL-S01', kind: 'flow_step' });
    expect(whole.useCase.id).toBe('TL-LEND-UC02');
    const added = { step: { id: step.id, title: step.title, flow_id: step.flow_id, path: 'main', position: 1, interface_id: 'TL-IF01' }, fulfills: ['TL-LEND-UC02-R01'], invokes: null, exchangesWith: [] };
    expect(whole.flows).toEqual([{ flow: expect.objectContaining({ id: 'TL-LEND-UC02-FL' }), paths: [{ name: 'main', steps: [added] }], test: null, through: [] }]);
    expect(whole.requirements).toEqual([{ requirement: expect.objectContaining({ id: 'TL-LEND-UC02-R01' }), tests: [], fulfilledBy: [step.id] }]);
    expect(runQuery(store, LIST_USE_CASES, { capability_id: 'TL-LEND-CAP01' })).toEqual([
      { id: 'TL-LEND-UC01', title: 'Borrow a tool' },
      { id: 'TL-LEND-UC02', title: 'Return a tool' },
    ]);
    expect(runQuery(store, NEXT_USE_CASE_ID, { kind: 'flow_step', parent: 'TL-LEND-UC02-FL' })).toBe('TL-LEND-UC02-FL-S02');
    expect(runQuery(store, NEXT_USE_CASE_ID, { kind: 'use_case', parent: 'TL-LEND-CAP01' })).toBe('TL-LEND-UC03');
    expect(runQuery(store, NEXT_USE_CASE_ID, { kind: 'flow_test', parent: 'TL-LEND-UC02-FL' })).toBe('TL-LEND-UC02-FL-T');
    expect(() => runQuery(store, NEXT_USE_CASE_ID, { kind: 'flow', parent: 'TL-LEND-UC02' })).toThrow(/TL-LEND-UC02 already has its flow, TL-LEND-UC02-FL/);
  });

  it('LA-AUT-UC06-R10-T01 reads the use case with each offering interface\'s version of its flow, derived: where each step is carried out, the actor and the variants left out', async () => {
    const data = everyKind();
    data.interface = [...data.interface, { id: 'TL-IF02', title: 'CLI', product_id: 'TL', kind: 'API', description: 'The HTTP API.', public: false }];
    data.interface_actor = [...data.interface_actor, { interface_id: 'TL-IF02', position: 1, role_name: 'Librarian' }, { interface_id: 'TL-IF02', position: 2, role_name: 'Member' }];
    data.offers = [...data.offers, { source_id: 'TL-IF02', target_id: 'TL-LEND-UC01' }];
    data.flow_step = [...data.flow_step.map(({ interface_id: _, ...step }) => step), { id: 'TL-LEND-UC01-FL-S02', title: 'Open the app', flow_id: 'TL-LEND-UC01-FL', path: 'main', position: 2, interface_id: 'TL-IF01' }];
    const store = await storeOf(data);
    const [flow] = (runQuery(store, GET_USE_CASE, { id: 'TL-LEND-UC01' }) as ReturnType<typeof GET_USE_CASE.run>).flows;
    expect(flow.through.map((t) => [t.interface, t.kind, t.actor])).toEqual([['TL-IF01', 'web app', 'Member'], ['TL-IF02', 'API', 'Member']]);
    // The web app carries step 1 out in the view that presents its command, and has its own variant, step 2; the API has an endpoint for the command and leaves the variant out.
    expect(flow.through[0].paths).toEqual([{ name: 'main', steps: [{ id: 'TL-LEND-UC01-FL-S01', reach: ['TL-V01'], unreached: false }, { id: 'TL-LEND-UC01-FL-S02', reach: [], unreached: false }] }]);
    expect(flow.through[1].paths).toEqual([{ name: 'main', steps: [{ id: 'TL-LEND-UC01-FL-S01', reach: ['TL-LEND-EP01'], unreached: false }] }]);
  });

  it('refuses an Add whose ID its own use case already holds, even with the same content, and changes no file', async () => {
    const store = await storeOf();
    const requirement = { id: 'TL-LEND-UC02-R01', title: 'Tool is on loan', use_case_id: 'TL-LEND-UC02', statement: 'The library MUST refuse a tool not on loan.' };
    await runCommand(store, ADD_UC_REQUIREMENT, requirement);
    const before = fileOf(store, 'uc_requirement');
    const refused = await refusal(store, ADD_UC_REQUIREMENT, requirement);
    expect(refused.problems).toEqual([expect.objectContaining({ rule: 'primary-key', message: 'uc_requirement TL-LEND-UC02-R01 already exists' })]);
    expect(fileOf(store, 'uc_requirement')).toBe(before);
  });

  it('changes a step\'s links: a list replaces the list, null clears a single link', async () => {
    const store = await storeOf();
    const stepOf = () => (runQuery(store, GET_USE_CASE, { id: 'TL-LEND-UC01' }) as ReturnType<typeof GET_USE_CASE.run>).flows[0].paths[0].steps[0];
    await runCommand(store, CHANGE_FLOW_STEP, { id: 'TL-LEND-UC01-FL-S01', interface_id: 'TL-IF01' });
    expect(stepOf().step.interface_id).toBe('TL-IF01');
    await runCommand(store, CHANGE_FLOW_STEP, { id: 'TL-LEND-UC01-FL-S01', interface_id: null, exchanges_with: [], position: 1 });
    const step = stepOf();
    expect(step.step.interface_id ?? null).toBeNull();
    expect(step).toMatchObject({ exchangesWith: [], invokes: 'TL-LEND-CMD01', fulfills: ['TL-LEND-UC01-R01'] });
  });

  it('refuses a step fulfilling another use case\'s requirement, with its reason, and changes no file', async () => {
    const store = await storeOf();
    const before = fileOf(store, 'fulfills');
    await runCommand(store, ADD_UC_REQUIREMENT, { id: 'TL-LEND-UC02-R01', title: 'Tool is on loan', use_case_id: 'TL-LEND-UC02', statement: 'The library MUST refuse a tool not on loan.' });
    const refused = await refusal(store, CHANGE_FLOW_STEP, { id: 'TL-LEND-UC01-FL-S01', fulfills: ['TL-LEND-UC01-R01', 'TL-LEND-UC02-R01'] });
    expect(refused.problems).toEqual([
      expect.objectContaining({ rule: 'step-fulfills-own-use-case', message: 'TL-LEND-UC01-FL-S01 is a step of the flow of TL-LEND-UC01, so it cannot fulfill TL-LEND-UC02-R01, a requirement of TL-LEND-UC02' }),
    ]);
    expect(fileOf(store, 'fulfills')).toBe(before);
  });

  it('LA-AUT-INV42-T refuses a flow whose ID is not its use case\'s and FL', async () => {
    const store = await storeOf();
    const refused = await refusal(store, ADD_FLOW, { id: 'TL-LEND-UC02-FL02', title: 'Return a tool', use_case_id: 'TL-LEND-UC02' });
    expect(refused.problems).toEqual([expect.objectContaining({ rule: 'flow-id', message: 'TL-LEND-UC02-FL02 is the flow of TL-LEND-UC02, so its ID is TL-LEND-UC02-FL' })]);
  });

  it('moves a use case under another capability, with what is in it', async () => {
    const data = everyKind();
    data.capability = [...data.capability, { id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 2, description: 'Taking tools back.' }];
    const store = await storeOf(data);
    const committed = await runCommand(store, MOVE_USE_CASE, { id: 'TL-LEND-UC02', capability_id: 'TL-LEND-CAP02' });
    expect(committed.changes).toEqual([expect.objectContaining({ table: 'use_case', key: 'TL-LEND-UC02', after: expect.objectContaining({ capability_id: 'TL-LEND-CAP02' }) })]);
    expect((await refusal(store, MOVE_USE_CASE, { id: 'TL-LEND-UC02', capability_id: 'TL-LEND-CAP02' })).problems[0].rule).toBe('parent');
  });

  it('refuses an input that is not the command\'s: an unknown field, a missing one, a wrong type, or a field that cannot be cleared', async () => {
    const store = await storeOf();
    await expect(runCommand(store, ADD_UC_REQUIREMENT, { id: 'TL-LEND-UC02-R01', title: 'x', use_case_id: 'TL-LEND-UC02' })).rejects.toThrow(new InputError('add-uc-requirement needs statement'));
    await expect(runCommand(store, CHANGE_USE_CASE, { id: 'TL-LEND-UC02', capability_id: 'TL-LEND-CAP01' })).rejects.toThrow(/change-use-case takes no capability_id/);
    await expect(runCommand(store, CHANGE_USE_CASE_TEST, { id: 'TL-LEND-UC01-R01-T01', level: 'sometimes' })).rejects.toThrow(/level "sometimes" is not one of/);
    await expect(runCommand(store, CHANGE_USE_CASE, { id: 'TL-LEND-UC02', goal: null })).rejects.toThrow(/goal cannot be cleared/);
    expect((await refusal(store, CHANGE_USE_CASE, { id: 'TL-LEND-UC09', title: 'Nothing' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no use case TL-LEND-UC09' });
    expect((await refusal(store, ADD_USE_CASE, { id: 'TL-LEND-UC02', title: 'Again', capability_id: 'TL-LEND-CAP01', goal: 'Twice.' })).problems[0].rule).toBe('primary-key');
  });

  it('refuses a repository\'s write to a table it does not own, when it is made', async () => {
    const store = await storeOf();
    const refused = await store
      .transact((tx) => {
        new UseCaseRepository(tx).load('TL-LEND-UC01');
        new DataFiles(tx, 'UseCaseRepository', ['use_case']).put('domain', { id: 'TL-X', title: 'X', product_id: 'TL', subdomain_type: 'core', description: 'X.' });
      })
      .catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(StoreError);
    expect((refused as StoreError).problems[0]).toMatchObject({ rule: 'repository-scope', message: 'UseCaseRepository loads and saves only its own tables (use_case); domain is not one of them' });
  });
});

describe('LA-AUT-UC06-R13-T01 a use case, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
  it('removes a use case whole, and refuses one while another aggregate references what is in it', async () => {
    const store = await storeOf();
    await runCommand(store, ADD_UC_REQUIREMENT, { id: 'TL-LEND-UC02-R01', title: 'Tool is on loan', use_case_id: 'TL-LEND-UC02', statement: 'The library MUST refuse a tool not on loan.' });
    await runCommand(store, ADD_FLOW, { id: 'TL-LEND-UC02-FL', title: 'Return a tool', use_case_id: 'TL-LEND-UC02' });
    await runCommand(store, ADD_FLOW_STEP, { id: 'TL-LEND-UC02-FL-S01', title: 'Scan the tool', flow_id: 'TL-LEND-UC02-FL', path: 'main', position: 1, fulfills: ['TL-LEND-UC02-R01'] });
    const removed = await runCommand(store, REMOVE_USE_CASE, { id: 'TL-LEND-UC02' });
    expect(removed.changes.filter((c) => c.after === null).map((c) => `${c.table} ${c.key}`).sort()).toEqual([
      'flow TL-LEND-UC02-FL',
      'flow_step TL-LEND-UC02-FL-S01',
      'fulfills source_id TL-LEND-UC02-FL-S01, target_id TL-LEND-UC02-R01',
      'uc_requirement TL-LEND-UC02-R01',
      'use_case TL-LEND-UC02',
      'use_case_actor use_case_id TL-LEND-UC02, position 1',
    ]);
    // UC01 is followed (TRC-A3's link) and asked about (A1's question): it stays, and the refusal names both.
    const refused = await refusal(store, REMOVE_USE_CASE, { id: 'TL-LEND-UC01' });
    expect(refused.problems).toEqual([expect.objectContaining({ rule: 'referenced' })]);
    expect(refused.problems[0].message).toMatch(/^Use case TL-LEND-UC01 is referenced, so it stays: /);
    expect(refused.problems[0].message).toContain('TL-LEND-UC01 follows TL-PAT-ACT');
    expect(refused.problems[0].message).toContain('TL-LEND-Q01 about TL-LEND-UC01');
  });

  it('refuses removing a requirement a step fulfills, and removes a flow with its steps and test', async () => {
    const store = await storeOf();
    const refused = await refusal(store, REMOVE_UC_REQUIREMENT, { id: 'TL-LEND-UC01-R01' });
    expect(refused.problems[0]).toMatchObject({ rule: 'referenced', message: 'UC requirement TL-LEND-UC01-R01 is referenced, so it stays: TL-LEND-UC01-FL-S01 fulfills TL-LEND-UC01-R01' });
    const removed = await runCommand(store, REMOVE_FLOW, { id: 'TL-LEND-UC01-FL' });
    expect(removed.changes.filter((c) => c.after === null).map((c) => c.table).sort()).toEqual(['exchanges_with', 'flow', 'flow_step', 'flow_test', 'fulfills', 'invokes']);
  });

  it('refuses removing a use case test a business outcome is measured by', async () => {
    const data = everyKind();
    data.measured_by = [...data.measured_by, { source_id: 'TL-BO01', target_id: 'TL-LEND-UC01-R01-T01' }];
    const store = await storeOf(data);
    const refused = await refusal(store, REMOVE_USE_CASE_TEST, { id: 'TL-LEND-UC01-R01-T01' });
    expect(refused.problems[0].message).toBe('Use case test TL-LEND-UC01-R01-T01 is referenced, so it stays: TL-BO01 measured by TL-LEND-UC01-R01-T01');
  });
});
