import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { JourneyRow } from '../../../platform/data/tables.ts';
import { CHANGE_JOURNEY_IDENTITY } from './identities.generated.ts';
import { changeJourney } from './handlers.generated.ts';

/** The journey's changes: a column given is set, null clears notes; serves, when given, replaces the list. */
export type ChangeJourney = Pick<JourneyRow, 'id'> & { title?: string; trigger?: string; result?: string; notes?: string | null; serves?: string[] };

export const CHANGE_JOURNEY = {
  ...CHANGE_JOURNEY_IDENTITY,
  input: {
    id: column('journey', 'id', 'required'),
    title: column('journey', 'title', 'optional'),
    trigger: column('journey', 'trigger', 'optional'),
    result: column('journey', 'result', 'optional'),
    notes: column('journey', 'notes', 'clearable'),
    serves: ids('The business outcomes of its product it serves. Replaces the list.', 'optional'),
  },
  handler: changeJourney,
} satisfies CommandDefinition<ChangeJourney>;
