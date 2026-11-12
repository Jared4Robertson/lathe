// The record-keeping use cases of Use case writing (LA-UCS-UC101 to UC119): an Agent or the Owner changes or removes a
// use case's requirement, flow, step or test, or a pattern, its rules, rule tests and slots, each through the
// aggregate's own command, which is refused with its reason when it names a record that is not there and changes
// nothing, and is applied otherwise.
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_FLOW_STEP } from '../../../src/use-cases/use-case/commands/add-flow-step.ts';
import { ADD_UC_REQUIREMENT } from '../../../src/use-cases/use-case/commands/add-uc-requirement.ts';
import { ADD_SLOT } from '../../../src/use-cases/pattern/commands/add-slot.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { everyKind } from '../../store/fixture.ts';
import { writeData } from '../../helpers.ts';
import { librarianAction } from '../../use-cases/pattern/data-set.ts';
import { keep } from './keep.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

const opened = async (store: Promise<Store>): Promise<Store> => {
  const s = await store;
  open.push(s);
  return s;
};

/** The data of every kind: TL-LEND-UC01 with its requirement R01 and the test of it, its flow, step S01 and flow test. */
const useCase = () => opened(openStore(writeData(everyKind()), { latheDataDir: null }));
/** The same, with a second requirement, R02, that no step fulfills. */
const withSecondRequirement = async () => {
  const store = await useCase();
  await runCommand(store, ADD_UC_REQUIREMENT, { id: 'TL-LEND-UC01-R02', title: 'A late tool is fined', use_case_id: 'TL-LEND-UC01', statement: 'A late tool MUST be fined.' });
  return store;
};
/** The same, with a second step, S02, on the main path. */
const withSecondStep = async () => {
  const store = await useCase();
  await runCommand(store, ADD_FLOW_STEP, { id: 'TL-LEND-UC01-FL-S02', title: 'Take it home', flow_id: 'TL-LEND-UC01-FL', path: 'main', position: 2 });
  return store;
};
/** One pattern, TL-PAT-ACT, with a rule and its test. */
const pattern = () => opened(librarianAction());
/** The same, with a slot, TL-PAT-ACT-SL01. */
const withSlot = async () => {
  const store = await pattern();
  await runCommand(store, ADD_SLOT, { id: 'TL-PAT-ACT-SL01', title: 'Refusal message', pattern_id: 'TL-PAT-ACT', statement: 'A fill MUST word the refusal for the librarian.' });
  return store;
};

describe('the commands that keep a use case, its requirements and its flow', () => {
  it('LA-UCS-UC101-R01-T01 LA-UCS-UC101-FL-T Change a use case is refused for one that is not there, or applied', () =>
    keep({ set: useCase, command: 'LA-UCS-CMD101', table: 'use_case', input: { id: 'TL-LEND-UC01', notes: 'Late returns are fined.' }, missing: { id: 'TL-LEND-UC09', notes: 'x' }, applied: (s) => expect(s.record('TL-LEND-UC01')?.row).toMatchObject({ notes: 'Late returns are fined.' }) }));
  it('LA-UCS-UC102-R01-T01 LA-UCS-UC102-FL-T Add a UC requirement is refused for a use case that is not there, or applied', () =>
    keep({ set: useCase, command: 'LA-UCS-CMD104', table: 'uc_requirement', input: { id: 'TL-LEND-UC01-R02', title: 'A late tool is fined', use_case_id: 'TL-LEND-UC01', statement: 'A late tool MUST be fined.' }, missing: { id: 'TL-LEND-UC09-R01', title: 'x', use_case_id: 'TL-LEND-UC09', statement: 'x MUST y.' }, applied: (s) => expect(s.record('TL-LEND-UC01-R02')?.row).toMatchObject({ use_case_id: 'TL-LEND-UC01' }) }));
  it('LA-UCS-UC103-R01-T01 LA-UCS-UC103-FL-T Change a UC requirement is refused for one that is not there, or applied', () =>
    keep({ set: useCase, command: 'LA-UCS-CMD105', table: 'uc_requirement', input: { id: 'TL-LEND-UC01-R01', group_name: 'Errors' }, missing: { id: 'TL-LEND-UC01-R09', group_name: 'Errors' }, applied: (s) => expect(s.record('TL-LEND-UC01-R01')?.row).toMatchObject({ group_name: 'Errors' }) }));
  it('LA-UCS-UC104-R01-T01 LA-UCS-UC104-FL-T Remove a UC requirement is refused for one that is not there, or applied', () =>
    keep({ set: withSecondRequirement, command: 'LA-UCS-CMD106', table: 'uc_requirement', input: { id: 'TL-LEND-UC01-R02' }, missing: { id: 'TL-LEND-UC01-R09' }, applied: (s) => expect(s.record('TL-LEND-UC01-R02')).toBeUndefined() }));
  it('LA-UCS-UC105-R01-T01 LA-UCS-UC105-FL-T Change a flow is refused for one that is not there, or applied', () =>
    keep({ set: useCase, command: 'LA-UCS-CMD108', table: 'flow', input: { id: 'TL-LEND-UC01-FL', title: 'Borrow a tool today' }, missing: { id: 'TL-LEND-UC09-FL', title: 'x' }, applied: (s) => expect(s.record('TL-LEND-UC01-FL')?.row).toMatchObject({ title: 'Borrow a tool today' }) }));
  it('LA-UCS-UC106-R01-T01 LA-UCS-UC106-FL-T Change a flow step is refused for one that is not there, or applied', () =>
    keep({ set: useCase, command: 'LA-UCS-CMD111', table: 'flow_step', input: { id: 'TL-LEND-UC01-FL-S01', title: 'Pick a free tool' }, missing: { id: 'TL-LEND-UC01-FL-S09', title: 'x' }, applied: (s) => expect(s.record('TL-LEND-UC01-FL-S01')?.row).toMatchObject({ title: 'Pick a free tool' }) }));
  it('LA-UCS-UC107-R01-T01 LA-UCS-UC107-FL-T Remove a flow step is refused for one that is not there, or applied', () =>
    keep({ set: useCase, command: 'LA-UCS-CMD112', table: 'flow_step', input: { id: 'TL-LEND-UC01-FL-S01' }, missing: { id: 'TL-LEND-UC01-FL-S09' }, applied: (s) => expect(s.record('TL-LEND-UC01-FL-S01')).toBeUndefined() }));
  it('LA-UCS-UC108-R01-T01 LA-UCS-UC108-FL-T Remove a use case test is refused for one that is not there, or applied', () =>
    keep({ set: useCase, command: 'LA-UCS-CMD115', table: 'use_case_test', input: { id: 'TL-LEND-UC01-R01-T01' }, missing: { id: 'TL-LEND-UC01-R01-T09' }, applied: (s) => expect(s.record('TL-LEND-UC01-R01-T01')).toBeUndefined() }));
  it('LA-UCS-UC109-R01-T01 LA-UCS-UC109-FL-T Change a flow test is refused for one that is not there, or applied', () =>
    keep({ set: useCase, command: 'LA-UCS-CMD117', table: 'flow_test', input: { id: 'TL-LEND-UC01-FL-T', file: null, state: 'manual', manual_reason: 'A person walks it.' }, missing: { id: 'TL-LEND-UC09-FL-T', state: 'manual', manual_reason: 'x' }, applied: (s) => expect(s.record('TL-LEND-UC01-FL-T')?.row).toMatchObject({ state: 'manual' }) }));
  it('LA-UCS-UC110-R01-T01 LA-UCS-UC110-FL-T Remove a flow test is refused for one that is not there, or applied', () =>
    keep({ set: useCase, command: 'LA-UCS-CMD118', table: 'flow_test', input: { id: 'TL-LEND-UC01-FL-T' }, missing: { id: 'TL-LEND-UC09-FL-T' }, applied: (s) => expect(s.record('TL-LEND-UC01-FL-T')).toBeUndefined() }));
  it('LA-UCS-UC119-R01-T01 LA-UCS-UC119-FL-T Move a flow step is refused for one that is not there, or applied with the steps renumbered', () =>
    keep({ set: withSecondStep, command: 'LA-UCS-CMD386', table: 'flow_step', input: { id: 'TL-LEND-UC01-FL-S02', position: 1 }, missing: { id: 'TL-LEND-UC01-FL-S09', position: 1 }, applied: (s) => expect(s.rows('flow_step').map((r) => `${String(r.id).split('-').pop()} ${r.position}`).sort()).toEqual(['S01 2', 'S02 1']) }));
});

describe('the commands that keep a pattern, its rules, rule tests and slots', () => {
  it('LA-UCS-UC111-R01-T01 LA-UCS-UC111-FL-T Change a pattern is refused for one that is not there, or applied', () =>
    keep({ set: pattern, command: 'LA-UCS-CMD191', table: 'pattern', input: { id: 'TL-PAT-ACT', description: 'An action at the desk.' }, missing: { id: 'TL-PAT-NOPE', description: 'x' }, applied: (s) => expect(s.record('TL-PAT-ACT')?.row).toMatchObject({ description: 'An action at the desk.' }) }));
  it('LA-UCS-UC112-R01-T01 LA-UCS-UC112-FL-T Remove a pattern is refused for one that is not there, or applied whole', () =>
    keep({ set: pattern, command: 'LA-UCS-CMD192', table: 'pattern', input: { id: 'TL-PAT-ACT' }, missing: { id: 'TL-PAT-NOPE' }, applied: (s) => { for (const id of ['TL-PAT-ACT', 'TL-PAT-ACT-R01', 'TL-PAT-ACT-R01-T01']) expect(s.record(id)).toBeUndefined(); } }));
  it('LA-UCS-UC113-R01-T01 LA-UCS-UC113-FL-T Remove a pattern rule is refused for one that is not there, or applied with its tests', () =>
    keep({ set: pattern, command: 'LA-UCS-CMD195', table: 'pattern_rule', input: { id: 'TL-PAT-ACT-R01' }, missing: { id: 'TL-PAT-ACT-R09' }, applied: (s) => { expect(s.record('TL-PAT-ACT-R01')).toBeUndefined(); expect(s.record('TL-PAT-ACT-R01-T01')).toBeUndefined(); } }));
  it('LA-UCS-UC114-R01-T01 LA-UCS-UC114-FL-T Change a pattern rule test is refused for one that is not there, or applied', () =>
    keep({ set: pattern, command: 'LA-UCS-CMD197', table: 'pattern_rule_test', input: { id: 'TL-PAT-ACT-R01-T01', file: null, state: 'manual', manual_reason: 'A person reads it.' }, missing: { id: 'TL-PAT-ACT-R01-T09', state: 'manual', manual_reason: 'x' }, applied: (s) => expect(s.record('TL-PAT-ACT-R01-T01')?.row).toMatchObject({ state: 'manual' }) }));
  it('LA-UCS-UC115-R01-T01 LA-UCS-UC115-FL-T Remove a pattern rule test is refused for one that is not there, or applied', () =>
    keep({ set: pattern, command: 'LA-UCS-CMD198', table: 'pattern_rule_test', input: { id: 'TL-PAT-ACT-R01-T01' }, missing: { id: 'TL-PAT-ACT-R01-T09' }, applied: (s) => expect(s.record('TL-PAT-ACT-R01-T01')).toBeUndefined() }));
  it('LA-UCS-UC116-R01-T01 LA-UCS-UC116-FL-T Add a slot is refused for a pattern that is not there, or applied', () =>
    keep({ set: pattern, command: 'LA-UCS-CMD373', table: 'slot', input: { id: 'TL-PAT-ACT-SL01', title: 'Refusal message', pattern_id: 'TL-PAT-ACT', statement: 'A fill MUST word the refusal for the librarian.' }, missing: { id: 'TL-PAT-NOPE-SL01', title: 'x', pattern_id: 'TL-PAT-NOPE', statement: 'x MUST y.' }, applied: (s) => expect(s.record('TL-PAT-ACT-SL01')?.row).toMatchObject({ pattern_id: 'TL-PAT-ACT' }) }));
  it('LA-UCS-UC117-R01-T01 LA-UCS-UC117-FL-T Change a slot is refused for one that is not there, or applied', () =>
    keep({ set: withSlot, command: 'LA-UCS-CMD374', table: 'slot', input: { id: 'TL-PAT-ACT-SL01', statement: 'A fill MUST name what was refused.' }, missing: { id: 'TL-PAT-ACT-SL09', statement: 'x MUST y.' }, applied: (s) => expect(s.record('TL-PAT-ACT-SL01')?.row).toMatchObject({ statement: 'A fill MUST name what was refused.' }) }));
  it('LA-UCS-UC118-R01-T01 LA-UCS-UC118-FL-T Remove a slot is refused for one that is not there, or applied', () =>
    keep({ set: withSlot, command: 'LA-UCS-CMD375', table: 'slot', input: { id: 'TL-PAT-ACT-SL01' }, missing: { id: 'TL-PAT-ACT-SL09' }, applied: (s) => expect(s.record('TL-PAT-ACT-SL01')).toBeUndefined() }));
});
