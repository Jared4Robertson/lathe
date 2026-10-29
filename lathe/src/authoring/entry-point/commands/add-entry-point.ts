// Add an entry point (LA-AUT-CMD150): Adds an entry point under its domain, with the packages it uses and the standard rules it meets.
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EntryPointRow } from '../../../platform/data/tables.ts';
import { ENTRY_POINT_SLICE } from '../model.ts';
import { EntryPointRepository } from '../repository.ts';

/** A new entry point, with the packages it uses and the standard rules it meets. */
export type AddEntryPoint = Pick<EntryPointRow, 'id' | 'title' | 'domain_id' | 'file' | 'description'> & { packages?: string[]; meets?: string[] };

/** Add an entry point (LA-AUT-CMD150). */
export const ADD_ENTRY_POINT: CommandDefinition<AddEntryPoint> = {
  id: 'LA-AUT-CMD150',
  slice: ENTRY_POINT_SLICE,
  name: 'add-entry-point',
  description: 'Adds an entry point under its domain, with the packages it uses and the standard rules it meets.',
  method: 'POST',
  route: '/api/entry-point/add-entry-point',
  input: {
    id: column('entry_point', 'id', 'required'),
    title: column('entry_point', 'title', 'required'),
    domain_id: column('entry_point', 'domain_id', 'required'),
    file: column('entry_point', 'file', 'required'),
    description: column('entry_point', 'description', 'required'),
    packages: texts('The packages it uses, as the product\'s package.json files list them.', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
  },
  handler: addEntryPoint,
};

/** Adds the entry point, whole and new. */
export function addEntryPoint(tx: Transaction, input: AddEntryPoint): void {
  const records = new EntryPointRepository(tx);
  if (tx.record(input.id)) tx.refuse('primary-key', `entry_point ${input.id} already exists`);
  if (tx.record(input.domain_id)?.kind !== 'domain') tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { packages = [], meets = [], ...row } = input;
  const record = records.create({ root: row.id, entryPoint: row, packages: [...packages].sort(), meets: [...meets].sort() });
  records.save(record);
}
