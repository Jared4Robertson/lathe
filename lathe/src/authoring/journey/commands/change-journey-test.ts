import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { JourneyTestRow } from '../../../platform/data/tables.ts';
import { CHANGE_JOURNEY_TEST_IDENTITY } from './identities.generated.ts';
import { changeJourneyTest } from './handlers.generated.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeJourneyTest = Pick<JourneyTestRow, 'id'> & { title?: JourneyTestRow['title']; level?: JourneyTestRow['level']; state?: JourneyTestRow['state']; steps?: JourneyTestRow['steps']; expected_result?: JourneyTestRow['expected_result']; file?: JourneyTestRow['file'] | null; manual_reason?: JourneyTestRow['manual_reason'] | null; size?: JourneyTestRow['size'] | null; smoke?: JourneyTestRow['smoke'] | null; external?: JourneyTestRow['external'] | null; notes?: JourneyTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_JOURNEY_TEST = {
  ...CHANGE_JOURNEY_TEST_IDENTITY,
  input: {
    id: column('journey_test', 'id', 'required'),
    title: column('journey_test', 'title', 'optional'),
    level: column('journey_test', 'level', 'optional'),
    state: column('journey_test', 'state', 'optional'),
    file: column('journey_test', 'file', 'clearable'),
    manual_reason: column('journey_test', 'manual_reason', 'clearable'),
    size: column('journey_test', 'size', 'clearable'),
    smoke: column('journey_test', 'smoke', 'clearable'),
    external: column('journey_test', 'external', 'clearable'),
    steps: column('journey_test', 'steps', 'optional'),
    expected_result: column('journey_test', 'expected_result', 'optional'),
    notes: column('journey_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeJourneyTest,
} satisfies CommandDefinition<ChangeJourneyTest>;
