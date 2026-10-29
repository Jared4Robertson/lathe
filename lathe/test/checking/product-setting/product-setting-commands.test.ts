// The Product setting aggregate's command and query (LA-CHK-A2), run on a product as the CLI, the MCP tools and the
// HTTP API run them: Set the product's limits writes the product's one settings row through ProductSettingRepository,
// and Get the product's limits reads it, or the defaults.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SET_LIMITS } from '../../../src/checking/product-setting/commands/set-limits.ts';
import { GET_LIMITS } from '../../../src/checking/product-setting/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { closeCheckingStores, productBesideLathesChecks } from '../data-set.ts';
import { productSettingDataSet } from './data-set.ts';

afterEach(closeCheckingStores);

describe("LA-CHK-UC06-R50-T01 Set the product's limits (LA-CHK-A2) writes the product's one settings row through ProductSettingRepository, and is reached by name from the CLI, the MCP tools and HTTP", () => {
  it('reads the defaults until the limits are set, then the product\'s own, kept in one row', async () => {
    const fresh = await productBesideLathesChecks();
    expect(runQuery(fresh, GET_LIMITS, { product_id: 'TL' })).toEqual({ product: 'TL', maxChildren: 15, maxEntitiesPerAggregate: 7, own: false });
    const store = await productSettingDataSet();
    expect(runQuery(store, GET_LIMITS, { product_id: 'TL' })).toEqual({ product: 'TL', maxChildren: 20, maxEntitiesPerAggregate: 9, own: true });
    const again = await runCommand(store, SET_LIMITS, { product_id: 'TL', max_children: 12, max_entities_per_aggregate: 9 });
    expect(again.changes.map((c) => c.table)).toEqual(['product_setting']);
    expect(store.rows('product_setting')).toEqual([{ product_id: 'TL', max_children: 12, max_entities_per_aggregate: 9 }]);
    expect(() => runQuery(store, GET_LIMITS, { product_id: 'XX' })).toThrow(/there is no product XX/);
  });

  it('refuses a limit below 1 and a limit left out, changing nothing', async () => {
    const store = await productSettingDataSet();
    await expect(runCommand(store, SET_LIMITS, { product_id: 'TL', max_children: 0, max_entities_per_aggregate: 9 })).rejects.toThrow();
    await expect(runCommand(store, SET_LIMITS, { product_id: 'TL', max_children: 10 })).rejects.toThrow(new InputError('set-limits needs max_entities_per_aggregate'));
    expect(store.rows('product_setting')).toEqual([{ product_id: 'TL', max_children: 20, max_entities_per_aggregate: 9 }]);
  });

  it('runs `lathe product-setting set-limits`, the product_setting_ tools and POST /api/product-setting/set-limits', async () => {
    const store = await productSettingDataSet();
    const root = path.dirname(store.dataDir);
    await closeCheckingStores();
    const out: string[] = [];
    expect(await runAggregateCommand(['product-setting', 'set-limits', '--product_id', 'TL', '--max_children', '30', '--max_entities_per_aggregate', '8', '--root', root], { out: (t) => out.push(t), err: (t) => out.push(t) })).toBe(0);
    expect((await callTool(root, 'product_setting_get_limits', { product_id: 'TL' })).content[0].text).toBe('Limits of TL\n  max_children: 30\n  max_entities_per_aggregate: 8');
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const posted = await fetch(`${base}/api/product-setting/set-limits`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product_id: 'TL', max_children: 15, max_entities_per_aggregate: 7 }) });
      expect(posted.status).toBe(200);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
