// The Problems read (LA-CHK-RM01, LA-CHK-QRY02): a product's problems as its Checks panel lists them, read from the
// checks' run through the read model's reader, as the CLI, the MCP tools and the HTTP API read it.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LIST_PROBLEMS } from '../../../src/checking/problems/queries.ts';
import type { ProductProblems } from '../../../src/checking/problems/read-model.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { answerQuery, runQuery } from '../../../src/platform/commands/run.ts';
import type { CheckRun, ReadView } from '../../../src/platform/data/rules.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import type { Problem } from '../../../src/types.ts';
import { closeTwoProducts, twoProducts } from './data-set.ts';

afterEach(closeTwoProducts);

const problem = (severity: Problem['severity'], check: string, record: string | null): Problem => ({ severity, check, record, message: `${check} on ${record ?? 'the workspace'}.` });

/** The store's data with a run of the checks that found these problems. */
const withRun = (store: Store, problems: Problem[]): ReadView => {
  const checked: CheckRun = { problems, coverage: [], chains: [] };
  return { schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id), checked };
};

describe('LA-CHK-UC07-R01-T02 A product\'s problems read lists its own by check, errors first, then the workspace\'s, counted, and leaves out every other product\'s', () => {
  it('places each problem in its record\'s product, through its parents or its ID, and the rest in the workspace', async () => {
    const store = await twoProducts();
    const view = withRun(store, [
      problem('warning', 'not-proved', 'EX-LEND-INV01'),
      problem('warning', 'not-proved', 'EX-VO01-C01'),
      problem('error', 'test-file-missing', 'EX-LEND-SP01'),
      problem('warning', 'lone-child', 'EX-PAT-ACT'),
      problem('error', 'lone-domain', 'NF-NOTE'),
      problem('error', 'engine', null),
      problem('warning', 'unknown-record', 'XX-GONE'),
    ]);
    const ex = runQuery(view, LIST_PROBLEMS, { product_id: 'EX' }) as ProductProblems;
    expect(ex.product).toBe('EX');
    expect([ex.errors, ex.warnings]).toEqual([2, 4]);
    expect(ex.own.map((g) => [g.check, g.problems.map((p) => p.record)])).toEqual([
      ['test-file-missing', ['EX-LEND-SP01']],
      ['lone-child', ['EX-PAT-ACT']],
      ['not-proved', ['EX-LEND-INV01', 'EX-VO01-C01']],
    ]);
    // A problem about no record, or about an ID no record has, belongs to every space.
    expect(ex.workspace.map((g) => [g.check, g.problems.map((p) => p.record)])).toEqual([
      ['engine', [null]],
      ['unknown-record', ['XX-GONE']],
    ]);
    const nf = runQuery(view, LIST_PROBLEMS, { product_id: 'NF' }) as ProductProblems;
    expect([nf.errors, nf.warnings]).toEqual([2, 1]);
    expect(nf.own.map((g) => g.check)).toEqual(['lone-domain']);
    expect(nf.workspace).toEqual(ex.workspace);
    expect(() => runQuery(view, LIST_PROBLEMS, { product_id: 'XX' })).toThrow(/there is no product XX/);
  });

  it('is refused over data that comes without the checks\' run', async () => {
    const store = await twoProducts();
    expect(() => answerQuery(store, LIST_PROBLEMS, { product_id: 'EX' })).toThrow(/LA-CHK-QRY02 reads the checks' run/);
  });

  it('runs the checks first for `lathe problems list-problems` and the problems_list_problems tool, and GET /api/problems/list-problems reads the server\'s run', async () => {
    const store = await twoProducts();
    const root = path.dirname(store.dataDir);
    await closeTwoProducts();
    const out: string[] = [];
    expect(await runAggregateCommand(['problems', 'list-problems', '--product_id', 'EX', '--json', '--root', root], { out: (t) => out.push(t), err: (t) => out.push(t) })).toBe(0);
    const cli = JSON.parse(out[0]) as ProductProblems;
    expect(cli.product).toBe('EX');
    expect(cli.errors + cli.warnings).toBe([...cli.own, ...cli.workspace].reduce((n, g) => n + g.problems.length, 0));
    expect((await callTool(root, 'problems_list_problems', { product_id: 'EX' })).content[0].text).toMatch(/^EX: \d+ errors? · \d+ warnings?/);
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const read = await fetch(`${base}/api/problems/list-problems?product_id=EX`);
      expect(read.status).toBe(200);
      expect(await read.json()).toEqual(cli);
      expect((await fetch(`${base}/api/problems/list-problems?product_id=XX`)).status).toBe(422);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
