import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { CheckRow } from '../../../platform/data/tables.ts';
import { CheckRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_CHECK_IDENTITY } from './identities.generated.ts';

/** A new check row. */
export type AddCheck = Pick<CheckRow, 'name' | 'product_id' | 'position' | 'severity' | 'summary' | 'explanation' | 'query' | 'kinds'>;

export const ADD_CHECK: CommandDefinition<AddCheck> = {
  ...ADD_CHECK_IDENTITY,
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

/** Adds the check, new and whole: a name one of Lathe's own has is refused by its rules (LA-CHK-INV01), one the product's has as a key taken. */
export function addCheck(tx: Transaction, input: AddCheck): void {
  const checks = new CheckRepository(tx);
  const taken = checks.load(input.name);
  if (taken && !taken.lathes) tx.refuse('primary-key', `check ${input.name} already exists`);
  const check = checks.create({ root: input.name, check: input, lathes: false });
  holdToRules(tx, check);
  checks.save(check);
}
