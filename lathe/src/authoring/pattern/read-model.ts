// The Pattern aggregate's read model (LA-AUT-RM22), shaped for its readers: the Pattern page reads a pattern whole (its
// settings in order, its rules by ID, each with its tests per following domain) with the record the page is about, a
// product's list reads each pattern's ID and title, and the editor's next ID reads the IDs in use. Who follows the
// pattern, and the values they give its settings, are Pattern following's. The projection (patternTableFrom) is the
// only code that reads the source rows and the only code that writes the read model's table; the query handlers read
// that table only through the reader (reader.ts). Nothing here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { PatternRow, PatternRuleRow, PatternRuleTestRow, PatternSettingRow } from '../../platform/data/tables.ts';
import type { PatternKind } from './model.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** A setting as the page shows it: its name and what each follower decides with it, in the pattern's order. */
export interface SettingOnPage {
  name: string;
  meaning: string;
}

/** A pattern rule test as the page shows it: its row and the test data sets it starts from. */
export interface PatternRuleTestOnPage {
  test: PatternRuleTestRow;
  startsFrom: string[];
}

/** A pattern rule as the page shows it: its row and its tests by ID. */
export interface PatternRuleOnPage {
  rule: PatternRuleRow;
  tests: PatternRuleTestOnPage[];
}

/** A pattern whole, as its page shows it: its row, its settings in order and its rules by ID. */
export interface PatternTree {
  pattern: PatternRow;
  settings: SettingOnPage[];
  rules: PatternRuleOnPage[];
}

/** A pattern as its page reads it, with the record of it the page is about. */
export interface PatternPage extends PatternTree {
  record: { id: string; kind: PatternKind };
}

/** A pattern as a product's list reads it. */
export interface PatternSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface PatternTable {
  /** Each pattern whole, by its ID. */
  patterns: Map<string, PatternTree>;
  /** Each record inside a pattern: the pattern that holds it and its kind there. */
  holding: Map<string, { root: string; kind: PatternKind }>;
  /** Each product's patterns, by ID; a product with none has an empty list. */
  products: Map<string, PatternSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function patternTableFrom(view: ReadView): PatternTable {
  const startsFrom = grouped<{ target_id: string }>(view.rows('starts_from'), 'source_id');
  const settings = grouped<PatternSettingRow>(view.rows('pattern_setting'), 'pattern_id');
  const rules = grouped<PatternRuleRow>(view.rows('pattern_rule'), 'pattern_id');
  const tests = grouped<PatternRuleTestRow>(view.rows('pattern_rule_test'), 'pattern_rule_id');
  const patterns = new Map<string, PatternTree>();
  const holding = new Map<string, { root: string; kind: PatternKind }>();
  const products = new Map<string, PatternSummary[]>(view.rows('product').map((p) => [String(p.id), []]));
  for (const pattern of view.rows('pattern') as unknown as PatternRow[]) {
    const root = pattern.id;
    holding.set(root, { root, kind: 'pattern' });
    const tree: PatternTree = {
      pattern,
      settings: [...(settings.get(root) ?? [])].sort((a, b) => a.position - b.position).map((s) => ({ name: s.name, meaning: s.meaning })),
      rules: [...(rules.get(root) ?? [])].sort(byRecordId).map((rule) => ({
        rule,
        tests: [...(tests.get(rule.id) ?? [])].sort(byRecordId).map((test) => ({ test, startsFrom: (startsFrom.get(test.id) ?? []).map((l) => l.target_id).sort() })),
      })),
    };
    for (const r of tree.rules) {
      holding.set(r.rule.id, { root, kind: 'pattern_rule' });
      for (const t of r.tests) holding.set(t.test.id, { root, kind: 'pattern_rule_test' });
    }
    patterns.set(root, tree);
    products.get(pattern.product_id)?.push({ id: pattern.id, title: pattern.title });
  }
  for (const list of products.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { patterns, holding, products, kinds };
}
