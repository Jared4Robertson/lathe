import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_TABLE_IDENTITY } from './identities.generated.ts';
import { removeTable } from './handlers.generated.ts';

/** The table to remove. */
export type RemoveTable = { id: string };

export const REMOVE_TABLE = {
  ...REMOVE_TABLE_IDENTITY,
  input: {
    id: column('table', 'id', 'required'),
  },
  handler: removeTable,
} satisfies CommandDefinition<RemoveTable>;
