// The Record's data file read (LA-PRD-RM02, LA-PRD-QRY05): the data file that holds a record's row, read through the
// read model's reader from the store that loaded it, as the desktop app asks the window's engine for it to reveal or
// open the file. In a workspace, the API reads it from the product folder that holds the record.
import { mkdirSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../../../src/config.ts';
import { FIND_RECORD_DATA_FILE } from '../../../src/product/record-data-file/queries.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { removeData, writeData } from '../../helpers.ts';
import { TWO_PRODUCTS } from '../../checking/problems/data-set.ts';

const open: Store[] = [];
const served: string[] = [];
afterEach(async () => {
  for (const s of open.splice(0)) await s.close();
  for (const root of served.splice(0)) await closeStores(root);
});
afterAll(removeData);

async function store(): Promise<Store> {
  const opened = await openStore(writeData(TWO_PRODUCTS));
  open.push(opened);
  return opened;
}

/** GET the route from the workspace's API: its status and answer. */
async function get(root: string, url: string): Promise<{ status: number; answer: unknown }> {
  let text = '';
  const req = Object.assign(Readable.from([]), { url, method: 'GET', headers: { host: '127.0.0.1:5300' }, socket: { remoteAddress: '127.0.0.1' } }) as unknown as IncomingMessage;
  const res = { statusCode: 200, setHeader: () => {}, end: (chunk?: string) => { text = chunk ?? ''; } } as unknown as ServerResponse & { statusCode: number };
  await handleApi(root, req, res, url.split('?')[0]);
  return { status: res.statusCode, answer: JSON.parse(text) as unknown };
}

describe("LA-PLT-UC11-R08-T02 A record's data file is found by the engine, in its own product's data folder", () => {
  it("answers the record's kind's file in the store's data folder", async () => {
    const s = await store();
    expect(runQuery(s, FIND_RECORD_DATA_FILE, { id: 'EX-LEND-A1' })).toEqual({ id: 'EX-LEND-A1', file: path.join(s.dataDir, 'aggregate.jsonl') });
    expect(runQuery(s, FIND_RECORD_DATA_FILE, { id: 'NF' })).toEqual({ id: 'NF', file: path.join(s.dataDir, 'product.jsonl') });
  });

  it('refuses an ID no record has, and data no one folder holds', async () => {
    const s = await store();
    expect(() => runQuery(s, FIND_RECORD_DATA_FILE, { id: 'EX-NONE' })).toThrow(/no record has the ID EX-NONE/);
    const unheld = { schema: s.schema, rows: (t: string) => s.rows(t), record: (id: string) => s.record(id) };
    expect(() => runQuery(unheld, FIND_RECORD_DATA_FILE, { id: 'EX' })).toThrow(/no one product's data folder/);
  });

  it("answers, through the API, the file in the folder of the workspace's product that holds the record", async () => {
    const root = writeData({ product: [{ id: 'WS', title: 'Workspace', description: 'The product the workspace holds itself.' }] });
    served.push(root);
    const shop = path.join(root, 'examples', 'shop');
    mkdirSync(path.join(shop, 'data'), { recursive: true });
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ schema: SCHEMA_VERSION, data: 'data', products: ['examples/shop'] }));
    writeFileSync(path.join(shop, 'lathe.config.json'), JSON.stringify({ schema: SCHEMA_VERSION, data: 'data' }));
    writeFileSync(path.join(shop, 'data', 'product.jsonl'), '{"id":"SH","title":"Shop","description":"A shop that sells spare parts."}\n');
    expect(await get(root, `${FIND_RECORD_DATA_FILE.route}?id=SH`)).toEqual({ status: 200, answer: { id: 'SH', file: path.join(shop, 'data', 'product.jsonl') } });
    expect(await get(root, `${FIND_RECORD_DATA_FILE.route}?id=WS`)).toEqual({ status: 200, answer: { id: 'WS', file: path.join(root, 'data', 'product.jsonl') } });
    expect((await get(root, `${FIND_RECORD_DATA_FILE.route}?id=SH-NONE`)).status).toBe(422);
  });
});
