// The Pattern following aggregate's commands, queries and refusals (LA-TRC-A3), run on a store as the CLI, the MCP
// tools and the HTTP API run them: each command changes one following through PatternFollowingRepository, and a
// refusal changes nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CHANGE_SETTING_VALUES } from '../../../src/traceability/pattern-following/commands/change-setting-values.ts';
import { FOLLOW_PATTERN } from '../../../src/traceability/pattern-following/commands/follow-pattern.ts';
import { STOP_FOLLOWING_PATTERN } from '../../../src/traceability/pattern-following/commands/stop-following-pattern.ts';
import { GET_FOLLOWING, LIST_FOLLOWERS, LIST_FOLLOWINGS } from '../../../src/traceability/pattern-following/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeFollowingStores, patternFollowingDataSet } from './data-set.ts';

afterEach(closeFollowingStores);

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

describe('LA-PAT-AGGREGATE-COMMANDS-R10-T03 each Pattern following command (LA-TRC-A3) changes one following through its repository, and is reached by name from every interface', () => {
  it('LA-PAT-AGGREGATE-TESTS-R03-T03 builds the data set with its own command, and reads a following whole, the patterns a follower follows and a pattern\'s followers', async () => {
    const store = await patternFollowingDataSet();
    expect(runQuery(store, GET_FOLLOWING, { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT' })).toEqual({
      follower: 'TL-LEND-UC01', pattern: 'TL-PAT-ACT',
      settings: [{ setting: 'record', value: 'The loan.' }, { setting: 'required_input', value: 'No input: the member is scanned at the desk.' }],
    });
    expect(runQuery(store, LIST_FOLLOWINGS, { follower_id: 'TL-LEND-UC01' })).toEqual(['TL-PAT-ACT']);
    expect(() => runQuery(store, GET_FOLLOWING, { follower_id: 'TL-LEND', pattern_id: 'TL-PAT-ACT' })).toThrow(/TL-LEND does not follow TL-PAT-ACT/);
    expect(runQuery(store, LIST_FOLLOWERS, { pattern_id: 'TL-PAT-ACT' })).toEqual({
      pattern: 'TL-PAT-ACT',
      domains: [{ domain: 'TL-LEND', itself: null, useCases: [runQuery(store, GET_FOLLOWING, { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT' })] }],
    });
    expect(runQuery(store, LIST_FOLLOWERS, { pattern_id: 'TL-PAT-LOG' })).toEqual({ pattern: 'TL-PAT-LOG', domains: [] });
    expect(() => runQuery(store, LIST_FOLLOWERS, { pattern_id: 'TL-PAT-NONE' })).toThrow(/there is no pattern TL-PAT-NONE/);
  });

  it('follows a pattern with no settings, and changes the setting values, writing only its own tables', async () => {
    const store = await patternFollowingDataSet();
    expect((await runCommand(store, FOLLOW_PATTERN, { follower_id: 'TL-LEND', pattern_id: 'TL-PAT-LOG' })).tables).toEqual(['follows']);
    expect(runQuery(store, LIST_FOLLOWERS, { pattern_id: 'TL-PAT-LOG' })).toEqual({ pattern: 'TL-PAT-LOG', domains: [{ domain: 'TL-LEND', itself: { follower: 'TL-LEND', pattern: 'TL-PAT-LOG', settings: [] }, useCases: [] }] });
    const changed = await runCommand(store, CHANGE_SETTING_VALUES, { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'record', value: 'The loan.' }, { setting: 'required_input', value: 'The member card.' }] });
    expect(changed.tables).toEqual(['setting_value']);
    expect(changed.changes).toHaveLength(1);
  });

  it("LA-PAT-AGGREGATE-COMMANDS-R02-T03 refuses a second following, a setting the pattern does not have, a setting with no value, and an input that is not the command's, changing no file", async () => {
    const store = await patternFollowingDataSet();
    const before = fileOf(store, 'setting_value');
    expect((await refusal(store, FOLLOW_PATTERN, { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT' })).problems[0]).toMatchObject({ rule: 'exists', message: 'TL-LEND-UC01 already follows TL-PAT-ACT' });
    expect((await refusal(store, CHANGE_SETTING_VALUES, { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'colour', value: 'red' }] })).problems[0].message).toMatch(/colour/);
    await expect(runCommand(store, CHANGE_SETTING_VALUES, { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'record' }] })).rejects.toThrow('has an item with no value');
    expect((await refusal(store, CHANGE_SETTING_VALUES, { follower_id: 'TL-LEND', pattern_id: 'TL-PAT-ACT', setting_values: [] })).problems[0]).toMatchObject({ rule: 'missing', message: 'TL-LEND does not follow TL-PAT-ACT' });
    await expect(runCommand(store, CHANGE_SETTING_VALUES, { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'record', value: 'x', position: 1 }] })).rejects.toThrow(InputError);
    expect(fileOf(store, 'setting_value')).toBe(before);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R01-T03 runs `lathe pattern-following <command>`, the pattern_following_ tools and POST /api/pattern-following/<command>', async () => {
    const store = await patternFollowingDataSet();
    const root = path.dirname(store.dataDir);
    await closeFollowingStores();
    const out: string[] = [];
    expect(await runAggregateCommand(['pattern-following', 'follow-pattern', '--follower_id', 'TL-LEND', '--pattern_id', 'TL-PAT-LOG', '--root', root], { out: (t) => out.push(t), err: (t) => out.push(t) })).toBe(0);
    expect(out.pop()).toContain('Added follows');
    expect((await callTool(root, 'pattern_following_list_followings', { follower_id: 'TL-LEND' })).content[0].text).toBe('TL-PAT-LOG');
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      const followers = await fetch(`${base}/api/pattern-following/list-followers?pattern_id=TL-PAT-LOG`);
      expect(followers.status).toBe(200);
      expect(((await followers.json()) as { domains: { domain: string }[] }).domains.map((d) => d.domain)).toEqual(['TL-LEND']);
      expect((await post('/api/pattern-following/stop-following-pattern', { follower_id: 'TL-LEND', pattern_id: 'TL-PAT-LOG' })).status).toBe(200);
      expect((await post('/api/pattern-following/stop-following-pattern', { follower_id: 'TL-LEND', pattern_id: 'TL-PAT-LOG' })).status).toBe(422);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('LA-STD-CODE-R07-T54 a following is removed whole, with the setting values it gave', () => {
  it('stops following a pattern, taking its setting values with it', async () => {
    const store = await patternFollowingDataSet();
    const removed = await runCommand(store, STOP_FOLLOWING_PATTERN, { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT' });
    expect(removed.changes.map((c) => c.table).sort()).toEqual(['follows', 'setting_value', 'setting_value']);
    expect(runQuery(store, LIST_FOLLOWINGS, { follower_id: 'TL-LEND-UC01' })).toEqual([]);
  });
});
