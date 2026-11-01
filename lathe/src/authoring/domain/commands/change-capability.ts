import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { CapabilityRow } from '../../../platform/data/tables.ts';
import { CHANGE_CAPABILITY_IDENTITY } from './identities.generated.ts';
import { changeCapability } from './handlers.generated.ts';

/** The capability's changes: a column given is set; serves, when given, replaces the list. */
export type ChangeCapability = Pick<CapabilityRow, 'id'> & { title?: CapabilityRow['title']; position?: CapabilityRow['position']; description?: CapabilityRow['description']; serves?: string[] };

export const CHANGE_CAPABILITY = {
  ...CHANGE_CAPABILITY_IDENTITY,
  input: {
    id: column('capability', 'id', 'required'),
    title: column('capability', 'title', 'optional'),
    position: column('capability', 'position', 'optional'),
    description: column('capability', 'description', 'optional'),
    serves: ids('The business outcomes it serves. Replaces the list.', 'optional'),
  },
  handler: changeCapability,
} satisfies CommandDefinition<ChangeCapability>;
