import { id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ExtensionRecordRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_EXTENSION_RECORD_IDENTITY } from './identities.generated.ts';

/** The record of a product's own kind and the domain it moves to. */
export interface MoveExtensionRecord {
  id: string;
  domain_id: string;
}

export const MOVE_EXTENSION_RECORD = {
  ...MOVE_EXTENSION_RECORD_IDENTITY,
  input: {
    id: id('The record of a product\'s own kind, under a domain, to move.', 'required'),
    domain_id: id('The domain of its product it moves to.', 'required'),
  },
  handler: moveExtensionRecord,
} satisfies CommandDefinition<MoveExtensionRecord>;

export function moveExtensionRecord(tx: Transaction, input: MoveExtensionRecord): void {
  const records = new ExtensionRecordRepository(tx);
  const record = records.load(input.id) ?? tx.refuse('missing', `there is no record of a product's own kind ${input.id}`);
  const kind = tx.schema.kinds[record.kind];
  const parent = kind.parents.find((p) => p.kind === 'domain');
  if (!parent) tx.refuse('parent', `${kind.label} ${input.id} sits under a ${kind.parents.map((p) => p.kind).join(' or ')}, not a domain: it moves with its parent`);
  const renames = toDomain(tx, { id: input.id, label: kind.label, domainId: String(record.row[parent.column]) }, input.domain_id);
  record.row = { ...record.row, [parent.column]: input.domain_id };
  holdToRules(tx, record);
  records.save(record);
  records.carryRenames(renames);
}
