// The Pattern aggregate's commands, queries and refusals (LA-AUT-A2): each command changes one pattern through
// PatternRepository, its settings given in order as the pattern's own parts, and is refused with its reason, changing
// nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { CHANGE_PATTERN } from '../../../src/authoring/pattern/commands/change-pattern.ts';
import { CHANGE_PATTERN_RULE } from '../../../src/authoring/pattern/commands/change-pattern-rule.ts';
import { REMOVE_PATTERN } from '../../../src/authoring/pattern/commands/remove-pattern.ts';
import { REMOVE_PATTERN_RULE } from '../../../src/authoring/pattern/commands/remove-pattern-rule.ts';
import { GET_PATTERN, LIST_PATTERNS, NEXT_PATTERN_ID } from '../../../src/authoring/pattern/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool, tools } from '../../../src/cli/mcp.ts';
import { readSchema } from '../../../src/cli/operations.ts';
import { InputError } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { everyKind } from '../../store/fixture.ts';
import { writeData } from '../../helpers.ts';
import { librarianAction } from './data-set.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

const refused = (promise: Promise<unknown>) => promise.then(() => Promise.reject(new Error('not refused')), (error: unknown) => error as StoreError);

describe('LA-AUT-UC05-R05-T02 each Pattern command (LA-AUT-A2) changes one pattern through PatternRepository', () => {
  it('builds a pattern with its settings, rule and test, reads it whole, and replaces its settings in order', async () => {
    const store = await librarianAction();
    open.push(store);
    const whole = runQuery(store, GET_PATTERN, { id: 'TL-PAT-ACT-R01-T01' }) as ReturnType<typeof GET_PATTERN.run>;
    expect(whole.settings).toEqual([{ name: 'record', meaning: 'The record the action saves.' }]);
    expect(runQuery(store, LIST_PATTERNS, { product_id: 'TL' })).toEqual([{ id: 'TL-PAT-ACT', title: 'Librarian action' }]);
    expect(runQuery(store, NEXT_PATTERN_ID, { kind: 'pattern_rule', parent: 'TL-PAT-ACT' })).toBe('TL-PAT-ACT-R02');
    const changed = await runCommand(store, CHANGE_PATTERN, { id: 'TL-PAT-ACT', settings: [{ name: 'actor', meaning: 'Who takes the action.' }, { name: 'record', meaning: 'The record the action saves.' }] });
    expect(changed.tables).toEqual(['pattern_setting']);
    expect(store.rows('pattern_setting').map((s) => `${s.position} ${s.name}`)).toEqual(['1 actor', '2 record']);
    await runCommand(store, CHANGE_PATTERN_RULE, { id: 'TL-PAT-ACT-R01', group_name: 'Saving' });
    expect(store.record('TL-PAT-ACT-R01')?.row).toMatchObject({ group_name: 'Saving' });
    await expect(runCommand(store, CHANGE_PATTERN_RULE, { id: 'TL-PAT-ACT-R01', setting: 'record' })).rejects.toThrow(InputError);
    const removed = await runCommand(store, REMOVE_PATTERN_RULE, { id: 'TL-PAT-ACT-R01' });
    expect(removed.changes.map((c) => c.table).sort()).toEqual(['pattern_rule', 'pattern_rule_test']);
  });

  it('refuses dropping a setting a follower gives a value, a pattern a follower follows, and a setting of another shape', async () => {
    const store = await openStore(writeData(everyKind()), { latheDataDir: null });
    open.push(store);
    await expect(runCommand(store, CHANGE_PATTERN, { id: 'TL-PAT-ACT', settings: [{ name: 'record' }] })).rejects.toThrow(new InputError('settings [{"name":"record"}] has an item with no meaning'));
    expect((await refused(runCommand(store, REMOVE_PATTERN, { id: 'TL-PAT-ACT' }))).problems[0].message).toContain('TL-LEND-UC01 follows TL-PAT-ACT');
    const before = store.rows('pattern_setting');
    expect((await refused(runCommand(store, CHANGE_PATTERN, { id: 'TL-PAT-ACT', settings: [] }))).problems.length).toBeGreaterThan(0);
    expect(store.rows('pattern_setting')).toEqual(before);
  });

  it('runs `lathe pattern <command>` with a setting as a JSON flag, and serves each tool with its settings schema', async () => {
    const root = writeData(everyKind());
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t), stdin: async () => '' };
    const args = ['pattern', 'add-pattern', '--id', 'TL-PAT-DESK', '--title', 'Desk check', '--product_id', 'TL', '--description', 'A check at the desk.', '--settings', '{"name":"check","meaning":"What is checked."}', '--root', root];
    expect(await runAggregateCommand(args, io)).toBe(0);
    expect(out.pop()).toContain('Added pattern_setting');
    const tool = tools(await readSchema(root)).find((t) => t.name === 'pattern_add_pattern')!;
    expect(tool.inputSchema.properties).toMatchObject({ settings: { type: 'array', items: { required: ['name', 'meaning'], additionalProperties: false } } });
    expect((await callTool(root, 'pattern_get_pattern', { id: 'TL-PAT-DESK' })).content[0].text).toContain('setting 1. check: What is checked.');
  });
});
