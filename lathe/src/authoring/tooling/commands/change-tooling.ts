// Change a tooling record (LA-AUT-CMD156): Changes a tooling record's title, file, packages or standard rules met. Its domain stays.
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ToolingRow } from '../../../platform/data/tables.ts';
import { changed, TOOLING_SLICE } from '../model.ts';
import { ToolingRepository } from '../repository.ts';

/** The tooling record's changes: a column given is set; packages and meets, when given, replace the list. */
export type ChangeTooling = Pick<ToolingRow, 'id'> & { title?: string; file?: string | null; packages?: string[]; meets?: string[] };

/** Change a tooling record (LA-AUT-CMD156). */
export const CHANGE_TOOLING: CommandDefinition<ChangeTooling> = {
  id: 'LA-AUT-CMD156',
  slice: TOOLING_SLICE,
  name: 'change-tooling',
  description: "Changes a tooling record's title, file, packages or standard rules met. Its domain stays.",
  method: 'POST',
  route: '/api/tooling/change-tooling',
  input: {
    id: column('tooling', 'id', 'required'),
    title: column('tooling', 'title', 'optional'),
    file: column('tooling', 'file', 'clearable'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
  },
  handler: changeTooling,
};

/** Changes the tooling record's own columns and lists. */
export function changeTooling(tx: Transaction, input: ChangeTooling): void {
  const records = new ToolingRepository(tx);
  const record = records.load(input.id) ?? tx.refuse('missing', `there is no tooling ${input.id}`);
  record.tooling = changed(record.tooling, input, ['title', 'file']);
  if (input.packages) record.packages = [...input.packages].sort();
  if (input.meets) record.meets = [...input.meets].sort();
  records.save(record);
}
