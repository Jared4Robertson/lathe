// Add a reader (LA-AUT-CMD297): Adds a read model's reader, the one way its query handlers read its table, with the data store it reads the table in, the standard rules it meets and the packages it uses.
import { column, id, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ReaderRow } from '../../../platform/data/tables.ts';
import { READ_MODEL_SLICE } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new reader, with the data store it reads in, the standard rules it meets and the packages it uses. */
export type AddReader = Pick<ReaderRow, 'id' | 'title' | 'read_model_id' | 'file' | 'description'> & { stored_in?: string; meets?: string[]; packages?: string[] };

/** Add a reader (LA-AUT-CMD297). */
export const ADD_READER: CommandDefinition<AddReader> = {
  id: 'LA-AUT-CMD297',
  slice: READ_MODEL_SLICE,
  name: 'add-reader',
  description: "Adds a read model's reader, the one way its query handlers read its table, with the data store it reads the table in, the standard rules it meets and the packages it uses.",
  method: 'POST',
  route: '/api/read-model/add-reader',
  input: {
    id: column('reader', 'id', 'required'),
    title: column('reader', 'title', 'required'),
    read_model_id: column('reader', 'read_model_id', 'required'),
    file: column('reader', 'file', 'optional'),
    description: column('reader', 'description', 'required'),
    stored_in: id("The data store it reads its read model's table in.", 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
  },
  handler: addReader,
};

/** Adds the reader to its read model, which has none yet. */
export function addReader(tx: Transaction, input: AddReader): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.read_model_id) ?? tx.refuse('missing', `there is no read model ${input.read_model_id}`);
  if (readModel.reader) tx.refuse('exists', `${readModel.root} already has its reader, ${readModel.reader.row.id}`);
  const { stored_in, meets = [], packages = [], ...row } = input;
  readModel.reader = { row, storedIn: stored_in ?? null, meets, packages };
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
