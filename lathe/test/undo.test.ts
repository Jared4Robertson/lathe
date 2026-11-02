// Undo a turn (LA-PLT-UC27-R01): the plan made from the rows before a turn, the rows now and the order its commands
// touched the records in rolls the data back through the aggregates' own commands, in one write; what something since
// depends on is refused with the reason, and nothing changes.
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_BUSINESS_OUTCOME } from '../src/product/business-outcome/commands/add-business-outcome.ts';
import { CHANGE_BUSINESS_OUTCOME } from '../src/product/business-outcome/commands/change-business-outcome.ts';
import { REMOVE_BUSINESS_OUTCOME } from '../src/product/business-outcome/commands/remove-business-outcome.ts';
import { ALL_COMMANDS } from '../src/commands.ts';
import { runCommand, runConditionally } from '../src/platform/commands/run.ts';
import { StoreError } from '../src/platform/data/problems.ts';
import type { Row } from '../src/platform/data/rows.ts';
import { openStore, type Store } from '../src/platform/data/store.ts';
import { planUndo } from '../src/server/undo.ts';
import { writeData, type Data } from './store/fixture.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

const base = (): Data => ({
  product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }],
  domain: [{ id: 'TL-LEND', title: 'Lending', product_id: 'TL', position: 1, subdomain_type: 'core', description: 'Lending tools.' }],
  capability: [{ id: 'TL-LEND-CAP01', title: 'Lending', domain_id: 'TL-LEND', position: 1, description: 'Lending tools and taking them back.' }],
  domain_service: [{ id: 'TL-LEND-DS01', title: 'Late fee', domain_id: 'TL-LEND', statement: 'The fee MUST be a day rate times the days late.' }],
  domain_service_test: [{ id: 'TL-LEND-DS01-T01', title: 'Fee for three days', domain_service_id: 'TL-LEND-DS01', level: 'unit', state: 'automated', file: 'test/fee.test.ts', when: 'Three days late.', then: 'Three day rates.' }],
});

const outcome = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: `Outcome ${id}`, product_id: 'TL', statement: 'Members borrow more.', measure: 'Loans per month.', target: 'Two a month.', measured_outside: 'Counted by hand.', ...extra });

const tablesOf = (store: Store): Record<string, Row[]> =>
  Object.fromEntries(Object.entries(store.schema.tables).filter(([, t]) => t.stored).map(([name]) => [name, store.rows(name)]));

async function turn() {
  const store = await openStore(writeData(base()), { latheDataDir: null });
  open.push(store);
  await runCommand(store, ADD_BUSINESS_OUTCOME, outcome('TL-BO01', { measured_by: ['TL-LEND-DS01-T01'] }));
  await runCommand(store, ADD_BUSINESS_OUTCOME, outcome('TL-BO02'));
  return { store, before: structuredClone(tablesOf(store)) };
}

describe('LA-PLT-UC27-R01-T03 LA-PAT-HTTP-STEPS-R06-T01 undoing a turn puts back what it removed, changes back what it changed and removes what it added, in one write', () => {
  it('rolls an added, a changed and a removed outcome back to the rows before the turn', async () => {
    const { store, before } = await turn();
    await runCommand(store, ADD_BUSINESS_OUTCOME, outcome('TL-BO03'));
    await runCommand(store, CHANGE_BUSINESS_OUTCOME, { id: 'TL-BO01', title: 'Changed title', measured_by: [], measured_outside: 'Counted again.' });
    await runCommand(store, REMOVE_BUSINESS_OUTCOME, { id: 'TL-BO02' });
    const steps = planUndo(store.schema, before, tablesOf(store), ['TL-BO03', 'TL-BO01', 'TL-BO02']);
    expect(steps.map((s) => `${s.definition.name} ${s.id}`)).toEqual(['add-business-outcome TL-BO02', 'change-business-outcome TL-BO01', 'remove-business-outcome TL-BO03']);
    await runConditionally(store, steps);
    expect(tablesOf(store)).toEqual(before);
  });

  it('refuses, naming every record whose kind has no command to put it back', async () => {
    const { store, before } = await turn();
    const kind = Object.keys(store.schema.kinds).find((k) => !ALL_COMMANDS.some((d) => d.name === `remove-${k.replaceAll('_', '-')}`));
    expect(kind).toBeDefined();
    const added = { id: 'TL-X01', title: 'Made by hand' } as Row;
    expect(() => planUndo(store.schema, before, { ...before, [kind!]: [...(before[kind!] ?? []), added] }, [])).toThrow(/TL-X01: there is no remove-/);
  });

  it('is refused, changing nothing, when something since depends on what it would put back or remove', async () => {
    const { store, before } = await turn();
    // The turn removed an outcome that the test measured; since then the test is gone, so adding the outcome back is refused.
    await runCommand(store, REMOVE_BUSINESS_OUTCOME, { id: 'TL-BO01' });
    const now = structuredClone(tablesOf(store));
    const steps = planUndo(store.schema, before, now, ['TL-BO01']);
    expect(steps.map((s) => s.definition.name)).toEqual(['add-business-outcome']);
    const stale = [{ ...steps[0], input: { ...steps[0].input, measured_by: ['TL-LEND-DS01-T99'] } }];
    await expect(runConditionally(store, stale)).rejects.toBeInstanceOf(StoreError);
    expect(tablesOf(store)).toEqual(now);
  });

  it('skips a step whose record an earlier step removed with its parent', async () => {
    const { store, before } = await turn();
    const steps = planUndo(store.schema, before, before, []);
    expect(steps).toEqual([]);
    await runConditionally(store, [{ definition: REMOVE_BUSINESS_OUTCOME as never, input: { id: 'TL-BO02' }, id: 'TL-BO02', when: 'present' }, { definition: REMOVE_BUSINESS_OUTCOME as never, input: { id: 'TL-BO02' }, id: 'TL-BO02', when: 'present' }]);
    expect(store.rows('business_outcome').map((r) => r.id)).toEqual(['TL-BO01']);
    await expect(runConditionally(store, [{ definition: REMOVE_BUSINESS_OUTCOME as never, input: { id: 'TL-BO99' }, id: 'TL-BO99', when: 'absent' }])).rejects.toBeInstanceOf(StoreError);
  });
});
