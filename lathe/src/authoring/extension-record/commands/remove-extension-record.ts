import { id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { EXTENSION_RECORD_SLICE } from '../model.ts';
import { ExtensionRecordRepository } from '../repository.ts';

/** The record to remove. */
export type RemoveExtensionRecord = { id: string };

export const REMOVE_EXTENSION_RECORD: CommandDefinition<RemoveExtensionRecord> = {
  id: 'LA-AUT-CMD147',
  slice: EXTENSION_RECORD_SLICE,
  name: 'remove-extension-record',
  description: "Removes a record of a product's own kind with the links it starts and the packages it uses. Refused while anything else references it.",
  method: 'POST',
  route: '/api/extension-record/remove-extension-record',
  input: {
    id: id('The record.', 'required'),
  },
  handler: removeExtensionRecord,
};

/** Removes the record whole. */
export function removeExtensionRecord(tx: Transaction, input: RemoveExtensionRecord): void {
  const records = new ExtensionRecordRepository(tx);
  const record = records.load(input.id) ?? tx.refuse('missing', `there is no extension record ${input.id}`);
  records.remove(record);
}
