// The Pattern aggregate (LA-AUT-A2): behavior several use cases share, written once: a pattern with its settings in
// order, its rules, each rule's tests per following domain (with the test data sets they start from) and its slots.
// One instance is one pattern, whole; who follows it, and the values they give its settings, are Pattern following's.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { PatternRow, PatternRuleRow, PatternRuleTestRow, PatternSettingRow, SlotRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const PATTERN_AGGREGATE = 'LA-AUT-A2';

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
  /** Its slots: the open-ended parts code fills against their contracts. */
  slots: SlotRow[];
}

/** The tables the Pattern aggregate keeps its rows in: its kinds, its part, and the relation its tests start. */
export const PATTERN_TABLES = ['pattern', 'pattern_setting', 'pattern_rule', 'pattern_rule_test', 'slot', 'starts_from'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const PATTERN_SHAPE = {
  pattern: { at: 'pattern', given: { settings: 'settings' } },
  pattern_rule: { at: 'rules' },
  pattern_rule_test: { at: 'ruleTests', lists: { starts_from: 'startsFrom' } },
  slot: { at: 'slots' },
} as const satisfies AggregateShape;

export type PatternKind = keyof typeof PATTERN_SHAPE;

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
  const slotsOf = groupBy((rows('slot') as unknown as SlotRow[]).filter((s) => ids.has(s.pattern_id)), (s) => s.pattern_id);
  const startsFrom = bySource(rows('starts_from'));
  return patterns.map((pattern) => ({
    root: pattern.id,
    pattern,
    settings: [...groupOf(settingsOf, pattern.id)]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ name: s.name, meaning: s.meaning })),
    rules: groupOf(rulesOf, pattern.id),
    ruleTests: groupOf(testsOf, pattern.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
    slots: groupOf(slotsOf, pattern.id),
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
    ['slot', pattern.slots.map(asRow)],
    ['starts_from', pattern.ruleTests.flatMap((t) => t.startsFrom.map((target) => ({ source_id: t.row.id, target_id: target })))],
  ]);
}

