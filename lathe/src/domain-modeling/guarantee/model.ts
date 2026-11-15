// The Guarantee aggregate (LA-MOD-A24): a promise a platform domain makes to every other domain of its product, with
// the building blocks that keep it (kept_by) and its guarantee tests (each with the test data sets it starts from). One
// instance is one guarantee, whole; it holds only the links its own records start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { GuaranteeRow, GuaranteeTestRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const GUARANTEE_AGGREGATE = 'LA-MOD-A24';

/** A test with the test data sets it starts from. */
export interface Tested<T> {
  row: T;
  startsFrom: string[];
}

/** One guarantee, whole. */
export interface Guarantee {
  /** The guarantee's ID: the aggregate's root. */
  readonly root: string;
  guarantee: GuaranteeRow;
  /** The building blocks that keep it, by ID. */
  keptBy: string[];
  /** Its guarantee tests, by ID. */
  tests: Tested<GuaranteeTestRow>[];
}

/** The tables the Guarantee aggregate keeps its rows in: its kinds, and the relations its records start. */
export const GUARANTEE_TABLES = ['guarantee', 'guarantee_test', 'kept_by', 'starts_from'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const GUARANTEE_SHAPE = {
  guarantee: { at: 'guarantee', lists: { kept_by: 'keptBy' } },
  guarantee_test: { at: 'tests', lists: { starts_from: 'startsFrom' } },
} as const satisfies AggregateShape;

export type GuaranteeKind = keyof typeof GUARANTEE_SHAPE;

/** The guarantees in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function guaranteesFrom(rows: (table: string) => Row[], only?: string): Guarantee[] {
  const guarantees = rows('guarantee').filter((r) => only === undefined || r.id === only) as unknown as GuaranteeRow[];
  if (!guarantees.length) return [];
  const ids = new Set(guarantees.map((g) => g.id));
  const testsOf = groupBy((rows('guarantee_test') as unknown as GuaranteeTestRow[]).filter((t) => ids.has(t.guarantee_id)), (t) => t.guarantee_id);
  const [keptBy, startsFrom] = ['kept_by', 'starts_from'].map((table) => bySource(rows(table)));
  return guarantees.map((guarantee) => ({
    root: guarantee.id,
    guarantee,
    keptBy: groupOf(keptBy, guarantee.id),
    tests: groupOf(testsOf, guarantee.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
  }));
}

const links = (source: string, ids: string[]): Row[] => ids.map((target) => ({ source_id: source, target_id: target }));

/** The instance's rows, by table. */
export function guaranteeRows(guarantee: Guarantee): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  return new Map<string, Row[]>([
    ['guarantee', [asRow(guarantee.guarantee)]],
    ['guarantee_test', guarantee.tests.map((t) => asRow(t.row))],
    ['kept_by', links(guarantee.root, guarantee.keptBy)],
    ['starts_from', guarantee.tests.flatMap((t) => links(t.row.id, t.startsFrom))],
  ]);
}
