import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { JourneyRow } from '../../../platform/data/tables.ts';
import { ADD_JOURNEY_IDENTITY } from './identities.generated.ts';
import { addJourney } from './handlers.generated.ts';

export type AddJourney = Pick<JourneyRow, 'id' | 'title' | 'product_id' | 'trigger' | 'result' | 'notes'> & { serves?: string[] };

export const ADD_JOURNEY = {
  ...ADD_JOURNEY_IDENTITY,
  input: {
    id: column('journey', 'id', 'required'),
    title: column('journey', 'title', 'required'),
    product_id: column('journey', 'product_id', 'required'),
    trigger: column('journey', 'trigger', 'required'),
    result: column('journey', 'result', 'required'),
    notes: column('journey', 'notes', 'optional'),
    serves: ids('The business outcomes of its product it serves.', 'optional'),
  },
  handler: addJourney,
} satisfies CommandDefinition<AddJourney>;
