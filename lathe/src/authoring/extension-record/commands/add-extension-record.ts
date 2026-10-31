import { id, links, texts, values, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { parentColumn, productKinds } from '../declaration.ts';
import { EXTENSION_RECORD_SLICE, undeclared, withLinks, withValues } from '../model.ts';
import { ExtensionRecordRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new record of a product kind: its kind, ID and parent, its title and fields, and what it links to and uses. */
export type AddExtensionRecord = {
  kind: string;
  id: string;
  parent_id: string;
  values: Record<string, unknown>;
  links?: Record<string, string[]>;
  packages?: string[];
};

export const ADD_EXTENSION_RECORD: CommandDefinition<AddExtensionRecord> = {
  id: 'LA-AUT-CMD145',
  slice: EXTENSION_RECORD_SLICE,
  name: 'add-extension-record',
  description: "Adds a record of a product's own kind under its parent, with its title and declared fields, the links it starts and the packages it uses.",
  method: 'POST',
  route: '/api/extension-record/add-extension-record',
  input: {
    kind: id('The product kind it is a record of, by name, such as report.', 'required'),
    id: id("The record's ID, as its kind's ID pattern says.", 'required'),
    parent_id: id("The record it sits under, of its kind's parent kind.", 'required'),
    values: values('Its title and its declared fields, by column name: title is required, and so is each required field.', 'required'),
    links: links('The records it links to, by relation: only relations its kind may start.', 'optional'),
    packages: texts('The packages it uses, as package.json lists them; only a technical record uses one.', 'optional'),
  },
  handler: addExtensionRecord,
};

/** Adds the record, whole and new, held to its kind's declaration. */
export function addExtensionRecord(tx: Transaction, input: AddExtensionRecord): void {
  const records = new ExtensionRecordRepository(tx);
  const kind =
    productKinds(tx.schema).find((k) => k.name === input.kind) ??
    tx.refuse('kind', `${input.kind} is not a product kind; the products declare ${productKinds(tx.schema).map((k) => k.name).join(', ') || 'none'}`);
  const problem = undeclared(tx.schema, kind, input);
  if (problem) tx.refuse(problem.rule, problem.message);
  const row = withValues({ id: input.id, [parentColumn(kind)]: input.parent_id }, input.values);
  const record = records.create({ root: input.id, kind: kind.name, row, links: withLinks({}, input.links), packages: [...new Set(input.packages ?? [])].sort() });
  holdToRules(tx, record);
  records.save(record);
}
