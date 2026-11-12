// The commands of the Platform domain that nobody else's test drives: Read a product's changed data files again.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { closeStores, dataFilesChanged, handleApi, onDataChange } from '../../../src/server/api.ts';
import type { DataChange } from '../../../src/server/events.ts';
import { everyKind } from '../../store/fixture.ts';
import { writeData } from '../../helpers.ts';

afterAll(() => closeStores());

describe("Read a product's changed data files again", () => {
  it('LA-PLT-UC103-R01-T01 LA-PLT-UC103-FL-T Only the files that changed are read again, whoever changed them, and the kinds that changed are announced', async () => {
    const root = writeData(everyKind());
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const heard: DataChange[] = [];
    const stop = onDataChange(root, (change) => heard.push(change));
    const file = path.join(root, 'data', 'question.jsonl');
    const original = readFileSync(file, 'utf8');
    try {
      // The first read opens the product's store.
      expect((await fetch(`${base}/api/meta-model/get-meta-model`)).status).toBe(200);
      heard.length = 0;
      // The Owner changes a data file in an editor: the server reads that file's table again and announces it.
      writeFileSync(file, original.replace('"title":"', '"title":"Edited: '));
      await dataFilesChanged(root);
      expect(heard.filter((c) => c.tables.length)).toEqual([{ tables: ['question'], readModels: expect.arrayContaining(['product']) }]);
      // Nothing changed on disk: nothing is announced.
      heard.length = 0;
      writeFileSync(file, original.replace('"title":"', '"title":"Edited: '));
      await dataFilesChanged(root);
      expect(heard.filter((c) => c.tables.length)).toEqual([]);
      // Data the files now hold that breaks a rule is announced as refused, and every read is refused.
      heard.length = 0;
      writeFileSync(file, original.replace(/"title":"([^"]*)"/, '"title":"$1."'));
      await dataFilesChanged(root);
      await vi.waitFor(() => expect(heard.some((c) => c.readModels === null)).toBe(true), { timeout: 20_000 });
      expect((await fetch(`${base}/api/meta-model/get-meta-model`)).status).toBe(500);
      // The files are mended: the data they hold now is what is read.
      heard.length = 0;
      writeFileSync(file, original);
      await dataFilesChanged(root);
      expect(heard.some((c) => c.readModels === null)).toBe(true);
      expect((await fetch(`${base}/api/meta-model/get-meta-model`)).status).toBe(200);
    } finally {
      stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await closeStores(root);
    }
  }, 60_000);
});
