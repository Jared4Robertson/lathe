// The Pattern aggregate (LA-AUT-A2): behavior several use cases share, written once: a pattern with its settings in
// order, its rules, and each rule's tests per following domain (with the test data sets they start from). One
// instance is one pattern, whole; who follows it, and the values they give its settings, are Pattern following's.
import type { Slice } from '../../platform/commands/definition.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { PatternRow, PatternRuleRow, PatternRuleTestRow, PatternSettingRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const PATTERN_AGGREGATE = 'LA-AUT-A2';

/** How the interfaces reach the aggregate's commands: `lathe pattern`, the pattern_ tools, /api/pattern/. */
export const PATTERN_SLICE: Slice = { aggregate: PATTERN_AGGREGATE, name: 'pattern' };

/**
 * The row with the changes applied: a value sets its column, null clears it, and a column left out keeps its value.
 * Only the columns named in `columns` are taken from the changes.
 */
export function changed<R extends object>(row: R, changes: object, columns: readonly string[]): R {
  const next = { ...row } as Record<string, unknown>;
  for (const [column, value] of Object.entries(changes)) {
    if (!columns.includes(column) || value === undefined) continue;
    if (value === null) delete next[column];
    else next[column] = value as Value;
  }
  return next as R;
}

/** One setting of a pattern: what each follower decides. Its position is its place in the pattern's list. */
export type PatternSetting = Pick<PatternSettingRow, 'name' | 'meaning'>;

/** A test with the test data sets it starts from. */
export interface Tested<T> {
  row: T;
  startsFrom: string[];
}

/** One pattern, whole. */
export interface Pattern {
  /** The pattern's ID: the aggregate's root. */
  readonly root: string;
  pattern: PatternRow;
  /** Its settings, in order. */
  settings: PatternSetting[];
  rules: PatternRuleRow[];
  ruleTests: Tested<PatternRuleTestRow>[];
}

/** The tables the Pattern aggregate keeps its rows in: its kinds, its part, and the relation its tests start. */
export const PATTERN_TABLES = ['pattern', 'pattern_setting', 'pattern_rule', 'pattern_rule_test', 'starts_from'] as const;

/** The kinds of the aggregate's records, each with the column that names its parent inside the aggregate. */
export const PATTERN_KINDS = {
  pattern: null,
  pattern_rule: 'pattern_id',
  pattern_rule_test: 'pattern_rule_id',
} as const;

export type PatternKind = keyof typeof PATTERN_KINDS;

/** A new pattern with its settings, and no rules yet. */
export function newPattern(pattern: PatternRow, settings: PatternSetting[]): Pattern {
  return { root: pattern.id, pattern, settings, rules: [], ruleTests: [] };
}

/** The patterns in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function patternsFrom(rows: (table: string) => Row[], only?: string): Pattern[] {
  const patterns = rows('pattern').filter((r) => only === undefined || r.id === only) as unknown as PatternRow[];
  if (!patterns.length) return [];
  const ids = new Set(patterns.map((p) => p.id));
  const rules = (rows('pattern_rule') as unknown as PatternRuleRow[]).filter((r) => ids.has(r.pattern_id));
  const patternOf = new Map(rules.map((r) => [r.id, r.pattern_id]));
  const rulesOf = groupBy(rules, (r) => r.pattern_id);
  const testsOf = groupBy((rows('pattern_rule_test') as unknown as PatternRuleTestRow[]).filter((t) => patternOf.has(t.pattern_rule_id)), (t) => patternOf.get(t.pattern_rule_id));
  const settingsOf = groupBy((rows('pattern_setting') as unknown as PatternSettingRow[]).filter((s) => ids.has(s.pattern_id)), (s) => s.pattern_id);
  const startsFrom = bySource(rows('starts_from'));
  return patterns.map((pattern) => ({
    root: pattern.id,
    pattern,
    settings: [...groupOf(settingsOf, pattern.id)]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ name: s.name, meaning: s.meaning })),
    rules: groupOf(rulesOf, pattern.id),
    ruleTests: groupOf(testsOf, pattern.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
  }));
}

/** The instance's rows, by table. */
export function patternRows(pattern: Pattern): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  return new Map<string, Row[]>([
    ['pattern', [asRow(pattern.pattern)]],
    ['pattern_setting', pattern.settings.map((s, at) => ({ pattern_id: pattern.root, position: at + 1, name: s.name, meaning: s.meaning }))],
    ['pattern_rule', pattern.rules.map(asRow)],
    ['pattern_rule_test', pattern.ruleTests.map((t) => asRow(t.row))],
    ['starts_from', pattern.ruleTests.flatMap((t) => t.startsFrom.map((target) => ({ source_id: t.row.id, target_id: target })))],
  ]);
}

/** The kind of the record with this ID inside the pattern, or undefined. */
export function kindInside(pattern: Pattern, id: string): PatternKind | undefined {
  if (pattern.root === id) return 'pattern';
  if (pattern.rules.some((r) => r.id === id)) return 'pattern_rule';
  if (pattern.ruleTests.some((t) => t.row.id === id)) return 'pattern_rule_test';
  return undefined;
}
