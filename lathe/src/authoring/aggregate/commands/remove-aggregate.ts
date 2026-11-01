import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_AGGREGATE_IDENTITY } from './identities.generated.ts';
import { removeAggregate } from './handlers.generated.ts';

/** The aggregate to remove. */
export type RemoveAggregate = { id: string };

export const REMOVE_AGGREGATE = {
  ...REMOVE_AGGREGATE_IDENTITY,
  input: {
    id: column('aggregate', 'id', 'required'),
  },
  handler: removeAggregate,
} satisfies CommandDefinition<RemoveAggregate>;
