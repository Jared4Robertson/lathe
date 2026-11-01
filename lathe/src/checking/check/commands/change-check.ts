import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { CheckRow } from '../../../platform/data/tables.ts';
import { changed } from '../../../platform/data/rows.ts';
import { CheckRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_CHECK_IDENTITY } from './identities.generated.ts';

/** The check's changes: a column given is set, null clears an optional one. */
export type ChangeCheck = Pick<CheckRow, 'name'> & {
  domain_id?: CheckRow['domain_id'];
  position?: CheckRow['position'];
  severity?: CheckRow['severity'];
  summary?: CheckRow['summary'];
  explanation?: CheckRow['explanation'];
  query?: CheckRow['query'];
  kinds?: CheckRow['kinds'] | null;
};

export const CHANGE_CHECK = {
  ...CHANGE_CHECK_IDENTITY,
  input: {
    name: column('check', 'name', 'required'),
    domain_id: column('check', 'domain_id', 'optional'),
    position: column('check', 'position', 'optional'),
    severity: column('check', 'severity', 'optional'),
    summary: column('check', 'summary', 'optional'),
    explanation: column('check', 'explanation', 'optional'),
    query: column('check', 'query', 'optional'),
    kinds: column('check', 'kinds', 'clearable'),
  },
  handler: changeCheck,
} satisfies CommandDefinition<ChangeCheck>;

/** Changes the check's columns; one of Lathe's own is refused by its rules (LA-CHK-INV02). */
export function changeCheck(tx: Transaction, input: ChangeCheck): void {
  const checks = new CheckRepository(tx);
  const check = checks.load(input.name) ?? tx.refuse('missing', `there is no check ${input.name}`);
  check.check = changed(check.check, input, ['domain_id', 'position', 'severity', 'summary', 'explanation', 'query', 'kinds']);
  holdToRules(tx, check);
  checks.save(check);
}
