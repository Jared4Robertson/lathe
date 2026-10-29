// LA-AUT-TD31 One lending data set, built with its own command: product TL and its domain TL-LEND, written as their
// rows, and the test data set TL-LEND-TD01 added with the Test data set aggregate's own Add command.
import { ADD_TEST_DATA_SET } from '../../../src/authoring/test-data-set/commands/add-test-data-set.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';

/** A store on a fresh folder holding one test data set of the lending domain, added with its own command. */
export async function lendingDataSet(): Promise<Store> {
  const store = await openStore(
    writeData({
      product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }],
      domain: [{ id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools to members and getting them back.' }],
    }),
    { latheDataDir: null },
  );
  await runCommand(store, ADD_TEST_DATA_SET, { id: 'TL-LEND-TD01', title: 'One tool on loan', domain_id: 'TL-LEND', environment: 'A fresh database.', records: 'One tool, on loan to one member.', prepare: 'Run the seed.', reset: 'Drop the database.', file: 'test/seed.ts', description: 'What the lending tests start from.' });
  return store;
}
