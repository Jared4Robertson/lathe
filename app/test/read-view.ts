import type { ReadView } from '../../lathe/src/platform/data/rules';
import type { Row, SpecData } from '../../lathe/src/server/contract';

// The served data as the test server's queries read it (helpers.tsx serve), apart from the app so the pure tests read
// a query's answer without loading it (trace/traces.ts).

/**
 * The served data as the aggregates' queries read it: each table's rows over every product folder, each record by its
 * ID, and the served problems, coverage and chains as the checks' run over them.
 */
export function readViewOf(data: SpecData): ReadView {
  const rows = (table: string) => data.sources.flatMap((source) => source.tables[table] ?? []);
  let byId: Map<string, { kind: string; row: Row }> | null = null;
  return {
    schema: data.schema,
    checked: { problems: data.problems, coverage: data.coverage, chains: data.chains },
    rows,
    record: (id) => {
      byId ??= new Map(Object.keys(data.schema.kinds).flatMap((kind) => rows(kind).map((row) => [String(row.id), { kind, row }] as const)));
      return byId.get(id);
    },
  };
}

