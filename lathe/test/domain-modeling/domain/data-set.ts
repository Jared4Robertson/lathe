// LA-MOD-TD30 One lending domain, built with its own commands: product TL, written as its one row, and the domain
// TL-LEND with a term, a domain service with its service and test, and a repository, each added with the
// Domain aggregate's own Add commands.
import { ADD_DOMAIN } from '../../../src/domain-modeling/domain/commands/add-domain.ts';
import { ADD_DOMAIN_SERVICE } from '../../../src/domain-modeling/domain/commands/add-domain-service.ts';
import { ADD_DOMAIN_SERVICE_TEST } from '../../../src/domain-modeling/domain/commands/add-domain-service-test.ts';
import { ADD_REPOSITORY } from '../../../src/domain-modeling/domain/commands/add-repository.ts';
import { ADD_SERVICE } from '../../../src/domain-modeling/domain/commands/add-service.ts';
import { ADD_TERM } from '../../../src/domain-modeling/domain/commands/add-term.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';

/** A store on a fresh folder holding the lending domain, built with the Domain aggregate's own commands. */
export async function lendingDomain(): Promise<Store> {
  const store = await openStore(writeData({ product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }] }), { latheDataDir: null });
  await runCommand(store, ADD_DOMAIN, { id: 'TL-LEND', title: 'Lending', product_id: 'TL', position: 1, subdomain_type: 'core', description: 'Lending tools to members and getting them back.' });
  await runCommand(store, ADD_TERM, { id: 'TL-LEND-TM01', title: 'Loan', domain_id: 'TL-LEND', meaning: 'One tool lent to one member until it is returned.' });
  await runCommand(store, ADD_DOMAIN_SERVICE, { id: 'TL-LEND-DS01', title: 'Late fee', domain_id: 'TL-LEND', statement: 'The fee MUST be a day rate times the days late.' });
  await runCommand(store, ADD_SERVICE, { id: 'TL-LEND-DS01-SV', title: 'lateFee', domain_service_id: 'TL-LEND-DS01', file: 'src/fees.ts' });
  await runCommand(store, ADD_DOMAIN_SERVICE_TEST, { id: 'TL-LEND-DS01-T01', title: 'Three days late', domain_service_id: 'TL-LEND-DS01', level: 'unit', state: 'automated', file: 'test/fees.test.ts', when: 'Works out the fee for three days late.', then: 'Expects three day rates.' });
  await runCommand(store, ADD_REPOSITORY, { id: 'TL-LEND-REPO01', title: 'LoanRepository', domain_id: 'TL-LEND', file: 'src/lending/loans.ts', description: 'Keeps loans in the loans table.' });
  return store;
}
