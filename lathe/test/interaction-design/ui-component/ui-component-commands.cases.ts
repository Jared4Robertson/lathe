// The commands of the ui-component aggregate, run on a store as the CLI, the MCP tools and HTTP run them. Its cases are proved by
// LA-PAT-AGGREGATE-COMMANDS-R10-T01, which runs them from lathe/test/domain-modeling/aggregate/aggregate-commands.test.ts.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { expect, it } from 'vitest';
import { ADD_UI_COMPONENT } from '../../../src/interaction-design/ui-component/commands/add-ui-component.ts';
import { CHANGE_UI_COMPONENT } from '../../../src/interaction-design/ui-component/commands/change-ui-component.ts';
import { GET_UI_COMPONENT, LIST_UI_COMPONENTS, NEXT_UI_COMPONENT_ID } from '../../../src/interaction-design/ui-component/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeOpenStores } from '../../domain-modeling/domain-model-base.ts';
import { uiComponentDataSet } from './data-set.ts';

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

export function uiComponentCommandCases(): void {
  it('builds the data set with its own Add command, and reads a UI component whole', async () => {
    const store = await uiComponentDataSet();
    expect(runQuery(store, GET_UI_COMPONENT, { id: 'TL-UI01' })).toEqual({
      record: { id: 'TL-UI01', kind: 'ui_component' },
      component: { id: 'TL-UI01', title: 'CatalogPage', file: 'src/catalog.tsx', description: 'Renders the catalog.' },
      renders: ['TL-V01'], builds: [], meets: ['TL-STD-CODE-R01'], packages: ['react'],
    });
    expect(runQuery(store, LIST_UI_COMPONENTS, { product_id: 'TL' })).toEqual([{ id: 'TL-UI01', title: 'CatalogPage' }]);
    expect(runQuery(store, NEXT_UI_COMPONENT_ID, { product_id: 'TL' })).toBe('TL-UI02');
    expect(() => runQuery(store, GET_UI_COMPONENT, { id: 'TL-V01' })).toThrow(/TL-V01 is a view, not a UI component/);
  });

  it('changes its columns and the views it renders, writing only its own tables', async () => {
    const store = await uiComponentDataSet();
    expect((await runCommand(store, CHANGE_UI_COMPONENT, { id: 'TL-UI01', renders: ['TL-V01', 'TL-V02'] })).tables).toEqual(['renders']);
    expect((await runCommand(store, CHANGE_UI_COMPONENT, { id: 'TL-UI01', file: null, meets: [], packages: [] })).tables).toEqual(['meets', 'package_use', 'ui_component']);
  });

  it("refuses an input that is not the command's, a view that does not exist and an ID taken, changing no file", async () => {
    const store = await uiComponentDataSet();
    await expect(runCommand(store, ADD_UI_COMPONENT, { id: 'TL-UI02', title: 'LoansPage' })).rejects.toThrow(new InputError('add-ui-component needs description'));
    const before = fileOf(store, 'renders');
    expect((await refusal(store, CHANGE_UI_COMPONENT, { id: 'TL-UI01', renders: ['TL-V09'] })).problems[0].message).toMatch(/TL-V09/);
    expect((await refusal(store, ADD_UI_COMPONENT, { id: 'TL-UI01', title: 'Again', description: 'x' })).problems[0].rule).toBe('primary-key');
    expect((await refusal(store, CHANGE_UI_COMPONENT, { id: 'TL-UI09', title: 'x' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no UI component TL-UI09' });
    expect(fileOf(store, 'renders')).toBe(before);
  });

  it('runs `lathe ui-component <command>`, the ui_component_ tools and POST /api/ui-component/<command>', async () => {
    const store = await uiComponentDataSet();
    const root = path.dirname(store.dataDir);
    await closeOpenStores();
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['ui-component', 'add-ui-component', '--id', 'TL-UI02', '--title', 'LoansPage', '--description', 'Renders the loans.', '--renders', 'TL-V02', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added ui_component TL-UI02');
    expect((await callTool(root, 'ui_component_get_ui_component', { id: 'TL-UI02' })).content[0].text).toContain('renders: TL-V02');
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/ui-component/change-ui-component', { id: 'TL-UI02', file: 'src/loans.tsx' })).status).toBe(200);
      expect((await post('/api/ui-component/add-ui-component', { id: 'TL-UI03' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
