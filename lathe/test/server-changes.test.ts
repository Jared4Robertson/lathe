// How the server follows the data files (LA-PLT-UC03-R04, LA-PLT-UC03-R02): a change reloads only the changed tables
// and is announced at once with the read models it touched; the check rows and coverage then run in the background on
// the data built whole, a burst of changes making one run once the reads it sets off have answered, and are announced
// when ready. Data refused only by the whole build (an integrity query, a database check) is served until the build
// says so, then refused and announced.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { closeStores, dataFilesChanged, handleApi, onDataChange } from '../src/server/api.ts';
import type { DataChange } from '../src/server/events.ts';
import type { ProductProblems } from '../src/checking/problems/read-model.ts';
import { everyKind } from './store/fixture.ts';
import { writeData } from './helpers.ts';

afterAll(() => closeStores());

describe('LA-PLT-UC03-R04-T01 LA-PLT-UC03-R02-T01 the checks run in the background after a burst of changes, once, and are announced when ready, reads first', () => {
  it('announces each reload at once, one checks\' run after a burst, and a refusal the whole build finds', async () => {
    const root = writeData(everyKind());
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const heard: DataChange[] = [];
    const stop = onDataChange(root, (change) => heard.push(change));
    const checkRuns = () => heard.filter((c) => c.readModels?.includes('problems')).length;
    const file = path.join(root, 'data', 'question.jsonl');
    const original = readFileSync(file, 'utf8');
    try {
      // The first read opens the store; its checks run at once and are announced.
      const problems = await fetch(`${base}/api/problems/list-problems?product_id=TL`);
      expect(problems.status).toBe(200);
      expect(((await problems.json()) as ProductProblems).product).toBe('TL');
      await vi.waitFor(() => expect(checkRuns()).toBe(1), { timeout: 20_000 });
      const read = await fetch(`${base}/api/meta-model/get-meta-model`);
      expect(read.status).toBe(200);

      // A burst of three changes: each reload is announced with its table and the read models reading it, and the
      // checks run once after the last.
      heard.length = 0;
      for (const n of [1, 2, 3]) {
        writeFileSync(file, original.replace('"title":"', `"title":"Burst ${n}: `));
        await dataFilesChanged(root);
      }
      expect(heard.filter((c) => c.tables.length)).toEqual(Array.from({ length: 3 }, () => ({ tables: ['question'], readModels: expect.arrayContaining(['product']) })));
      expect(heard.flatMap((c) => c.readModels ?? [])).not.toContain('meta-model');
      await vi.waitFor(() => expect(checkRuns()).toBe(1), { timeout: 20_000 });
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(checkRuns()).toBe(1);

      // The reads a change sets off answer first: while requests keep coming the checks wait (at most 1 s after the
      // change), and they run once the requests stop.
      heard.length = 0;
      writeFileSync(file, original.replace('"title":"', '"title":"Read first: '));
      await dataFilesChanged(root);
      const until = performance.now() + 400;
      while (performance.now() < until) {
        expect((await fetch(`${base}/api/meta-model/get-meta-model`)).status).toBe(200);
        expect(checkRuns()).toBe(0);
      }
      await vi.waitFor(() => expect(checkRuns()).toBe(1), { timeout: 20_000 });

      // A title the integrity queries refuse passes the reload's own checks, so it is served until the whole build
      // refuses it; then the refusal is announced (every read model) and every read is refused, until the file is mended.
      heard.length = 0;
      writeFileSync(file, original.replace(/"title":"([^"]*)"/, '"title":"$1."'));
      await dataFilesChanged(root);
      expect(heard[0]).toMatchObject({ tables: ['question'] });
      await vi.waitFor(() => expect(heard.some((c) => c.readModels === null)).toBe(true), { timeout: 20_000 });
      const refused = await fetch(`${base}/api/meta-model/get-meta-model`);
      expect(refused.status).toBe(500);
      expect(((await refused.json()) as { error: string }).error).toMatch(/question\.jsonl:1/);

      heard.length = 0;
      writeFileSync(file, original);
      await dataFilesChanged(root);
      // The data is served again, every read model announced: what was served before the refusal is gone.
      expect(heard[0]).toEqual({ tables: ['question'], readModels: null });
      expect((await fetch(`${base}/api/meta-model/get-meta-model`)).status).toBe(200);
    } finally {
      stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await closeStores(root);
    }
  }, 60_000);
});
