// The aggregates' reads over HTTP (GET /api/<aggregate>/<query>), as the app's pages read them: each route reads the
// one query it names on the product its input names, takes its input from the query string as the CLI takes its
// flags, and refuses an input of another shape (400) or a record the query does not read (422), changing nothing.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import type { UseCase } from '../src/authoring/use-case/model.ts';
import { closeStores, handleApi } from '../src/server/api.ts';
import { ALL_COMMANDS, ALL_QUERIES } from '../src/commands.ts';
import { everyKind } from './store/fixture.ts';
import { writeData } from './helpers.ts';

describe('LA-AUT-UC06-R14-T02 each Use case query is read by name over HTTP, GET /api/use-case/<query>', () => {
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
      const whole = await fetch(`${base}/api/use-case/get-use-case?id=TL-LEND-UC01-FL01-S01`);
      expect(whole.status).toBe(200);
      const useCase = (await whole.json()) as UseCase;
      expect(useCase.root).toBe('TL-LEND-UC01');
      expect(useCase.steps.map((s) => s.row.id)).toContain('TL-LEND-UC01-FL01-S01');

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
});
