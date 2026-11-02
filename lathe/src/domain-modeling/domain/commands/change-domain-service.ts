import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { DomainServiceRow } from '../../../platform/data/tables.ts';
import { CHANGE_DOMAIN_SERVICE_IDENTITY } from './identities.generated.ts';
import { changeDomainService } from './handlers.generated.ts';

/** The domain service's changes: a column given is set. */
export type ChangeDomainService = Pick<DomainServiceRow, 'id'> & { title?: DomainServiceRow['title']; statement?: DomainServiceRow['statement'] };

export const CHANGE_DOMAIN_SERVICE = {
  ...CHANGE_DOMAIN_SERVICE_IDENTITY,
  input: {
    id: column('domain_service', 'id', 'required'),
    title: column('domain_service', 'title', 'optional'),
    statement: column('domain_service', 'statement', 'optional'),
  },
  handler: changeDomainService,
} satisfies CommandDefinition<ChangeDomainService>;
