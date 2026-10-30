import type { ReadView } from '../../lathe/src/platform/data/rules';
import type { SchemaDescription } from '../../lathe/src/platform/data/schema';
import type { Row } from '../../lathe/src/server/contract';
import type { Coverage, Problem, TraceChain } from '../../lathe/src/types';
import { answerQuery } from '../../lathe/src/platform/commands/run';
import { GET_META_MODEL } from '../../lathe/src/platform/meta-model/queries';
import { LIST_RECORD_SUMMARIES } from '../../lathe/src/exploring/record-summaries/queries';
import { GET_FOLDER_TREE } from '../../lathe/src/exploring/folder-tree/queries';
import { LIST_PROBLEMS } from '../../lathe/src/checking/problems/queries';
import { GET_COVERAGE } from '../../lathe/src/traceability/coverage/queries';
import type { MetaModel } from '../../lathe/src/platform/meta-model/read-model';
import type { RecordSummaries } from '../../lathe/src/exploring/record-summaries/read-model';
import type { FolderTree } from '../../lathe/src/exploring/folder-tree/read-model';
import type { ProductProblems } from '../../lathe/src/checking/problems/read-model';
import type { ProductCoverage } from '../../lathe/src/traceability/coverage/read-model';
import { buildRecordIndex, type RecordIndex } from '../src/exploring/record-summaries/record-index';
import { indexMetaModel } from '../src/platform/meta-model/reads';

/**
 * The data the test server serves (helpers.tsx serve): the schema, each product folder's rows, and the checks' run over
 * them (problems, coverage, chains), as the server's stores and kept run would give them.
 */
export interface ServedData {
  schema: SchemaDescription;
  /** Each product folder's rows: its data folder and every stored table's rows. */
  sources: { dataDir: string; tables: Record<string, Row[]> }[];
  problems: Problem[];
  coverage: Coverage[];
  chains: TraceChain[];
}

// The served data as the test server's queries read it (helpers.tsx serve), apart from the app so the pure tests read
// a query's answer without loading it (trace/traces.ts).

/**
 * The served data as the aggregates' queries read it: each table's rows over every product folder, each record by its
 * ID, and the served problems, coverage and chains as the checks' run over them.
 */
export function readViewOf(data: ServedData): ReadView {
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


/** A product's space index as the app builds it from its reads, each answered by its query over the served data. */
export function recordIndexOf(data: ServedData, product: string): RecordIndex {
  const view = readViewOf(data);
  const ask = <R>(query: Parameters<typeof answerQuery>[1], input: Record<string, unknown>) => answerQuery(view, query, input) as R;
  return buildRecordIndex(
    indexMetaModel(ask<MetaModel>(GET_META_MODEL, {})),
    ask<RecordSummaries>(LIST_RECORD_SUMMARIES, { product_id: product }),
    ask<FolderTree>(GET_FOLDER_TREE, { product_id: product }),
    ask<ProductProblems>(LIST_PROBLEMS, { product_id: product }),
    ask<ProductCoverage>(GET_COVERAGE, { product_id: product }),
  );
}
