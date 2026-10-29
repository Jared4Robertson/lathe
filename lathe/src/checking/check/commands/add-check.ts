// Add a check (LA-CHK-CMD01): Adds a check row: its name, the product it belongs to (none for Lathe's own), its place in the run order, its severity, summary, explanation and one SELECT, and the kinds it concerns. A name one of Lathe's checks has is refused.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { CheckRow } from '../../../platform/data/tables.ts';
import { CHECK_SLICE } from '../model.ts';
import { CheckRepository } from '../repository.ts';

/** A new check row. */
export type AddCheck = Pick<CheckRow, 'name' | 'product_id' | 'position' | 'severity' | 'summary' | 'explanation' | 'query' | 'kinds'>;

/** Add a check (LA-CHK-CMD01). */
export const ADD_CHECK: CommandDefinition<AddCheck> = {
  id: 'LA-CHK-CMD01',
  slice: CHECK_SLICE,
  name: 'add-check',
  description: "Adds a check row: its name, the product it belongs to (none for Lathe's own), its place in the run order, its severity, summary, explanation and one SELECT, and the kinds it concerns. A name one of Lathe's checks has is refused.",
  method: 'POST',
  route: '/api/check/add-check',
  input: {
    name: column('check', 'name', 'required'),
    product_id: column('check', 'product_id', 'optional'),
    position: column('check', 'position', 'required'),
    severity: column('check', 'severity', 'required'),
    summary: column('check', 'summary', 'required'),
    explanation: column('check', 'explanation', 'required'),
    query: column('check', 'query', 'required'),
    kinds: column('check', 'kinds', 'optional'),
  },
  handler: addCheck,
};

/** Adds the check, new and whole; a name taken, by Lathe's own checks or the product's, is refused (LA-CHK-INV01). */
export function addCheck(tx: Transaction, input: AddCheck): void {
  const checks = new CheckRepository(tx);
  const taken = checks.load(input.name);
  if (taken) {
    tx.refuse('primary-key', checks.isLathes(taken) ? `check ${input.name} already exists as one of Lathe's own (lathe/data/check.jsonl); give the check a name of its own` : `check ${input.name} already exists`);
  }
  checks.save(checks.create({ root: input.name, check: input }));
}
