import { id, links, texts, values, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { undeclared, withLinks, withValues } from '../model.ts';
import { ExtensionRecordRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_EXTENSION_RECORD_IDENTITY } from './identities.generated.ts';

/** The record's changes: a value given sets its column and null clears an optional one; each links list replaces that relation's. */
export type ChangeExtensionRecord = {
  id: string;
  values?: Record<string, unknown>;
  links?: Record<string, string[]>;
  packages?: string[];
  helpers?: string[];
};

export const CHANGE_EXTENSION_RECORD = {
  ...CHANGE_EXTENSION_RECORD_IDENTITY,
  input: {
    id: id('The record.', 'required'),
    values: values('Its title or declared fields to change, by column name; null clears an optional field. A title a field of its kind gives follows that field.', 'optional'),
    links: links('The records it links to, by relation: each list replaces that relation\'s links, and an empty one clears them.', 'optional'),
    packages: texts('The packages it uses; the list replaces the list.', 'optional'),
    helpers: texts('The helper files its code is split across beside its file, each from the product root. Replaces the list.', 'optional'),
  },
  handler: changeExtensionRecord,
} satisfies CommandDefinition<ChangeExtensionRecord>;

/** Changes the record's columns, links, packages and helper files. */
export function changeExtensionRecord(tx: Transaction, input: ChangeExtensionRecord): void {
  const records = new ExtensionRecordRepository(tx);
  const record = records.load(input.id) ?? tx.refuse('missing', `there is no extension record ${input.id}`);
  const problem = undeclared(tx.schema, tx.schema.kinds[record.kind], input);
  if (problem) tx.refuse(problem.rule, problem.message);
  record.row = withValues(tx, record.kind, record.row, input.values);
  record.links = withLinks(record.links, input.links);
  if (input.packages) record.packages = [...new Set(input.packages)].sort();
  if (input.helpers) record.helpers = [...new Set(input.helpers)].sort();
  holdToRules(tx, record);
  records.save(record);
}
