import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EntryPointRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { EntryPointRepository } from '../repository.ts';
import { CHANGE_ENTRY_POINT_IDENTITY } from './identities.generated.ts';

/** The entry point's changes: a column given is set; packages and meets, when given, replace the list. */
export type ChangeEntryPoint = Pick<EntryPointRow, 'id'> & { title?: string; file?: string | null; description?: string; packages?: string[]; meets?: string[] };

export const CHANGE_ENTRY_POINT: CommandDefinition<ChangeEntryPoint> = {
  ...CHANGE_ENTRY_POINT_IDENTITY,
  input: {
    id: column('entry_point', 'id', 'required'),
    title: column('entry_point', 'title', 'optional'),
    file: column('entry_point', 'file', 'clearable'),
    description: column('entry_point', 'description', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
  },
  handler: changeEntryPoint,
};

/** Changes the entry point's own columns and lists. */
export function changeEntryPoint(tx: Transaction, input: ChangeEntryPoint): void {
  const records = new EntryPointRepository(tx);
  const record = records.load(input.id) ?? tx.refuse('missing', `there is no entry_point ${input.id}`);
  record.entryPoint = changed(record.entryPoint, input, ['title', 'file', 'description']);
  if (input.packages) record.packages = [...input.packages].sort();
  if (input.meets) record.meets = [...input.meets].sort();
  records.save(record);
}
