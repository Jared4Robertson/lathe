// What the Problems and Trace reads' tests start from: two products, EX and NF, each with a domain, and records that
// sit in their product through their parents (an aggregate's invariant) or by their ID (a value object's constraint, a
// domain's specification), opened beside Lathe's own checks.
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData, type Data } from '../../helpers.ts';

/** The two products' rows. */
export const TWO_PRODUCTS: Data = {
  product: [
    { id: 'EX', title: 'Example library', description: 'A small library that lends tools to members.' },
    { id: 'NF', title: 'Notebook', description: 'Notes kept by members.' },
  ],
  domain: [
    { id: 'EX-LEND', title: 'Lending', product_id: 'EX', position: 1, subdomain_type: 'core', description: 'Lending tools to members and getting them back.' },
    { id: 'NF-NOTE', title: 'Notes', product_id: 'NF', position: 1, subdomain_type: 'core', description: 'Writing notes.' },
  ],
  aggregate: [{ id: 'EX-LEND-A1', title: 'Loan', domain_id: 'EX-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' }],
  entity: [{ id: 'EX-LEND-EN01', title: 'Loan', aggregate_id: 'EX-LEND-A1', role: 'root', description: 'The loan itself.' }],
  invariant: [{ id: 'EX-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'EX-LEND-A1', statement: 'A tool MUST NOT have two active loans.' }],
  specification: [{ id: 'EX-LEND-SP01', title: 'Tool is free', statement: 'A tool is free when no active loan names it.' }],
  value_object: [{ id: 'EX-VO01', title: 'Email address', description: 'Where a member gets mail.' }],
  value_object_field: [{ value_object_id: 'EX-VO01', position: 1, name: 'Address', meaning: 'The address as typed.', type: 'text', required: true }],
  constraint: [{ id: 'EX-VO01-C01', title: 'One at sign', value_object_id: 'EX-VO01', statement: 'An email address MUST hold exactly one @.' }],
  pattern: [{ id: 'EX-PAT-ACT', title: 'Librarian action', product_id: 'EX', description: 'An action the librarian takes at the desk.' }],
  pattern_rule: [{ id: 'EX-PAT-ACT-R01', title: 'A saved record reads the same', pattern_id: 'EX-PAT-ACT', statement: 'A saved record MUST read the same everywhere.' }],
};

const open: Store[] = [];

/** A store on the two products, beside Lathe's own checks, closed by closeTwoProducts. */
export async function twoProducts(): Promise<Store> {
  const store = await openStore(writeData(TWO_PRODUCTS));
  open.push(store);
  return store;
}

/** Closes every store twoProducts opened. */
export async function closeTwoProducts(): Promise<void> {
  for (const store of open.splice(0)) await store.close();
}
