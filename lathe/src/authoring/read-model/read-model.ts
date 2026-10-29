// The Read model read model (LA-AUT-RM30): what the Read model aggregate's queries answer with, shaped for their
// readers and built from rows by its projection. It shares no types with the aggregate's model.
import type { Row } from '../../platform/data/rows.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { ProjectionRow, QueryHandlerRow, QueryRow, ReadModelFieldRow, ReadModelRow } from '../../platform/data/tables.ts';

/** A technical record's row with the standard rules it meets and the packages it uses. */
type Built<T> = T & { meets: string[]; packages: string[] };

/** One read model's page: its row, fields and links, its queries each with its links and handler, and its projection. */
export interface ReadModelPage {
  readModel: ReadModelRow;
  fields: ReadModelFieldRow[];
  reads: string[];
  calls: string[];
  fedBy: string[];
  queries: (QueryRow & { selectsBy: string[]; calls: string[]; handler: Built<QueryHandlerRow> | null })[];
  projection: Built<ProjectionRow> | null;
}

/** One line of a list of read models. */
export interface ReadModelSummary {
  id: string;
  title: string;
}

/** The column naming each record's parent inside the read model: none for the read model itself. */
export const PARENT_OF = { read_model: null, query: 'read_model_id', projection: 'read_model_id', query_handler: 'query_id' } as const;

// A link table's targets by source, each list sorted.
function bySource(links: Row[], source = 'source_id', target = 'target_id'): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const l of links) found.set(String(l[source]), [...(found.get(String(l[source])) ?? []), String(l[target])]);
  for (const list of found.values()) list.sort();
  return found;
}

/** The projection: each read model's page, from the rows; only the one given, when given. */
export function readModelPagesFrom(view: ReadView, only?: string): ReadModelPage[] {
  const readModels = (view.rows('read_model') as unknown as ReadModelRow[]).filter((r) => only === undefined || r.id === only);
  if (!readModels.length) return [];
  const [reads, calls, fedBy, selectsBy, meets] = ['reads', 'calls', 'fed_by', 'selects_by', 'meets'].map((table) => bySource(view.rows(table)));
  const packages = bySource(view.rows('package_use'), 'record_id', 'package');
  const built = <T extends { id: string }>(row: T): Built<T> => ({ ...row, meets: meets.get(row.id) ?? [], packages: packages.get(row.id) ?? [] });
  const fields = view.rows('read_model_field') as unknown as ReadModelFieldRow[];
  const queries = view.rows('query') as unknown as QueryRow[];
  const handlers = view.rows('query_handler') as unknown as QueryHandlerRow[];
  const projections = view.rows('projection') as unknown as ProjectionRow[];
  return readModels.map((readModel) => {
    const projection = projections.find((p) => p.read_model_id === readModel.id);
    return {
      readModel,
      fields: fields.filter((f) => f.read_model_id === readModel.id).sort((a, b) => a.position - b.position),
      reads: reads.get(readModel.id) ?? [],
      calls: calls.get(readModel.id) ?? [],
      fedBy: fedBy.get(readModel.id) ?? [],
      queries: queries
        .filter((q) => q.read_model_id === readModel.id)
        .map((q) => {
          const handler = handlers.find((h) => h.query_id === q.id);
          return { ...q, selectsBy: selectsBy.get(q.id) ?? [], calls: calls.get(q.id) ?? [], handler: handler ? built(handler) : null };
        }),
      projection: projection ? built(projection) : null,
    };
  });
}
