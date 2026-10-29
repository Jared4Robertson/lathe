// The View aggregate's commands, queries and refusals (LA-AUT-A12), run on a store as the CLI, the MCP tools and the
// HTTP API run them: each command changes one view through ViewRepository and is refused with its reason, changing
// nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_VIEW } from '../../../src/authoring/view/commands/add-view.ts';
import { ADD_VIEW_REQUIREMENT } from '../../../src/authoring/view/commands/add-view-requirement.ts';
import { CHANGE_VIEW } from '../../../src/authoring/view/commands/change-view.ts';
import { CHANGE_VIEW_REQUIREMENT } from '../../../src/authoring/view/commands/change-view-requirement.ts';
import { CHANGE_VIEW_TEST } from '../../../src/authoring/view/commands/change-view-test.ts';
import { REMOVE_VIEW } from '../../../src/authoring/view/commands/remove-view.ts';
import { REMOVE_VIEW_REQUIREMENT } from '../../../src/authoring/view/commands/remove-view-requirement.ts';
import { REMOVE_VIEW_TEST } from '../../../src/authoring/view/commands/remove-view-test.ts';
import { GET_VIEW, LIST_VIEWS, NEXT_VIEW_ID } from '../../../src/authoring/view/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { closeOpenStores, domainModelBase } from '../domain-model-base.ts';
import { viewDataSet } from './data-set.ts';

afterEach(closeOpenStores);

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
type Page = ReturnType<typeof GET_VIEW.run>;

describe('LA-AUT-UC18-R50-T01 each View command (LA-AUT-A12) changes one view through ViewRepository, and is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('builds the data set with its own Add commands, and reads a view whole by any record in it', async () => {
    const store = await viewDataSet();
    const page = runQuery(store, GET_VIEW, { id: 'TL-V01-R01-T01' }) as Page;
    expect(page.record).toEqual({ id: 'TL-V01-R01-T01', kind: 'view_test' });
    expect(page.view).toEqual({ id: 'TL-V01', title: 'Catalog', route: '/catalog', description: 'Every tool the library holds, with whether it is free.' });
    expect(page.requirements.map((r) => [r.requirement.id, r.tests.map((t) => [t.test.id, t.startsFrom])])).toEqual([['TL-V01-R01', [['TL-V01-R01-T01', ['TL-LEND-TD01']]]]]);
    expect((runQuery(store, GET_VIEW, { id: 'TL-V01' }) as Page).record).toEqual({ id: 'TL-V01', kind: 'view' });
    expect(runQuery(store, LIST_VIEWS, { product_id: 'TL' })).toEqual([{ id: 'TL-V01', title: 'Catalog' }, { id: 'TL-V02', title: 'Loans' }]);
    expect(runQuery(store, NEXT_VIEW_ID, { kind: 'view', parent: 'TL' })).toBe('TL-V03');
    expect(runQuery(store, NEXT_VIEW_ID, { kind: 'view_requirement', parent: 'TL-V01' })).toBe('TL-V01-R02');
    expect(runQuery(store, NEXT_VIEW_ID, { kind: 'view_test', parent: 'TL-V01-R01' })).toBe('TL-V01-R01-T02');
    expect(() => runQuery(store, NEXT_VIEW_ID, { kind: 'view_test', parent: 'TL-V01' })).toThrow(/a view_test sits under a view_requirement, and TL-V01 is a view/);
    expect(() => runQuery(store, GET_VIEW, { id: 'TL-LEND' })).toThrow(/TL-LEND is a domain, not a view or a record in one/);
    expect(() => runQuery(store, LIST_VIEWS, { product_id: 'TL-LEND' })).toThrow(/there is no product TL-LEND/);
  });

  it('changes each kind, writing only its own tables: a list given replaces its list, null clears an optional column', async () => {
    const store = await viewDataSet();
    expect((await runCommand(store, CHANGE_VIEW, { id: 'TL-V01', route: null, notes: 'The first page.' })).tables).toEqual(['view']);
    expect(store.record('TL-V01')?.row).toEqual({ id: 'TL-V01', title: 'Catalog', description: 'Every tool the library holds, with whether it is free.', notes: 'The first page.' });
    expect((await runCommand(store, CHANGE_VIEW_REQUIREMENT, { id: 'TL-V01-R01', group_name: 'Loans' })).tables).toEqual(['view_requirement']);
    expect((await runCommand(store, CHANGE_VIEW_TEST, { id: 'TL-V01-R01-T01', starts_from: [] })).tables).toEqual(['starts_from']);
    expect((await runCommand(store, CHANGE_VIEW_TEST, { id: 'TL-V01-R01-T01', state: 'manual', manual_reason: 'Needs a person.' })).tables).toEqual(['view_test']);
  });

  it("refuses an input that is not the command's, a missing parent, and a key already taken, changing no file", async () => {
    const store = await viewDataSet();
    await expect(runCommand(store, ADD_VIEW_REQUIREMENT, { id: 'TL-V02-R01', title: 'x', view_id: 'TL-V02' })).rejects.toThrow(new InputError('add-view-requirement needs statement'));
    await expect(runCommand(store, CHANGE_VIEW_REQUIREMENT, { id: 'TL-V01-R01', view_id: 'TL-V02' })).rejects.toThrow(/change-view-requirement takes no view_id/);
    const before = fileOf(store, 'view_requirement');
    expect((await refusal(store, ADD_VIEW_REQUIREMENT, { id: 'TL-V09-R01', title: 'x', view_id: 'TL-V09', statement: 'x MUST y.' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no view TL-V09' });
    expect((await refusal(store, ADD_VIEW, { id: 'TL-V01', title: 'Again', description: 'x' })).problems[0].rule).toBe('primary-key');
    expect((await refusal(store, CHANGE_VIEW_TEST, { id: 'TL-V01-R01-T09', title: 'x' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no view test TL-V01-R01-T09' });
    expect(fileOf(store, 'view_requirement')).toBe(before);
  });

  it('runs `lathe view <command>`, the view_ tools and POST /api/view/<command>', async () => {
    const root = writeData(domainModelBase());
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['view', 'add-view', '--id', 'TL-V01', '--title', 'Catalog', '--route', '/catalog', '--description', 'The tools.', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added view TL-V01');
    const added = await callTool(root, 'view_add_view_requirement', { id: 'TL-V01-R01', title: 'Free tools first', view_id: 'TL-V01', statement: 'Free tools MUST come first.' });
    expect(added.isError).toBeUndefined();
    expect((await callTool(root, 'view_get_view', { id: 'TL-V01-R01' })).content[0].text).toContain('View requirement TL-V01-R01: Free tools first');
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/view/change-view', { id: 'TL-V01', title: 'Tools' })).status).toBe(200);
      const refused = await post('/api/view/add-view-requirement', { id: 'TL-V09-R01', title: 'x', view_id: 'TL-V09', statement: 'x MUST y.' });
      expect(refused.status).toBe(422);
      expect(await refused.json()).toMatchObject({ ok: false, problems: [{ rule: 'missing' }] });
      expect((await post('/api/view/add-view', { id: 'TL-V02' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('LA-STD-CODE-R07-T56 a view, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
  it('removes a test alone, a requirement with its tests, and a view whole', async () => {
    const store = await viewDataSet();
    expect((await runCommand(store, REMOVE_VIEW_TEST, { id: 'TL-V01-R01-T01' })).changes.map((c) => c.table).sort()).toEqual(['starts_from', 'view_test']);
    await runCommand(store, CHANGE_VIEW_REQUIREMENT, { id: 'TL-V01-R01', title: 'Due dates show' });
    expect((await runCommand(store, REMOVE_VIEW_REQUIREMENT, { id: 'TL-V01-R01' })).changes.map((c) => c.table)).toEqual(['view_requirement']);
    await runCommand(store, ADD_VIEW_REQUIREMENT, { id: 'TL-V02-R01', title: 'Overdue loans first', view_id: 'TL-V02', statement: 'Overdue loans MUST come first.' });
    const removed = await runCommand(store, REMOVE_VIEW, { id: 'TL-V02' });
    expect(removed.changes.map((c) => c.table).sort()).toEqual(['view', 'view_requirement']);
  });

  it('refuses a view a UI component renders, naming the link', async () => {
    const store = await viewDataSet();
    expect((await refusal(store, REMOVE_VIEW, { id: 'TL-V01' })).problems[0].message).toBe('View TL-V01 is referenced, so it stays: TL-UI01 renders TL-V01');
  });
});
