// The Standard aggregate (LA-TEC-A3): engineering rules the product's code follows: a standard with its rules, and each
// rule's tests (with the test data sets they start from). One instance is one standard, whole; the technical records
// that meet its rules start those links in their own aggregates.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { StandardRow, StandardRuleRow, StandardRuleTestRow } from '../../platform/data/tables.ts';

/** A test with the test data sets it starts from. */
export interface Tested<T> {
  row: T;
  startsFrom: string[];
}

/** One standard, whole. */
export interface Standard {
  /** The standard's ID: the aggregate's root. */
  readonly root: string;
  standard: StandardRow;
  rules: StandardRuleRow[];
  ruleTests: Tested<StandardRuleTestRow>[];
}

/** The tables the Standard aggregate keeps its rows in: its kinds and the relation its tests start. */
export const STANDARD_TABLES = ['standard', 'standard_rule', 'standard_rule_test', 'starts_from'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const STANDARD_SHAPE = {
  standard: { at: 'standard' },
  standard_rule: { at: 'rules' },
  standard_rule_test: { at: 'ruleTests', lists: { starts_from: 'startsFrom' } },
} as const satisfies AggregateShape;

export type StandardKind = keyof typeof STANDARD_SHAPE;

/** The standards in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function standardsFrom(rows: (table: string) => Row[], only?: string): Standard[] {
  const standards = rows('standard').filter((r) => only === undefined || r.id === only) as unknown as StandardRow[];
  if (!standards.length) return [];
  const ids = new Set(standards.map((s) => s.id));
  const rules = (rows('standard_rule') as unknown as StandardRuleRow[]).filter((r) => ids.has(r.standard_id));
  const standardOf = new Map(rules.map((r) => [r.id, r.standard_id]));
  const rulesOf = groupBy(rules, (r) => r.standard_id);
  const testsOf = groupBy((rows('standard_rule_test') as unknown as StandardRuleTestRow[]).filter((t) => standardOf.has(t.standard_rule_id)), (t) => standardOf.get(t.standard_rule_id));
  const startsFrom = bySource(rows('starts_from'));
  return standards.map((standard) => ({
    root: standard.id,
    standard,
    rules: groupOf(rulesOf, standard.id),
    ruleTests: groupOf(testsOf, standard.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
  }));
}

/** The instance's rows, by table. */
export function standardRows(standard: Standard): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  return new Map<string, Row[]>([
    ['standard', [asRow(standard.standard)]],
    ['standard_rule', standard.rules.map(asRow)],
    ['standard_rule_test', standard.ruleTests.map((t) => asRow(t.row))],
    ['starts_from', standard.ruleTests.flatMap((t) => t.startsFrom.map((target) => ({ source_id: t.row.id, target_id: target })))],
  ]);
}

