import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EndpointTestRow } from '../../../platform/data/tables.ts';
import { CHANGE_ENDPOINT_TEST_IDENTITY } from './identities.generated.ts';
import { changeEndpointTest } from './handlers.generated.ts';

/** The endpoint test's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeEndpointTest = Pick<EndpointTestRow, 'id'> & { title?: EndpointTestRow['title']; level?: EndpointTestRow['level']; state?: EndpointTestRow['state']; when?: EndpointTestRow['when']; then?: EndpointTestRow['then']; file?: EndpointTestRow['file'] | null; manual_reason?: EndpointTestRow['manual_reason'] | null; size?: EndpointTestRow['size'] | null; smoke?: EndpointTestRow['smoke'] | null; external?: EndpointTestRow['external'] | null; notes?: EndpointTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_ENDPOINT_TEST = {
  ...CHANGE_ENDPOINT_TEST_IDENTITY,
  input: {
    id: column('endpoint_test', 'id', 'required'),
    title: column('endpoint_test', 'title', 'optional'),
    level: column('endpoint_test', 'level', 'optional'),
    state: column('endpoint_test', 'state', 'optional'),
    when: column('endpoint_test', 'when', 'optional'),
    then: column('endpoint_test', 'then', 'optional'),
    file: column('endpoint_test', 'file', 'clearable'),
    manual_reason: column('endpoint_test', 'manual_reason', 'clearable'),
    size: column('endpoint_test', 'size', 'clearable'),
    smoke: column('endpoint_test', 'smoke', 'clearable'),
    external: column('endpoint_test', 'external', 'clearable'),
    notes: column('endpoint_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeEndpointTest,
} satisfies CommandDefinition<ChangeEndpointTest>;
