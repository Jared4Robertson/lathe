import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { DomainRow } from '../../../platform/data/tables.ts';
import { CHANGE_DOMAIN_IDENTITY } from './identities.generated.ts';
import { changeDomain } from './handlers.generated.ts';

/** The domain's changes: a column given is set, null clears an optional one. */
export type ChangeDomain = Pick<DomainRow, 'id'> & { title?: DomainRow['title']; subdomain_type?: DomainRow['subdomain_type']; description?: DomainRow['description']; notes?: DomainRow['notes'] | null };

export const CHANGE_DOMAIN = {
  ...CHANGE_DOMAIN_IDENTITY,
  input: {
    id: column('domain', 'id', 'required'),
    title: column('domain', 'title', 'optional'),
    subdomain_type: column('domain', 'subdomain_type', 'optional'),
    description: column('domain', 'description', 'optional'),
    notes: column('domain', 'notes', 'clearable'),
  },
  handler: changeDomain,
} satisfies CommandDefinition<ChangeDomain>;
