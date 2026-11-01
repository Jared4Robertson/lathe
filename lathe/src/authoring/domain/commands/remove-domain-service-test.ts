import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DomainRepository } from '../repository.ts';
import { REMOVE_DOMAIN_SERVICE_TEST_IDENTITY } from './identities.generated.ts';

/** The test to remove. */
export type RemoveDomainServiceTest = { id: string };

export const REMOVE_DOMAIN_SERVICE_TEST = {
  ...REMOVE_DOMAIN_SERVICE_TEST_IDENTITY,
  input: {
    id: column('domain_service_test', 'id', 'required'),
  },
  handler: removeDomainServiceTest,
} satisfies CommandDefinition<RemoveDomainServiceTest>;

/** Removes the test from its domain service. */
export function removeDomainServiceTest(tx: Transaction, input: RemoveDomainServiceTest): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service_test', input.id) ?? tx.refuse('missing', `there is no domain service test ${input.id}`);
  domain.domainServiceTests = domain.domainServiceTests.filter((x) => x.row.id !== input.id);
  domains.save(domain);
}
