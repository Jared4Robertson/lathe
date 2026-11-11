// What the flow tests in the stability suite share: the workspace the dev server reads, read here through each product's
// own store with the engine's run over it (problems, coverage, chains), so a flow can check the page against the
// figures the engine worked out. The app itself never reads rows: it reads each stage's and aggregate's own query.
import path from 'node:path';
import { loadConfig, readWorkspace } from '../../lathe/src/index';
import { openStore } from '../../lathe/src/platform/data/index';
import type { Row } from '../../lathe/src/server/contract';
import type { Coverage, Problem, TraceChain } from '../../lathe/src/types';

/** The workspace's rows and the engine's run over them. */
export interface Served {
  /** Each stored table's rows, every product folder's. */
  tables: Record<string, Row[]>;
  problems: Problem[];
  coverage: Coverage[];
  chains: TraceChain[];
}

/** The workspace the dev server reads now: the suite's copy of this repo's products (Lathe's and the Tool Library's), each through its own store. */
export async function servedWorkspace(): Promise<Served> {
  const repo = process.env.STABILITY_ROOT ?? path.resolve(import.meta.dirname, '../..');
  const served: Served = { tables: {}, problems: [], coverage: [], chains: [] };
  for (const root of [repo, path.join(repo, 'examples/tool-library')]) {
    const store = await openStore(root);
    try {
      for (const table of store.schema.loadOrder) served.tables[table] = [...(served.tables[table] ?? []), ...store.rows(table)];
      const run = await readWorkspace(store, loadConfig(root));
      served.problems.push(...run.problems);
      served.coverage.push(...run.coverage);
      served.chains.push(...run.chains);
    } finally {
      await store.close();
    }
  }
  return served;
}

/** The rows of one stored table, from every product folder. */
export const rowsOf = (spec: Served, table: string) => spec.tables[table] ?? [];

/** A count as the app writes it: thousands separated (LA-PAT-APP-UX-R25). */
const figure = (n: number) => n.toLocaleString('en-US');

/** "12 automated, 1 manual, 2 not automated yet", as the app words a domain's tests by state. */
export const testsText = (t: { automated: number; manual: number; not_automated: number }) => `${figure(t.automated)} automated, ${figure(t.manual)} manual, ${figure(t.not_automated)} not automated yet`;
/** The Tests automated key metric as it reads: "12 of 15 tests 2 manual, 1 not automated yet". */
export const testsMetricText = (t: { automated: number; manual: number; not_automated: number }) =>
  `${figure(t.automated)} of ${figure(t.automated + t.manual + t.not_automated)} tests ${figure(t.manual)} manual, ${figure(t.not_automated)} not automated yet`;
