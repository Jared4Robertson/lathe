import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { GeneratedComponentRow } from '../../../platform/data/tables.ts';
import { CHANGE_GENERATED_COMPONENT_IDENTITY } from './identities.generated.ts';
import { changeGeneratedComponent } from './handlers.generated.ts';

/** The generated component's changes: a column given is set; serves, when given, replaces the list. */
export type ChangeGeneratedComponent = Pick<GeneratedComponentRow, 'id'> & { title?: string; description?: string; serves?: string[] };

export const CHANGE_GENERATED_COMPONENT = {
  ...CHANGE_GENERATED_COMPONENT_IDENTITY,
  input: {
    id: column('generated_component', 'id', 'required'),
    title: column('generated_component', 'title', 'optional'),
    description: column('generated_component', 'description', 'optional'),
    serves: ids('The business outcomes of its product it serves. Replaces the list.', 'optional'),
  },
  handler: changeGeneratedComponent,
} satisfies CommandDefinition<ChangeGeneratedComponent>;
