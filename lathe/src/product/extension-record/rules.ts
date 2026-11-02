// The Extension record aggregate's rules: its kind's declaration. The declaration's table holds the parent column, the
// fields' types and which are required, so writing the row refuses a record that breaks them; what the table cannot
// hold is written here once: a record sits in the product that declares its kind, and a record of a kind a field
// titles is titled by it. Each command's handler runs them on the record before it saves, and every load and commit
// runs them over all data (extensionRecordRules, in AGGREGATE_RULES).
import { StoreError } from '../../platform/data/problems.ts';
import type { AggregateRules, ReadView, RuleProblem } from '../../platform/data/rules.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { placeIn, productOf, titlingField } from './declaration.ts';
import { EXTENSION_RECORD_AGGREGATE, extensionRecordsFrom, type ExtensionRecord } from './model.ts';

/**
 * Every rule the record breaks: LA-PRD-INV55 (a record of a product's own kind sits in the product that declares it)
 * and LA-PRD-INV186 (a record of a kind a field titles is titled by that field's value).
 */
export function extensionRecordProblems(record: ExtensionRecord, view: ReadView): RuleProblem[] {
  const declaredBy = view.schema.kinds[record.kind]?.productId;
  if (!declaredBy) return [];
  const problems: RuleProblem[] = [];
  const product = productOf(placeIn(view), view.rows('product').map((p) => String(p.id)), record.root);
  if (product !== declaredBy) {
    problems.push({
      rule: 'product-kind-product',
      table: record.kind,
      row: record.row,
      message: `${record.root} is a ${record.kind}, a kind of product ${declaredBy}, but it sits in product ${product ?? 'none'}`,
    });
  }
  const field = titlingField(view, record.kind);
  if (field && record.row.title !== record.row[field]) {
    problems.push({
      rule: 'title-from-field',
      table: record.kind,
      row: record.row,
      message: `${record.root} is titled "${String(record.row.title)}", but a ${record.kind} is titled by its ${field}, "${String(record.row[field])}"; leave its title out and it follows its ${field}`,
    });
  }
  return problems;
}

/** The rules over all data: every extension record. */
export const extensionRecordRules: AggregateRules = {
  aggregate: EXTENSION_RECORD_AGGREGATE,
  check: (view) => extensionRecordsFrom(view.schema, (table) => view.rows(table)).flatMap((record) => extensionRecordProblems(record, view)),
};

/** Refuses the command, with every reason, when the record as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, record: ExtensionRecord): void {
  const problems = extensionRecordProblems(record, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message })));
}
