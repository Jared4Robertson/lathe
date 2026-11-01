import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { DomainServiceTestRow } from '../../../platform/data/tables.ts';
import { ADD_DOMAIN_SERVICE_TEST_IDENTITY } from './identities.generated.ts';
import { addDomainServiceTest } from './handlers.generated.ts';

export type AddDomainServiceTest = Pick<DomainServiceTestRow, 'id' | 'title' | 'domain_service_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'when' | 'then' | 'notes'> & { starts_from?: string[] };

export const ADD_DOMAIN_SERVICE_TEST = {
  ...ADD_DOMAIN_SERVICE_TEST_IDENTITY,
  input: {
    id: column('domain_service_test', 'id', 'required'),
    title: column('domain_service_test', 'title', 'required'),
    domain_service_id: column('domain_service_test', 'domain_service_id', 'required'),
    level: column('domain_service_test', 'level', 'required'),
    state: column('domain_service_test', 'state', 'required'),
    file: column('domain_service_test', 'file', 'optional'),
    manual_reason: column('domain_service_test', 'manual_reason', 'optional'),
    size: column('domain_service_test', 'size', 'optional'),
    smoke: column('domain_service_test', 'smoke', 'optional'),
    external: column('domain_service_test', 'external', 'optional'),
    when: column('domain_service_test', 'when', 'required'),
    then: column('domain_service_test', 'then', 'required'),
    notes: column('domain_service_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addDomainServiceTest,
} satisfies CommandDefinition<AddDomainServiceTest>;
