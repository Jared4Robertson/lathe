// What the domain model's data sets start from, written as data files: a product with two domains, a standard rule, a
// specification, a domain service and a test data set, the records outside the Aggregate, Domain event and Command
// aggregates that their records name. Each aggregate's own records are then added with its own commands.
import { openStore, type Store } from '../../src/platform/data/store.ts';
import { writeData, type Data } from '../helpers.ts';

/** The records outside the aggregates, by table, with any extra rows given. */
export function domainModelBase(extra: Data = {}): Data {
  const base: Data = {
    product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }],
    domain: [
      { id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools to members and getting them back.' },
      { id: 'TL-CAT', title: 'Catalog', product_id: 'TL', subdomain_type: 'supporting', description: 'The tools the library holds.' },
    ],
    standard: [{ id: 'TL-STD-CODE', title: 'Code', product_id: 'TL', description: 'How the code is written.' }],
    standard_rule: [{ id: 'TL-STD-CODE-R01', title: 'Node prefix', standard_id: 'TL-STD-CODE', statement: 'Code MUST import node: modules.' }],
    specification: [{ id: 'TL-LEND-SP01', title: 'Tool is free', statement: 'A tool is free when no active loan names it.' }],
    domain_service: [{ id: 'TL-LEND-DS01', title: 'Late fee', domain_id: 'TL-LEND', statement: 'The fee MUST be a day rate times the days late.' }],
    test_data_set: [
      { id: 'TL-LEND-TD01', title: 'One tool on loan', domain_id: 'TL-LEND', environment: 'A fresh database.', records: 'One tool, on loan to a member.', prepare: 'Run the seed.', reset: 'Drop the database.', description: 'What the lending tests start from.' },
    ],
  };
  for (const [table, rows] of Object.entries(extra)) base[table] = [...(base[table] ?? []), ...rows];
  return base;
}

const open: Store[] = [];

/** A store on the data, closed by closeStores. */
export async function storeOn(data: Data): Promise<Store> {
  const store = await openStore(writeData(data), { latheDataDir: null });
  open.push(store);
  return store;
}

/** Closes every store storeOn opened. */
export async function closeOpenStores(): Promise<void> {
  for (const store of open.splice(0)) await store.close();
}
