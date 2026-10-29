// A workspace that shows several products (LA-PLT-UC02-R08 to R11): lathe.config.json's products lists the other
// products' folders, each loaded, checked, traced and written in its own folder, and served beside the workspace's own.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { loadConfig, loadProducts, openStore, SCHEMA_VERSION, workspaceProducts } from '../src/index.ts';
import { closeStores, handleApi, watchTargets } from '../src/server/api.ts';
import type { SpecData, WriteAnswer } from '../src/server/contract.ts';
import { gatherRouteFacts } from '../src/trace/routes.ts';
import { readPackageFacts } from '../src/trace/packages.ts';
import { sourceFiles } from '../src/trace/source-files.ts';
import { DEFAULT_SOURCE, DEFAULT_TESTS } from '../src/config.ts';
import { removeData, writeData, type Data } from './helpers.ts';

afterAll(removeData);

const SHOP = 'examples/shop';
const own: Data = { product: [{ id: 'WS', title: 'Workspace', description: 'The product the workspace holds itself.' }], domain: [{ id: 'WS-CORE', title: 'Core', product_id: 'WS', subdomain_type: 'core', description: 'The heart of the workspace product.' }] };
const shop: Data = { product: [{ id: 'SH', title: 'Shop', description: 'A shop that sells spare parts.' }], domain: [{ id: 'SH-SELL', title: 'Selling', product_id: 'SH', subdomain_type: 'core', description: 'Selling parts to customers.' }] };

function write(root: string, files: Record<string, string>) {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
}

const config = (more: Record<string, unknown>) => `${JSON.stringify({ schema: SCHEMA_VERSION, data: 'data', ...more })}\n`;
const rows = (data: Data) => Object.fromEntries(Object.entries(data).map(([table, list]) => [`data/${table}.jsonl`, list.map((r) => `${JSON.stringify(r)}\n`).join('')]));
const prefixed = (prefix: string, files: Record<string, string>) => Object.fromEntries(Object.entries(files).map(([f, t]) => [`${prefix}/${f}`, t]));

/** A workspace with its own product and the shop listed under products, each with its own config and data. */
function workspace(shopData: Data = shop, extra: Record<string, string> = {}, more: Record<string, unknown> = {}): string {
  const root = writeData(own);
  write(root, { 'lathe.config.json': config({ products: [SHOP], ...more }), ...prefixed(SHOP, { 'lathe.config.json': config({}), ...rows(shopData) }), ...extra });
  return root;
}

function lathe(...args: string[]) {
  return spawnSync(process.execPath, [path.join(import.meta.dirname, '..', 'bin', 'lathe.ts'), ...args], { encoding: 'utf8' });
}

async function request(root: string, url: string, body?: unknown) {
  let text = '';
  const headers: Record<string, string> = {};
  const req = Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]), {
    url,
    method: body === undefined ? 'GET' : 'POST',
    headers: { host: '127.0.0.1:5300', 'content-type': 'application/json' },
  }) as unknown as IncomingMessage;
  const res = {
    statusCode: 200,
    setHeader: (name: string, value: string) => { headers[name] = value; },
    end: (chunk?: string) => { text = chunk ?? ''; },
  } as unknown as ServerResponse & { statusCode: number };
  await handleApi(root, req, res, url.split('?')[0]);
  return { status: res.statusCode, json: () => JSON.parse(text) as unknown };
}

const opened: string[] = [];
afterEach(async () => {
  for (const root of opened.splice(0)) await closeStores(root);
});

describe('a workspace of several products', () => {
  it('LA-PLT-UC02-R08-T01 A workspace loads each listed product from its own folder, and refuses a listing that is wrong', async () => {
    const root = workspace();
    expect(loadConfig(root).products).toEqual([path.join(root, SHOP)]);
    expect(workspaceProducts(root).map((c) => c.dataDir)).toEqual([path.join(root, 'data'), path.join(root, SHOP, 'data')]);
    const products = await loadProducts(root, { latheDataDir: null });
    expect(products.map(({ workspace: ws }) => ws.records.filter((r) => r.kind === 'product').map((r) => r.id))).toEqual([['WS'], ['SH']]);
    expect(products.map(({ workspace: ws }) => [...new Set(ws.coverage.map((c) => c.product))])).toEqual([['WS'], ['SH']]);

    const refused = (more: Record<string, unknown>, files: Record<string, string> = {}) => {
      const r = workspace(shop, files);
      write(r, { 'lathe.config.json': config(more) });
      return () => workspaceProducts(r);
    };
    expect(refused({ products: ['.'] })).toThrow(/\. is the workspace itself/);
    expect(refused({ products: [SHOP, `${SHOP}/`] })).toThrow(/is listed twice/);
    expect(refused({ products: ['examples/none'] })).toThrow(/examples\/none holds no lathe\.config\.json/);
    expect(refused({ products: 'examples/shop' })).toThrow(/products must list the folders/);
    const nested = workspace(shop, prefixed(SHOP, { 'lathe.config.json': config({ products: ['more'] }), 'more/lathe.config.json': config({}) }));
    expect(() => workspaceProducts(nested)).toThrow(/examples\/shop\/lathe\.config\.json: products is for the workspace only/);
    // One product ID in two products' folders stops the load.
    const twice = workspace({ product: [{ id: 'WS', title: 'Workspace again', description: 'The same product in a second folder.' }] });
    await expect(loadProducts(twice, { latheDataDir: null })).rejects.toThrow('The product WS is in two folders, . and examples/shop');
  });

  it('LA-PLT-UC02-R09-T01 lathe check reports each product of the workspace, then them all', () => {
    // A domain with no product is refused by the shop's store: an error in the shop alone.
    const root = workspace({ ...shop, domain: [{ id: 'SH-SELL', title: 'Selling', subdomain_type: 'core', description: 'Selling parts to customers.' }] });
    const broken = lathe('check', '--root', root);
    expect(broken.status).toBe(1);
    expect(broken.stdout).toContain(`Checked 2 records in ${root}\n`);
    expect(broken.stdout).toContain(`Checked 0 records in ${path.join(root, SHOP)}\n`);
    expect(broken.stdout).toMatch(/0 errors, \d+ warnings?\.\n\nChecked 0 records/);
    expect(broken.stdout).toMatch(/\nAll 2 products: [1-9]\d* errors?, \d+ warnings?\.\n$/);
    const json = JSON.parse(lathe('check', '--root', root, '--json').stdout) as { products: { root: string }[] };
    expect(json.products.map((p) => p.root)).toEqual(['.', SHOP]);

    write(root, prefixed(SHOP, rows(shop)));
    const fixed = lathe('check', '--root', root);
    expect(fixed.status).toBe(0);
    expect(fixed.stdout).toMatch(/\nAll 2 products: 0 errors, \d+ warnings?\.\n$/);
  });

  it('LA-PLT-UC02-R10-T01 The workspace traces no file of a listed product\'s folder', async () => {
    const shopCode = prefixed(SHOP, {
      'src/code.ts': 'export {};\n',
      'src/router.ts': "app.get('/basket', show);\n",
      'src/code.test.ts': "it('names no record', () => {});\n",
      'package.json': JSON.stringify({ dependencies: { 'left-pad': '1.0.0' } }),
    });
    const root = workspace(shop, { ...shopCode, 'src/main.ts': 'export {};\n' }, { routers: ['**/router.ts'] });
    expect(await sourceFiles(root, DEFAULT_SOURCE, DEFAULT_TESTS)).toEqual(['src/main.ts']);
    // The default package folders leave out a folder with its own config, at any depth below the root's own.
    write(root, prefixed('shopfront', { 'lathe.config.json': config({}), 'package.json': '{}' }));
    expect(readPackageFacts(root, null)).toEqual([]);
    const store = await openStore(root, { latheDataDir: null });
    try {
      expect((await gatherRouteFacts({ root, routers: ['**/router.ts'] }, store)).served).toEqual([]);
    } finally {
      await store.close();
    }
    const [ws] = await loadProducts(root, { latheDataDir: null });
    const said = JSON.stringify([ws.workspace.problems, ws.workspace.coverage]);
    expect(said).not.toContain('examples/shop');
    expect(said).not.toContain('left-pad');
    // A package folder listed inside another product is refused.
    write(root, { 'lathe.config.json': config({ products: [SHOP], packages: [SHOP] }) });
    expect(() => loadConfig(root)).toThrow(/examples\/shop is another product's folder/);
  });

  it('LA-PLT-UC02-R11-T01 The API serves every product of the workspace, writes to each product\'s folder and watches each', async () => {
    const root = workspace();
    opened.push(root);
    const spec = (await request(root, '/api/spec')).json() as SpecData;
    expect(spec.sources.map((s) => s.dataDir)).toEqual(['data', `${SHOP}/data`]);
    expect(spec.sources.map((s) => s.tables.product.map((p) => p.id))).toEqual([['WS'], ['SH']]);
    // A read that names no record reads every product's folder: the nav lists every product.
    const listed = await request(root, '/api/product/list-products');
    expect(listed.status).toBe(200);
    expect((listed.json() as { id: string }[]).map((p) => p.id)).toEqual(['SH', 'WS']);

    // A new record under the shop's domain goes to the shop's folder, a new product to the workspace's.
    const added = await request(root, '/api/write', { commands: [{ op: 'add', table: 'capability', row: { id: 'SH-SELL-CAP01', title: 'Checkout', domain_id: 'SH-SELL', position: 1, description: 'Paying for a basket.' } }] });
    expect(added.status).toBe(200);
    expect(existsSync(path.join(root, SHOP, 'data/capability.jsonl'))).toBe(true);
    expect(existsSync(path.join(root, 'data/capability.jsonl'))).toBe(false);
    expect((await request(root, '/api/write', { commands: [{ op: 'add', table: 'product', row: { id: 'NP', title: 'New product', description: 'A product added through the API.' } }] })).status).toBe(200);
    expect(readFileSync(path.join(root, 'data/product.jsonl'), 'utf8')).toContain('"NP"');

    expect(watchTargets(root).map((t) => t.dir)).toEqual(expect.arrayContaining([path.join(root, 'data'), path.join(root, SHOP, 'data')]));
  });

  it('LA-PLT-EP01-R02-T01 GET /api/spec serves each product folder\'s rows apart under one schema', async () => {
    const shopKind: Data = {
      ...shop,
      product_kind: [{ name: 'shelf', product_id: 'SH', label: 'Shelf', description: 'A shelf in the shop.', parent_kind: 'domain', obligation: false }],
    };
    const root = workspace(shopKind);
    opened.push(root);
    const answer = await request(root, '/api/spec');
    expect(answer.status).toBe(200);
    const spec = answer.json() as SpecData;
    expect(spec.sources[0].dataDir).toBe('data');
    expect(spec.schema.kinds.shelf?.productId).toBe('SH');
    expect(spec.schema.loadOrder).toContain('shelf');
    expect([...new Set(spec.coverage.map((c) => c.product))].sort()).toEqual(['SH', 'WS']);

    const twice = workspace({ product: [{ id: 'WS', title: 'Workspace again', description: 'The same product in a second folder.' }] });
    opened.push(twice);
    const clash = await request(twice, '/api/spec');
    expect(clash.status).toBe(500);
    expect(JSON.stringify(clash.json())).toContain('The product WS is in two folders, . and examples/shop');
  });

  it('LA-AUT-EP02-R03-T01 POST /api/write goes to the folder of the product its commands name', async () => {
    const root = workspace();
    opened.push(root);
    const shopFile = path.join(root, SHOP, 'data/domain.jsonl');
    const ownFile = path.join(root, 'data/domain.jsonl');
    const ownBefore = readFileSync(ownFile, 'utf8');
    const set = await request(root, '/api/write', { commands: [{ op: 'set', table: 'domain', key: 'SH-SELL', changes: { title: 'Sales' } }] });
    expect(set.status).toBe(200);
    expect(readFileSync(shopFile, 'utf8')).toContain('"Sales"');
    expect(readFileSync(ownFile, 'utf8')).toBe(ownBefore);

    const shopBefore = readFileSync(shopFile, 'utf8');
    const mixed = await request(root, '/api/write', { commands: [
      { op: 'set', table: 'domain', key: 'SH-SELL', changes: { title: 'Selling' } },
      { op: 'set', table: 'domain', key: 'WS-CORE', changes: { title: 'Heart' } },
    ] });
    expect(mixed.status).toBe(422);
    expect((mixed.json() as WriteAnswer & { ok: false }).error).toBe("A write changes one product: these commands name records in examples/shop and the workspace's own folder. Send each product's commands as a write of its own.");
    expect(readFileSync(shopFile, 'utf8')).toBe(shopBefore);
    expect(readFileSync(ownFile, 'utf8')).toBe(ownBefore);
  });
});
