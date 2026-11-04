import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { IntegrationRow } from '../../../platform/data/tables.ts';
import { CHANGE_INTEGRATION_IDENTITY } from './identities.generated.ts';
import { changeIntegration } from './handlers.generated.ts';

/** The integration's changes: a column given is set, null clears an optional one; a list given replaces the use cases it performs. */
export type ChangeIntegration = Pick<IntegrationRow, 'id'> & { title?: IntegrationRow['title']; description?: IntegrationRow['description']; system?: IntegrationRow['system'] | null; performs?: string[] };

export const CHANGE_INTEGRATION = {
  ...CHANGE_INTEGRATION_IDENTITY,
  input: {
    id: column('integration', 'id', 'required'),
    title: column('integration', 'title', 'optional'),
    description: column('integration', 'description', 'optional'),
    system: column('integration', 'system', 'clearable'),
    performs: ids('The use cases of its product it performs on its own. Replaces the list.', 'optional'),
  },
  handler: changeIntegration,
} satisfies CommandDefinition<ChangeIntegration>;
