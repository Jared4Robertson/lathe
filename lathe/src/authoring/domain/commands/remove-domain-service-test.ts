import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DOMAIN_SLICE } from '../model.ts';
import { DomainRepository } from '../repository.ts';

/** The test to remove. */
export type RemoveDomainServiceTest = { id: string };

export const REMOVE_DOMAIN_SERVICE_TEST: CommandDefinition<RemoveDomainServiceTest> = {
  id: 'LA-AUT-CMD180',
  slice: DOMAIN_SLICE,
  name: 'remove-domain-service-test',
  description: 'Removes a domain service test and the links it starts. Refused while anything references it.',
  method: 'POST',
  route: '/api/domain/remove-domain-service-test',
  input: {
    id: column('domain_service_test', 'id', 'required'),
  },
  handler: removeDomainServiceTest,
};

/** Removes the test from its domain service. */
export function removeDomainServiceTest(tx: Transaction, input: RemoveDomainServiceTest): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service_test', input.id) ?? tx.refuse('missing', `there is no domain service test ${input.id}`);
  domain.domainServiceTests = domain.domainServiceTests.filter((x) => x.row.id !== input.id);
  domains.save(domain);
}
