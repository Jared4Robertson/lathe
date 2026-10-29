// The Specification read model (LA-AUT-RM25): what the Specification aggregate's queries answer with, shaped for
// their readers and built from rows by its projection. It shares no types with the aggregate's model.
import type { Row } from '../../platform/data/rows.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { PredicateRow, SpecificationRow, SpecificationTestRow } from '../../platform/data/tables.ts';

/** One specification's page: its row, the aggregates it reads, its predicate and its test, each with its links. */
export interface SpecificationPage {
  specification: SpecificationRow;
  reads: string[];
  predicate: (PredicateRow & { meets: string[]; packages: string[] }) | null;
  test: (SpecificationTestRow & { startsFrom: string[] }) | null;
}

/** One line of a list of specifications. */
export interface SpecificationSummary {
  id: string;
  title: string;
}

/** The column naming each record's specification: none for the specification itself. */
export const SPECIFICATION_OF = { specification: null, predicate: 'specification_id', specification_test: 'specification_id' } as const;

// A link table's targets by source, each list sorted.
function bySource(links: Row[], source = 'source_id', target = 'target_id'): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const l of links) found.set(String(l[source]), [...(found.get(String(l[source])) ?? []), String(l[target])]);
  for (const list of found.values()) list.sort();
  return found;
}

/** The projection: each specification's page, from the rows; only the one given, when given. */
export function specificationPagesFrom(view: ReadView, only?: string): SpecificationPage[] {
  const specifications = (view.rows('specification') as unknown as SpecificationRow[]).filter((s) => only === undefined || s.id === only);
  if (!specifications.length) return [];
  const [reads, meets, startsFrom] = ['reads', 'meets', 'starts_from'].map((table) => bySource(view.rows(table)));
  const packages = bySource(view.rows('package_use'), 'record_id', 'package');
  const predicates = view.rows('predicate') as unknown as PredicateRow[];
  const tests = view.rows('specification_test') as unknown as SpecificationTestRow[];
  return specifications.map((specification) => {
    const predicate = predicates.find((p) => p.specification_id === specification.id);
    const test = tests.find((t) => t.specification_id === specification.id);
    return {
      specification,
      reads: reads.get(specification.id) ?? [],
      predicate: predicate ? { ...predicate, meets: meets.get(predicate.id) ?? [], packages: packages.get(predicate.id) ?? [] } : null,
      test: test ? { ...test, startsFrom: startsFrom.get(test.id) ?? [] } : null,
    };
  });
}
