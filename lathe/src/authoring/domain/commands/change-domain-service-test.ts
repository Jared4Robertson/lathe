import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DomainServiceTestRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_DOMAIN_SERVICE_TEST_IDENTITY } from './identities.generated.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeDomainServiceTest = Pick<DomainServiceTestRow, 'id'> & { title?: DomainServiceTestRow['title']; level?: DomainServiceTestRow['level']; state?: DomainServiceTestRow['state']; file?: DomainServiceTestRow['file'] | null; manual_reason?: DomainServiceTestRow['manual_reason'] | null; size?: DomainServiceTestRow['size'] | null; smoke?: DomainServiceTestRow['smoke'] | null; external?: DomainServiceTestRow['external'] | null; when?: DomainServiceTestRow['when']; then?: DomainServiceTestRow['then']; notes?: DomainServiceTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_DOMAIN_SERVICE_TEST = {
  ...CHANGE_DOMAIN_SERVICE_TEST_IDENTITY,
  input: {
    id: column('domain_service_test', 'id', 'required'),
    title: column('domain_service_test', 'title', 'optional'),
    level: column('domain_service_test', 'level', 'optional'),
    state: column('domain_service_test', 'state', 'optional'),
    file: column('domain_service_test', 'file', 'clearable'),
    manual_reason: column('domain_service_test', 'manual_reason', 'clearable'),
    size: column('domain_service_test', 'size', 'clearable'),
    smoke: column('domain_service_test', 'smoke', 'clearable'),
    external: column('domain_service_test', 'external', 'clearable'),
    when: column('domain_service_test', 'when', 'optional'),
    then: column('domain_service_test', 'then', 'optional'),
    notes: column('domain_service_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeDomainServiceTest,
} satisfies CommandDefinition<ChangeDomainServiceTest>;

/** Changes the test's columns and the data sets it starts from. */
export function changeDomainServiceTest(tx: Transaction, input: ChangeDomainServiceTest): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service_test', input.id) ?? tx.refuse('missing', `there is no domain service test ${input.id}`);
  domain.domainServiceTests = domain.domainServiceTests.map((t) => (t.row.id === input.id ? { row: changed(t.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? t.startsFrom } : t));
  holdToRules(tx, domain);
  domains.save(domain);
}
