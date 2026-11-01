// The Use case aggregate's commands and queries, reached by name from the CLI, the MCP tools and HTTP. Their cases are
// proved by LA-PAT-AGGREGATE-COMMANDS-R01-T01, which runs them from lathe/test/command-layers.test.ts.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { runAggregateCommand } from '../src/cli/aggregates.ts';
import { callTool, tools } from '../src/cli/mcp.ts';
import { readSchema } from '../src/cli/operations.ts';
import { closeStores, handleApi } from '../src/server/api.ts';
import { everyKind } from './store/fixture.ts';
import { writeData } from './helpers.ts';
import type { UseCasePage } from '../src/authoring/use-case/read-model.ts';
import { ALL_COMMANDS, ALL_QUERIES } from '../src/commands.ts';

export function useCaseLayerCases(): void {
  it('runs `lathe use-case <command>` with flags or JSON, prints the refusal with its reasons, and helps from the schema', async () => {
    const root = writeData(everyKind());
    const out: string[] = [];
    const err: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => err.push(t), stdin: async () => JSON.stringify({ id: 'TL-LEND-UC01-R02', title: 'Member known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' }) };
    expect(await runAggregateCommand(['use-case', 'add-uc-requirement', '--json', '-', '--root', root], io)).toBe(0);
    expect(JSON.parse(out.pop()!)).toMatchObject({ tables: ['uc_requirement'] });
    expect(await runAggregateCommand(['use-case', 'change-flow-step', '--id', 'TL-LEND-UC01-FL-S01', '--fulfills', 'TL-LEND-UC01-R01', '--fulfills', 'TL-LEND-UC01-R02', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added fulfills source_id TL-LEND-UC01-FL-S01, target_id TL-LEND-UC01-R02');
    expect(await runAggregateCommand(['use-case', 'remove-uc-requirement', '--id', 'TL-LEND-UC01-R02', '--root', root], io)).toBe(1);
    expect(err.pop()).toMatch(/^Refused; nothing changed:\n {2}UC requirement TL-LEND-UC01-R02 is referenced, so it stays: .* \[referenced\]$/);
    expect(await runAggregateCommand(['use-case', 'add-flow-step', '--help', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('--position                 integer, required. The step\'s place on its path, from 1, among every interface\'s steps; each interface\'s version skips the other interfaces\' variants.');
    expect(await runAggregateCommand(['use-case', 'next-id', '--kind', 'uc_requirement', '--parent', 'TL-LEND-UC01', '--root', root], io)).toBe(0);
    expect(out.pop()).toBe('TL-LEND-UC01-R03');
    expect(await runAggregateCommand(['use-case', 'add-flow-step', '--colour', 'red', '--root', root], io)).toBe(2);
    expect(err.pop()).toContain('lathe use-case add-flow-step has no field colour');
  });

  it('serves one MCP tool per command and query, each with its own input schema', async () => {
    const root = writeData(everyKind());
    const listed = tools(await readSchema(root));
    const tool = listed.find((t) => t.name === 'use_case_add_flow_step')!;
    expect(tool.inputSchema).toMatchObject({ required: ['id', 'title', 'flow_id', 'path', 'position'], additionalProperties: false });
    expect(listed.map((t) => t.name)).toEqual(expect.arrayContaining(['use_case_move_use_case', 'use_case_get_use_case', 'use_case_next_id']));
    const added = await callTool(root, 'use_case_add_uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'Member known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' });
    expect(added.isError).toBeUndefined();
    const refused = await callTool(root, 'use_case_add_flow', { id: 'TL-LEND-UC01-FL', title: 'Again', use_case_id: 'TL-LEND-UC01', extra: 1 });
    expect(refused).toMatchObject({ isError: true, structuredContent: { refused: true, problems: [{ rule: 'input' }] } });
    const read = await callTool(root, 'use_case_get_use_case', { id: 'TL-LEND-UC01-R02' });
    expect(read.content[0].text).toContain('UC requirement TL-LEND-UC01-R02: Member known');
  });

  it('answers POST /api/use-case/<command> with the changed rows, 422 with the refusal, and 400 for an input of another shape', async () => {
    const root = writeData(everyKind());
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      const added = await post('/api/use-case/add-uc-requirement', { id: 'TL-LEND-UC01-R02', title: 'Member known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' });
      expect(added.status).toBe(200);
      expect(await added.json()).toMatchObject({ ok: true, tables: ['uc_requirement'], changes: [{ table: 'uc_requirement', key: 'TL-LEND-UC01-R02', before: null }] });
      const refused = await post('/api/use-case/remove-uc-requirement', { id: 'TL-LEND-UC01-R01' });
      expect(refused.status).toBe(422);
      expect(await refused.json()).toMatchObject({ ok: false, problems: [{ rule: 'referenced' }] });
      expect((await post('/api/use-case/add-flow', { id: 'TL-LEND-UC01-FL02' })).status).toBe(400);
      expect((await fetch(`${base}/api/use-case/add-flow`)).status).toBe(405);
    } finally {
      await closeStores(root);
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('gives every query its own route beside the commands\', and none is both', () => {
    const routes = ALL_QUERIES.map((q) => q.route);
    for (const q of ALL_QUERIES) expect(q.route, q.id).toBe(`/api/${q.slice.name}/${q.name}`);
    expect(routes).toEqual(expect.arrayContaining(['/api/use-case/get-use-case', '/api/use-case/list-use-cases', '/api/use-case/next-id']));
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes.filter((r) => ALL_COMMANDS.some((c) => c.route === r))).toEqual([]);
  });

  it('answers a use case whole by any ID in it, 400 for an input of another shape, 422 for a record it does not read, 405 for a write', async () => {
    const root = writeData(everyKind());
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const whole = await fetch(`${base}/api/use-case/get-use-case?id=TL-LEND-UC01-FL-S01`);
      expect(whole.status).toBe(200);
      const page = (await whole.json()) as UseCasePage;
      expect(page.record).toEqual({ id: 'TL-LEND-UC01-FL-S01', kind: 'flow_step' });
      expect(page.useCase.id).toBe('TL-LEND-UC01');
      expect(page.flows.flatMap((f) => f.paths.flatMap((p) => p.steps.map((s) => s.step.id)))).toContain('TL-LEND-UC01-FL-S01');

      const next = await fetch(`${base}/api/use-case/next-id?kind=uc_requirement&parent=TL-LEND-UC01`);
      expect(await next.json()).toBe('TL-LEND-UC01-R02');
      const listed = await fetch(`${base}/api/use-case/list-use-cases?capability_id=TL-LEND-CAP01`);
      expect(await listed.json()).toEqual([{ id: 'TL-LEND-UC01', title: expect.any(String) }]);

      const missing = await fetch(`${base}/api/use-case/get-use-case`);
      expect(missing.status).toBe(400);
      expect(await missing.json()).toEqual({ error: 'get-use-case needs id' });
      expect((await fetch(`${base}/api/use-case/get-use-case?id=TL-LEND-UC01&colour=red`)).status).toBe(400);

      const other = await fetch(`${base}/api/use-case/get-use-case?id=TL-LEND-CAP01`);
      expect(other.status).toBe(422);
      expect(await other.json()).toMatchObject({ problems: [{ rule: 'kind' }] });

      expect((await fetch(`${base}/api/use-case/get-use-case?id=TL-LEND-UC01`, { method: 'POST' })).status).toBe(405);
    } finally {
      await closeStores(root);
      await new Promise((resolve) => server.close(resolve));
    }
  });
}
