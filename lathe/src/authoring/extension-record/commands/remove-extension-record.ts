import { id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ExtensionRecordRepository } from '../repository.ts';
import { REMOVE_EXTENSION_RECORD_IDENTITY } from './identities.generated.ts';

/** The record to remove. */
export type RemoveExtensionRecord = { id: string };

export const REMOVE_EXTENSION_RECORD = {
  ...REMOVE_EXTENSION_RECORD_IDENTITY,
  input: {
    id: id('The record.', 'required'),
  },
  handler: removeExtensionRecord,
} satisfies CommandDefinition<RemoveExtensionRecord>;

/** Removes the record whole. */
export function removeExtensionRecord(tx: Transaction, input: RemoveExtensionRecord): void {
  const records = new ExtensionRecordRepository(tx);
  const record = records.load(input.id) ?? tx.refuse('missing', `there is no extension record ${input.id}`);
  records.remove(record);
}
