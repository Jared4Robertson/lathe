// The Standard aggregate's read model (LA-TEC-RM23), shaped for its readers: the Standard page reads a standard whole
// (its rules by ID, each with the records that meet it and its tests) with the record the page is about, a product's
// list reads each standard's ID and title, and the editor's next ID reads the IDs in use. The projection
// (standardTableFrom) is the only code that reads the source rows and the only code that writes the read model's
// table; the query handlers read that table only through the reader (reader.ts). Nothing here is the aggregate's own
// instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { StandardRow, StandardRuleRow, StandardRuleTestRow } from '../../platform/data/tables.ts';
import type { StandardKind } from './model.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** A standard rule test as the page shows it: its row and the test data sets it starts from. */
export interface StandardRuleTestOnPage {
  test: StandardRuleTestRow;
  startsFrom: string[];
}

/** A standard rule as the page shows it: its row, the records that meet it, and its tests by ID. */
export interface StandardRuleOnPage {
  rule: StandardRuleRow;
  metBy: string[];
  tests: StandardRuleTestOnPage[];
}

/** A standard whole, as its page shows it: its row and its rules by ID. */
export interface StandardTree {
  standard: StandardRow;
  rules: StandardRuleOnPage[];
}

/** A standard as its page reads it, with the record of it the page is about. */
export interface StandardPage extends StandardTree {
  record: { id: string; kind: StandardKind };
}

/** A standard as a product's list reads it. */
export interface StandardSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface StandardTable {
  /** Each standard whole, by its ID. */
  standards: Map<string, StandardTree>;
  /** Each record inside a standard: the standard that holds it and its kind there. */
  holding: Map<string, { root: string; kind: StandardKind }>;
  /** Each product's standards, by ID; a product with none has an empty list. */
  products: Map<string, StandardSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's ends by one end, each list sorted. */
function linked(view: ReadView, table: string, by: 'source_id' | 'target_id'): (id: string) => string[] {
  const other = by === 'source_id' ? 'target_id' : 'source_id';
  const found = grouped<Row>(view.rows(table), by);
  return (id) => (found.get(id) ?? []).map((l) => String(l[other])).sort();
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function standardTableFrom(view: ReadView): StandardTable {
  const startsFrom = linked(view, 'starts_from', 'source_id');
  const metBy = linked(view, 'meets', 'target_id');
  const rules = grouped<StandardRuleRow>(view.rows('standard_rule'), 'standard_id');
  const tests = grouped<StandardRuleTestRow>(view.rows('standard_rule_test'), 'standard_rule_id');
  const standards = new Map<string, StandardTree>();
  const holding = new Map<string, { root: string; kind: StandardKind }>();
  const products = new Map<string, StandardSummary[]>(view.rows('product').map((p) => [String(p.id), []]));
  for (const standard of view.rows('standard') as unknown as StandardRow[]) {
    const root = standard.id;
    holding.set(root, { root, kind: 'standard' });
    const tree: StandardTree = {
      standard,
      rules: [...(rules.get(root) ?? [])].sort(byRecordId).map((rule) => ({
        rule,
        metBy: metBy(rule.id),
        tests: [...(tests.get(rule.id) ?? [])].sort(byRecordId).map((test) => ({ test, startsFrom: startsFrom(test.id) })),
      })),
    };
    for (const r of tree.rules) {
      holding.set(r.rule.id, { root, kind: 'standard_rule' });
      for (const t of r.tests) holding.set(t.test.id, { root, kind: 'standard_rule_test' });
    }
    standards.set(root, tree);
    products.get(standard.product_id)?.push({ id: standard.id, title: standard.title });
  }
  for (const list of products.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { standards, holding, products, kinds };
}
