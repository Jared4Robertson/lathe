// The Test data set aggregate's commands, queries and refusals (LA-AUT-A17): each command changes one test data set
// through TestDataSetRepository and is refused with its reason, changing nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { CHANGE_TEST_DATA_SET } from '../../../src/authoring/test-data-set/commands/change-test-data-set.ts';
import { REMOVE_TEST_DATA_SET } from '../../../src/authoring/test-data-set/commands/remove-test-data-set.ts';
import { GET_TEST_DATA_SET, LIST_TEST_DATA_SETS, NEXT_TEST_DATA_SET_ID } from '../../../src/authoring/test-data-set/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { everyKind } from '../../store/fixture.ts';
import { writeData } from '../../helpers.ts';
import { lendingDataSet } from './data-set.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

describe('LA-AUT-UC13-R08-T02 each Test data set command (LA-AUT-A17) changes one test data set through TestDataSetRepository', () => {
  it('adds, changes and reads a test data set; null clears an optional column; its domain never changes', async () => {
    const store = await lendingDataSet();
    open.push(store);
    expect((runQuery(store, GET_TEST_DATA_SET, { id: 'TL-LEND-TD01' }) as ReturnType<typeof GET_TEST_DATA_SET.run>).testDataSet.records).toBe('One tool, on loan to one member.');
    expect(runQuery(store, LIST_TEST_DATA_SETS, { domain_id: 'TL-LEND' })).toEqual([{ id: 'TL-LEND-TD01', title: 'One tool on loan' }]);
    expect(runQuery(store, NEXT_TEST_DATA_SET_ID, { domain_id: 'TL-LEND' })).toBe('TL-LEND-TD02');
    expect((await runCommand(store, CHANGE_TEST_DATA_SET, { id: 'TL-LEND-TD01', accounts: 'One member.', file: null })).tables).toEqual(['test_data_set']);
    expect(store.record('TL-LEND-TD01')?.row).toMatchObject({ accounts: 'One member.' });
    expect(store.record('TL-LEND-TD01')?.row).not.toHaveProperty('file');
    await expect(runCommand(store, CHANGE_TEST_DATA_SET, { id: 'TL-LEND-TD01', domain_id: 'TL-CAT' })).rejects.toThrow(/takes no domain_id/);
    await runCommand(store, REMOVE_TEST_DATA_SET, { id: 'TL-LEND-TD01' });
    expect(store.rows('test_data_set')).toEqual([]);
  });

  it('refuses removing a test data set a test starts from, naming the test, and changes nothing', async () => {
    const store = await openStore(writeData(everyKind()), { latheDataDir: null });
    open.push(store);
    const refused = await runCommand(store, REMOVE_TEST_DATA_SET, { id: 'TL-LEND-TD01' }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(StoreError);
    expect((refused as StoreError).problems[0].message).toBe('Test data set TL-LEND-TD01 is referenced, so it stays: TL-INT01-T01 starts from TL-LEND-TD01');
    expect(store.record('TL-LEND-TD01')).toBeDefined();
  });

  it('runs `lathe test-data-set <command>` and the test_data_set_ tools by name', async () => {
    const root = writeData(everyKind());
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t), stdin: async () => '' };
    expect(await runAggregateCommand(['test-data-set', 'next-id', '--domain_id', 'TL-LEND', '--root', root], io)).toBe(0);
    expect(out.pop()).toBe('TL-LEND-TD02');
    const added = await callTool(root, 'test_data_set_add_test_data_set', { id: 'TL-LEND-TD02', title: 'No members', domain_id: 'TL-LEND', environment: 'A fresh database.', records: 'Nothing.', prepare: 'Nothing.', reset: 'Nothing.', description: 'An empty library.' });
    expect(added.isError).toBeUndefined();
  });
});
