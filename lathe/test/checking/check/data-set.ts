// LA-CHK-TD01 Two library checks: product TL beside Lathe's own checks, then two checks of its own added with the
// Check aggregate's own Add command.
import { ADD_CHECK } from '../../../src/checking/check/commands/add-check.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { productBesideLathesChecks } from '../data-set.ts';

/** A store with TL's checks tool-without-photo (a warning, run 1st) and loan-without-due-date (an error, run 2nd). */
export async function checkDataSet(): Promise<Store> {
  const store = await productBesideLathesChecks();
  await runCommand(store, ADD_CHECK, {
    name: 'tool-without-photo', product_id: 'TL', domain_id: 'LA-CHK', position: 1, severity: 'warning', summary: 'A tool with no photo.',
    explanation: 'Members pick tools by sight. Add a photo to the tool.', query: "SELECT id AS record, id || ' has no photo.' AS message FROM product WHERE false", kinds: ['product'],
  });
  await runCommand(store, ADD_CHECK, {
    name: 'loan-without-due-date', product_id: 'TL', domain_id: 'LA-CHK', position: 2, severity: 'error', summary: 'A loan with no due date.',
    explanation: 'A loan with no due date is never overdue. Give the loan its due date.', query: "SELECT id AS record, id || ' has no due date.' AS message FROM product WHERE false",
  });
  return store;
}
