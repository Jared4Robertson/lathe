// The Standard aggregate's commands, queries and refusals (LA-AUT-A3): each command changes one standard through
// StandardRepository and is refused with its reason, changing nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { CHANGE_STANDARD_RULE } from '../../../src/authoring/standard/commands/change-standard-rule.ts';
import { CHANGE_STANDARD_RULE_TEST } from '../../../src/authoring/standard/commands/change-standard-rule-test.ts';
import { REMOVE_STANDARD } from '../../../src/authoring/standard/commands/remove-standard.ts';
import { REMOVE_STANDARD_RULE } from '../../../src/authoring/standard/commands/remove-standard-rule.ts';
import { GET_STANDARD, LIST_STANDARDS, NEXT_STANDARD_ID } from '../../../src/authoring/standard/queries.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { everyKind } from '../../store/fixture.ts';
import { writeData } from '../../helpers.ts';
import { codeStandard } from './data-set.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

describe('LA-AUT-UC16-R01-T02 each Standard command (LA-AUT-A3) changes one standard through StandardRepository', () => {
  it('builds a standard with its rule and test, reads it whole, and removes it whole', async () => {
    const store = await codeStandard();
    open.push(store);
    expect((runQuery(store, GET_STANDARD, { id: 'TL-STD-CODE-R01' }) as ReturnType<typeof GET_STANDARD.run>).ruleTests.map((t) => t.row.id)).toEqual(['TL-STD-CODE-R01-T01']);
    expect(runQuery(store, LIST_STANDARDS, { product_id: 'TL' })).toEqual([{ id: 'TL-STD-CODE', title: 'Code' }]);
    expect(runQuery(store, NEXT_STANDARD_ID, { kind: 'standard_rule_test', parent: 'TL-STD-CODE-R01' })).toBe('TL-STD-CODE-R01-T02');
    expect((await runCommand(store, CHANGE_STANDARD_RULE, { id: 'TL-STD-CODE-R01', group_name: 'Imports' })).tables).toEqual(['standard_rule']);
    const removed = await runCommand(store, REMOVE_STANDARD, { id: 'TL-STD-CODE' });
    expect(removed.changes.map((c) => c.table).sort()).toEqual(['standard', 'standard_rule', 'standard_rule_test']);
  });

  it('refuses removing a rule a technical record meets, naming it, and a test of a state its file contradicts', async () => {
    const store = await openStore(writeData(everyKind()), { latheDataDir: null });
    open.push(store);
    const refused = (await runCommand(store, REMOVE_STANDARD_RULE, { id: 'TL-STD-CODE-R01' }).catch((error: unknown) => error)) as StoreError;
    expect(refused.problems[0].message).toBe('Standard rule TL-STD-CODE-R01 is referenced, so it stays: TL-LEND-CMD01-H meets TL-STD-CODE-R01');
    const manual = (await runCommand(store, CHANGE_STANDARD_RULE_TEST, { id: 'TL-STD-CODE-R01-T01', state: 'manual' }).catch((error: unknown) => error)) as StoreError;
    expect(manual).toBeInstanceOf(StoreError);
    expect(store.record('TL-STD-CODE-R01-T01')?.row).toMatchObject({ state: 'automated' });
  });

  it('serves the standard_ tools by name', async () => {
    const root = writeData(everyKind());
    expect((await callTool(root, 'standard_add_standard_rule', { id: 'TL-STD-CODE-R02', title: 'Named exports', standard_id: 'TL-STD-CODE', statement: 'Code MUST use named exports.' })).isError).toBeUndefined();
    expect((await callTool(root, 'standard_next_id', { kind: 'standard_rule', parent: 'TL-STD-CODE' })).content[0].text).toBe('TL-STD-CODE-R03');
  });
});
