import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProjectionRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_PROJECTION_IDENTITY } from './identities.generated.ts';

/** The projection's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeProjection = Pick<ProjectionRow, 'id'> & { title?: ProjectionRow['title']; file?: ProjectionRow['file'] | null; description?: ProjectionRow['description']; meets?: string[]; packages?: string[] };

export const CHANGE_PROJECTION: CommandDefinition<ChangeProjection> = {
  ...CHANGE_PROJECTION_IDENTITY,
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
