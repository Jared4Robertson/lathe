import { column, ids, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ReadModelRow } from '../../../platform/data/tables.ts';
import { FIELD_COLUMNS, type ReadModelField } from '../model.ts';
import { CHANGE_READ_MODEL_IDENTITY } from './identities.generated.ts';
import { changeReadModel } from './handlers.generated.ts';

/** The read model's changes: a column given is set; a list given replaces the list. */
export type ChangeReadModel = Pick<ReadModelRow, 'id'> & { title?: ReadModelRow['title']; description?: ReadModelRow['description']; fields?: ReadModelField[]; reads?: string[]; calls?: string[]; fed_by?: string[] };

export const CHANGE_READ_MODEL = {
  ...CHANGE_READ_MODEL_IDENTITY,
  input: {
    id: column('read_model', 'id', 'required'),
    title: column('read_model', 'title', 'optional'),
    description: column('read_model', 'description', 'optional'),
    fields: parts('read_model_field', FIELD_COLUMNS, "Its fields in order, each a name, what it means, exactly one type (a basic type, a value object or an aggregate), whether it is required, and its column's name and an example when they help. Replaces the list.", 'optional'),
    reads: ids('The aggregates it reads, of its own domain. Replaces the list.', 'optional'),
    calls: ids('The domain services its projection calls, of its own domain. Replaces the list.', 'optional'),
    fed_by: ids("The events that keep it current: its own domain's, or another domain's published ones. Replaces the list.", 'optional'),
  },
  handler: changeReadModel,
} satisfies CommandDefinition<ChangeReadModel>;
