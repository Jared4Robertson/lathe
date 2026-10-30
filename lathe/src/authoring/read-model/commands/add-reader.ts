// Add a reader (LA-AUT-CMD297): Adds a read model's reader, the one way its query handlers read its table, with the standard rules it meets and the packages it uses.
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ReaderRow } from '../../../platform/data/tables.ts';
import { READ_MODEL_SLICE } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { holdToRules, readModelOneEach } from '../rules.ts';

/** A new reader, with the standard rules it meets and the packages it uses. */
export type AddReader = Pick<ReaderRow, 'id' | 'title' | 'read_model_id' | 'file' | 'description'> & { meets?: string[]; packages?: string[] };

/** Add a reader (LA-AUT-CMD297). */
export const ADD_READER: CommandDefinition<AddReader> = {
  id: 'LA-AUT-CMD297',
  slice: READ_MODEL_SLICE,
  name: 'add-reader',
  description: "Adds a read model's reader, the one way its query handlers read its table, with the standard rules it meets and the packages it uses.",
  method: 'POST',
  route: '/api/read-model/add-reader',
  input: {
    id: column('reader', 'id', 'required'),
    title: column('reader', 'title', 'required'),
    read_model_id: column('reader', 'read_model_id', 'required'),
    file: column('reader', 'file', 'optional'),
    description: column('reader', 'description', 'required'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
  },
  handler: addReader,
};

/** Adds the reader to its read model, which has none yet (LA-AUT-INV107). */
export function addReader(tx: Transaction, input: AddReader): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.read_model_id) ?? tx.refuse('missing', `there is no read model ${input.read_model_id}`);
  const { meets = [], packages = [], ...row } = input;
  refuseBroken(readModelOneEach([], [...(readModel.reader ? [readModel.reader.row] : []), row], []));
  readModel.reader = { row, meets, packages };
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
