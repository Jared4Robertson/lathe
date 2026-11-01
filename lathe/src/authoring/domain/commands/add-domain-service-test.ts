import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DomainServiceTestRow } from '../../../platform/data/tables.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_DOMAIN_SERVICE_TEST_IDENTITY } from './identities.generated.ts';

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

export function addDomainServiceTest(tx: Transaction, input: AddDomainServiceTest): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service', input.domain_service_id) ?? tx.refuse('missing', `there is no domain service ${input.domain_service_id}`);
  const { starts_from = [], ...row } = input;
  domain.domainServiceTests.push({ row, startsFrom: starts_from });
  holdToRules(tx, domain);
  domains.save(domain);
}
