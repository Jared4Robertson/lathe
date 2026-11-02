import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ToolingRow } from '../../../platform/data/tables.ts';
import { ToolingRepository } from '../repository.ts';
import { ADD_TOOLING_IDENTITY } from './identities.generated.ts';

export type AddTooling = Pick<ToolingRow, 'id' | 'title' | 'domain_id' | 'file'> & { packages?: string[]; meets?: string[]; generates?: string[] };

export const ADD_TOOLING = {
  ...ADD_TOOLING_IDENTITY,
  input: {
    id: column('tooling', 'id', 'required'),
    title: column('tooling', 'title', 'required'),
    domain_id: column('tooling', 'domain_id', 'required'),
    file: column('tooling', 'file', 'optional'),
    packages: texts('The packages it uses, as the product\'s package.json files list them.', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    generates: ids('The technical records it generates: derived, never written by hand.', 'optional'),
  },
  handler: addTooling,
} satisfies CommandDefinition<AddTooling>;

/** Adds the tooling record, whole and new. */
export function addTooling(tx: Transaction, input: AddTooling): void {
  const records = new ToolingRepository(tx);
  if (tx.record(input.id)) tx.refuse('primary-key', `tooling ${input.id} already exists`);
  if (tx.record(input.domain_id)?.kind !== 'domain') tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { packages = [], meets = [], generates = [], ...row } = input;
  const record = records.create({ root: row.id, tooling: row, packages: [...packages].sort(), meets: [...meets].sort(), generates: [...generates].sort() });
  records.save(record);
}
