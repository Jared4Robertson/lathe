// The Trace read (LA-TRC-RM11, LA-TRC-QRY15): each obligation of a product's space with its chain, its gaps and whether
// only proof is asked of it, and the records coverage reports untraced, read from the checks' run through the read
// model's reader, as the CLI, the MCP tools and the HTTP API read it.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LIST_TRACES } from '../../../src/traceability/trace/queries.ts';
import type { ProductTraces } from '../../../src/traceability/trace/read-model.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { answerQuery, runQuery } from '../../../src/platform/commands/run.ts';
import type { CheckRun, ReadView } from '../../../src/platform/data/rules.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import type { Coverage, CoverageGap, TraceChain } from '../../../src/types.ts';
import { closeTwoProducts, twoProducts } from '../../checking/problems/data-set.ts';
import { openStore } from '../../../src/platform/data/store.ts';
import { compareIds } from '../../../src/platform/data/ids.ts';
import { adding, complete, writeData } from '../../helpers.ts';

afterEach(closeTwoProducts);

const gap = (id: string, kind: string, missing: string): CoverageGap => ({ id, kind, missing, message: `${id} misses ${missing}.` });
const chain = (obligation: string, design: string[], build: string[], tests: string[]): TraceChain => ({
  obligation, design, build, tests,
  files: build.map((b) => ({ path: `src/${b}.ts`, named_by: [b] })),
  links: [...design, ...build, ...tests].map((r) => [obligation, r] as [string, string]),
});
const coverage = (product: string, domain: string | null, gaps: CoverageGap[], proofOnly: string[] = []): Coverage => ({
  product, domain, gaps,
  obligations: proofOnly.map((kind) => ({ kind, label: kind, total: 1, designed: 1, built: 1, proved: 0, not_automated: 0, proof_only: true })),
  tests: { automated: 0, manual: 0, not_automated: 0 },
  proved_by: {},
  pattern_rules: [],
});

/** The store's data with a run of the checks that worked out these chains and this coverage. */
const withRun = (store: Store, run: Omit<CheckRun, 'problems'>): ReadView => ({ schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id), checked: { problems: [], ...run } });

describe('LA-TRC-UC10-R05-T03 A product\'s traces read gives each obligation of its space the engine\'s chain, the gaps coverage reports and whether only proof is asked of it, and the records coverage reports untraced', () => {
  it('reads every chain of the product\'s obligations, placed through their parents or their IDs, and nothing of another product', async () => {
    const store = await twoProducts();
    const view = withRun(store, {
      chains: [
        chain('EX-LEND-INV01', ['EX-LEND-A1'], ['EX-LEND-EN01'], []),
        chain('EX-VO01-C01', ['EX-VO01'], [], []),
        chain('EX-PAT-ACT-R01', [], [], []),
        chain('NF-NOTE-INV01', [], [], []),
      ],
      coverage: [
        coverage('EX', 'EX-LEND', [gap('EX-LEND-INV01', 'invariant', 'proved'), gap('EX-LEND-SP01', 'specification', 'designed'), gap('EX-LEND-SP01', 'specification', 'built'), gap('EX-LEND-CMD09', 'command', 'record-untraced')], ['pattern_rule']),
        coverage('EX', null, [gap('EX-VO01-C01', 'constraint', 'proved'), gap('EX-VO01-C01', 'constraint', 'designed')]),
        coverage('NF', 'NF-NOTE', [gap('NF-NOTE-CMD01', 'command', 'record-untraced')]),
      ],
    });
    const ex = runQuery(view, LIST_TRACES, { product_id: 'EX' }) as ProductTraces;
    expect(ex.product).toBe('EX');
    expect(ex.traces.map((t) => t.obligation)).toEqual(['EX-LEND-INV01', 'EX-VO01-C01', 'EX-PAT-ACT-R01', 'EX-LEND-SP01']);
    expect(ex.traces[0]).toEqual({
      obligation: 'EX-LEND-INV01', design: ['EX-LEND-A1'], build: ['EX-LEND-EN01'], tests: [],
      files: [{ path: 'src/EX-LEND-EN01.ts', namedBy: ['EX-LEND-EN01'] }],
      links: [['EX-LEND-INV01', 'EX-LEND-A1'], ['EX-LEND-INV01', 'EX-LEND-EN01']],
      gaps: ['proved'], proofOnly: false,
    });
    // Gaps in the order designed, built, proved, wherever coverage reports them; a pattern rule owes proof only.
    expect(ex.traces[1].gaps).toEqual(['designed', 'proved']);
    expect(ex.traces[2].proofOnly).toBe(true);
    // An obligation with a gap and no chain still has its gaps.
    expect(ex.traces[3]).toMatchObject({ obligation: 'EX-LEND-SP01', design: [], gaps: ['designed', 'built'] });
    expect(ex.untraced).toEqual(['EX-LEND-CMD09']);
    const nf = runQuery(view, LIST_TRACES, { product_id: 'NF' }) as ProductTraces;
    expect(nf.traces).toEqual([]);
    expect(nf.untraced).toEqual(['NF-NOTE-CMD01']);
    expect(() => runQuery(view, LIST_TRACES, { product_id: 'XX' })).toThrow(/there is no product XX/);
  });

  it('gives the product\'s outcomes and each use case of its space with the outcomes its capability serves and the obligations it reaches', async () => {
    const data = adding(complete(), {
      capability: [{ id: 'EX-LEND-CAP02', title: 'Cataloging', domain_id: 'EX-LEND', position: 2, description: 'Keeping the catalog.' }],
      use_case: [{ id: 'EX-LEND-UC09', title: 'Count the shelf', capability_id: 'EX-LEND-CAP02', goal: 'Know what is on the shelf.' }],
      uc_requirement: [{ id: 'EX-LEND-UC09-R01', title: 'Every tool is counted', use_case_id: 'EX-LEND-UC09', statement: 'Every tool on the shelf MUST be counted.' }],
    });
    const store = await openStore(writeData(data));
    try {
      const ex = runQuery(withRun(store, { chains: [], coverage: [] }), LIST_TRACES, { product_id: 'EX' }) as ProductTraces;
      expect(ex.outcomes).toEqual(['EX-BO01']);
      const uc01 = ex.useCases.find((u) => u.useCase === 'EX-LEND-UC01')!;
      expect(uc01.outcomes).toEqual(['EX-BO01']);
      // Its own requirements, and the invariants, specifications and view requirements it reaches through its steps.
      expect(uc01.reaches).toEqual(expect.arrayContaining(['EX-LEND-UC01-R01', 'EX-LEND-INV01', 'EX-LEND-SP01', 'EX-V01-R01']));
      // Only obligations: no aggregate, command or test.
      expect(uc01.reaches).not.toContain('EX-LEND-A1');
      expect(uc01.reaches).not.toContain('EX-LEND-INV01-T');
      // A use case whose capability serves nothing still reaches its own requirements, serving no outcome.
      expect(ex.useCases.find((u) => u.useCase === 'EX-LEND-UC09')).toEqual({ useCase: 'EX-LEND-UC09', outcomes: [], reaches: ['EX-LEND-UC09-R01'] });
      expect(ex.useCases.map((u) => u.useCase)).toEqual([...ex.useCases.map((u) => u.useCase)].sort(compareIds));
    } finally {
      await store.close();
    }
  });

  it('is refused over data that comes without the checks\' run', async () => {
    const store = await twoProducts();
    expect(() => answerQuery(store, LIST_TRACES, { product_id: 'EX' })).toThrow(/LA-TRC-QRY15 reads the checks' run/);
  });

  it('runs the checks first for `lathe trace list-traces` and the trace_list_traces tool, and GET /api/trace/list-traces reads the server\'s run', async () => {
    const store = await twoProducts();
    const root = path.dirname(store.dataDir);
    await closeTwoProducts();
    const out: string[] = [];
    expect(await runAggregateCommand(['trace', 'list-traces', '--product_id', 'EX', '--json', '--root', root], { out: (t) => out.push(t), err: (t) => out.push(t) })).toBe(0);
    const cli = JSON.parse(out[0]) as ProductTraces;
    expect(cli.product).toBe('EX');
    expect(cli.traces.map((t) => t.obligation)).toEqual(expect.arrayContaining(['EX-LEND-INV01', 'EX-VO01-C01', 'EX-LEND-SP01', 'EX-PAT-ACT-R01']));
    expect(cli.traces.map((t) => t.obligation)).not.toContain('NF-NOTE');
    expect((await callTool(root, 'trace_list_traces', { product_id: 'EX' })).content[0].text).toMatch(/^EX: \d+ obligations traced/);
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const read = await fetch(`${base}/api/trace/list-traces?product_id=EX`);
      expect(read.status).toBe(200);
      expect(await read.json()).toEqual(cli);
      expect((await fetch(`${base}/api/trace/list-traces?product_id=XX`)).status).toBe(422);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
