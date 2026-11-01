import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { DomainServiceRow } from '../../../platform/data/tables.ts';
import { ADD_DOMAIN_SERVICE_IDENTITY } from './identities.generated.ts';
import { addDomainService } from './handlers.generated.ts';

/** A new domain service. */
export type AddDomainService = Pick<DomainServiceRow, 'id' | 'title' | 'domain_id' | 'statement'>;

export const ADD_DOMAIN_SERVICE = {
  ...ADD_DOMAIN_SERVICE_IDENTITY,
  input: {
    id: column('domain_service', 'id', 'required'),
    title: column('domain_service', 'title', 'required'),
    domain_id: column('domain_service', 'domain_id', 'required'),
    statement: column('domain_service', 'statement', 'required'),
  },
  handler: addDomainService,
} satisfies CommandDefinition<AddDomainService>;
