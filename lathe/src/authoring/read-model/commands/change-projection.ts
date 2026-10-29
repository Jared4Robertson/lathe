// Change a projection (LA-AUT-CMD292): Changes a projection's title, file or description, or the standard rules it meets or packages it uses (each the whole list).
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProjectionRow } from '../../../platform/data/tables.ts';
import { READ_MODEL_SLICE, changed } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The projection's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeProjection = Pick<ProjectionRow, 'id'> & { title?: ProjectionRow['title']; file?: ProjectionRow['file'] | null; description?: ProjectionRow['description']; meets?: string[]; packages?: string[] };

/** Change a projection (LA-AUT-CMD292). */
export const CHANGE_PROJECTION: CommandDefinition<ChangeProjection> = {
  id: 'LA-AUT-CMD292',
  slice: READ_MODEL_SLICE,
  name: 'change-projection',
  description: "Changes a projection's title, file or description, or the standard rules it meets or packages it uses (each the whole list).",
  method: 'POST',
  route: '/api/read-model/change-projection',
  input: {
    id: column('projection', 'id', 'required'),
    title: column('projection', 'title', 'optional'),
    file: column('projection', 'file', 'clearable'),
    description: column('projection', 'description', 'optional'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
  },
  handler: changeProjection,
};

/** Changes the projection's columns, links and packages. */
export function changeProjection(tx: Transaction, input: ChangeProjection): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('projection', input.id) ?? tx.refuse('missing', `there is no projection ${input.id}`);
  const projection = readModel.projection!;
  readModel.projection = { row: changed(projection.row, input, ['title', 'file', 'description']), meets: input.meets ?? projection.meets, packages: input.packages ?? projection.packages };
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
