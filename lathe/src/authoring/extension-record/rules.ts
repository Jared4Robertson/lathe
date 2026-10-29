// The Extension record aggregate's rules: its kind's declaration. The declaration's table holds the parent column, the
// fields' types and which are required, so writing the row refuses a record that breaks them; what the table cannot
// hold is written here once: a record sits in the product that declares its kind. Each command's handler runs it on
// the record before it saves, and every load and commit runs it over all data (extensionRecordRules, in AGGREGATE_RULES).
import { StoreError } from '../../platform/data/problems.ts';
import type { AggregateRules, ReadView, RuleProblem } from '../../platform/data/rules.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { EXTENSION_RECORD_AGGREGATE, extensionRecordsFrom, productOf, type ExtensionRecord } from './model.ts';

/** Every rule the record breaks (LA-AUT-INV55 a record of a product's own kind sits in the product that declares it). */
export function extensionRecordProblems(record: ExtensionRecord, view: ReadView): RuleProblem[] {
  const declaredBy = view.schema.kinds[record.kind]?.productId;
  if (!declaredBy) return [];
  const product = productOf(view, record.root);
  if (product === declaredBy) return [];
  return [
    {
      rule: 'product-kind-product',
      table: record.kind,
      row: record.row,
      message: `${record.root} is a ${record.kind}, a kind of product ${declaredBy}, but it sits in product ${product ?? 'none'}`,
    },
  ];
}

/** The rules over all data: every extension record. */
export const extensionRecordRules: AggregateRules = {
  aggregate: EXTENSION_RECORD_AGGREGATE,
  check: (view) => extensionRecordsFrom(view.schema, (table) => view.rows(table)).flatMap((record) => extensionRecordProblems(record, view)),
};

/** Refuses the command, with every reason, when the record as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, record: ExtensionRecord): void {
  const problems = extensionRecordProblems(record, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
