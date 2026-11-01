import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { CapabilityRow } from '../../../platform/data/tables.ts';
import { ADD_CAPABILITY_IDENTITY } from './identities.generated.ts';
import { addCapability } from './handlers.generated.ts';

export type AddCapability = Pick<CapabilityRow, 'id' | 'title' | 'domain_id' | 'position' | 'description'> & { serves?: string[] };

export const ADD_CAPABILITY = {
  ...ADD_CAPABILITY_IDENTITY,
  input: {
    id: column('capability', 'id', 'required'),
    title: column('capability', 'title', 'required'),
    domain_id: column('capability', 'domain_id', 'required'),
    position: column('capability', 'position', 'required'),
    description: column('capability', 'description', 'required'),
    serves: ids('The business outcomes it serves.', 'optional'),
  },
  handler: addCapability,
} satisfies CommandDefinition<AddCapability>;
