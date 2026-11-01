import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ToolingRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { ToolingRepository } from '../repository.ts';
import { CHANGE_TOOLING_IDENTITY } from './identities.generated.ts';

/** The tooling record's changes: a column given is set; packages, meets and generates, when given, replace the list. */
export type ChangeTooling = Pick<ToolingRow, 'id'> & { title?: string; file?: string | null; packages?: string[]; meets?: string[]; generates?: string[] };

export const CHANGE_TOOLING = {
  ...CHANGE_TOOLING_IDENTITY,
  input: {
    id: column('tooling', 'id', 'required'),
    title: column('tooling', 'title', 'optional'),
    file: column('tooling', 'file', 'clearable'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    generates: ids('The technical records it generates. Replaces the list.', 'optional'),
  },
  handler: changeTooling,
} satisfies CommandDefinition<ChangeTooling>;

/** Changes the tooling record's own columns and lists. */
export function changeTooling(tx: Transaction, input: ChangeTooling): void {
  const records = new ToolingRepository(tx);
  const record = records.load(input.id) ?? tx.refuse('missing', `there is no tooling ${input.id}`);
  record.tooling = changed(record.tooling, input, ['title', 'file']);
  if (input.packages) record.packages = [...input.packages].sort();
  if (input.meets) record.meets = [...input.meets].sort();
  if (input.generates) record.generates = [...input.generates].sort();
  records.save(record);
}
