// Change an extension record (LA-AUT-CMD146): Changes a record of a product's own kind: its title or declared fields, the links it starts by relation, or the packages it uses. Its kind and parent never change.
import { id, links, texts, values, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { EXTENSION_RECORD_SLICE, undeclared, withLinks, withValues } from '../model.ts';
import { ExtensionRecordRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The record's changes: a value given sets its column and null clears an optional one; each links list replaces that relation's. */
export type ChangeExtensionRecord = {
  id: string;
  values?: Record<string, unknown>;
  links?: Record<string, string[]>;
  packages?: string[];
};

/** Change an extension record (LA-AUT-CMD146). */
export const CHANGE_EXTENSION_RECORD: CommandDefinition<ChangeExtensionRecord> = {
  id: 'LA-AUT-CMD146',
  slice: EXTENSION_RECORD_SLICE,
  name: 'change-extension-record',
  description: "Changes a record of a product's own kind: its title or declared fields, the links it starts by relation, or the packages it uses. Its kind and parent never change.",
  method: 'POST',
  route: '/api/extension-record/change-extension-record',
  input: {
    id: id('The record.', 'required'),
    values: values('Its title or declared fields to change, by column name; null clears an optional field.', 'optional'),
    links: links('The records it links to, by relation: each list replaces that relation\'s links, and an empty one clears them.', 'optional'),
    packages: texts('The packages it uses; the list replaces the list.', 'optional'),
  },
  handler: changeExtensionRecord,
};

/** Changes the record's columns, links and packages. */
export function changeExtensionRecord(tx: Transaction, input: ChangeExtensionRecord): void {
  const records = new ExtensionRecordRepository(tx);
  const record = records.load(input.id) ?? tx.refuse('missing', `there is no extension record ${input.id}`);
  const problem = undeclared(tx.schema, tx.schema.kinds[record.kind], input);
  if (problem) tx.refuse(problem.rule, problem.message);
  record.row = withValues(record.row, input.values);
  record.links = withLinks(record.links, input.links);
  if (input.packages) record.packages = [...new Set(input.packages)].sort();
  holdToRules(tx, record);
  records.save(record);
}
