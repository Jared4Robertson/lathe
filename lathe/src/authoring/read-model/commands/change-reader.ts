import { column, id, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ReaderRow } from '../../../platform/data/tables.ts';
import { READ_MODEL_SLICE, changed } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The reader's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeReader = Pick<ReaderRow, 'id'> & { title?: ReaderRow['title']; file?: ReaderRow['file'] | null; description?: ReaderRow['description']; stored_in?: string | null; meets?: string[]; packages?: string[] };

export const CHANGE_READER: CommandDefinition<ChangeReader> = {
  id: 'LA-AUT-CMD298',
  slice: READ_MODEL_SLICE,
  name: 'change-reader',
  description: "Changes a reader's title, file or description, the data store it reads in (null clears it), or the standard rules it meets or packages it uses (each the whole list).",
  method: 'POST',
  route: '/api/read-model/change-reader',
  input: {
    id: column('reader', 'id', 'required'),
    title: column('reader', 'title', 'optional'),
    file: column('reader', 'file', 'clearable'),
    description: column('reader', 'description', 'optional'),
    stored_in: id("The data store it reads its read model's table in.", 'clearable'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
  },
  handler: changeReader,
};

/** Changes the reader's columns, links and packages. */
export function changeReader(tx: Transaction, input: ChangeReader): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('reader', input.id) ?? tx.refuse('missing', `there is no reader ${input.id}`);
  const reader = readModel.reader!;
  readModel.reader = {
    row: changed(reader.row, input, ['title', 'file', 'description']),
    storedIn: input.stored_in === undefined ? reader.storedIn : input.stored_in,
    meets: input.meets ?? reader.meets,
    packages: input.packages ?? reader.packages,
  };
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
