import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { JourneyTestRow } from '../../../platform/data/tables.ts';
import { ADD_JOURNEY_TEST_IDENTITY } from './identities.generated.ts';
import { addJourneyTest } from './handlers.generated.ts';

export type AddJourneyTest = Pick<JourneyTestRow, 'id' | 'title' | 'journey_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'steps' | 'expected_result' | 'notes'> & { starts_from?: string[] };

export const ADD_JOURNEY_TEST = {
  ...ADD_JOURNEY_TEST_IDENTITY,
  input: {
    id: column('journey_test', 'id', 'required'),
    title: column('journey_test', 'title', 'required'),
    journey_id: column('journey_test', 'journey_id', 'required'),
    level: column('journey_test', 'level', 'required'),
    state: column('journey_test', 'state', 'required'),
    file: column('journey_test', 'file', 'optional'),
    manual_reason: column('journey_test', 'manual_reason', 'optional'),
    size: column('journey_test', 'size', 'optional'),
    smoke: column('journey_test', 'smoke', 'optional'),
    external: column('journey_test', 'external', 'optional'),
    steps: column('journey_test', 'steps', 'required'),
    expected_result: column('journey_test', 'expected_result', 'required'),
    notes: column('journey_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addJourneyTest,
} satisfies CommandDefinition<AddJourneyTest>;
