import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { CheckRow } from '../../../platform/data/tables.ts';
import { changed, CHECK_SLICE } from '../model.ts';
import { CheckRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

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

export const CHANGE_CHECK: CommandDefinition<ChangeCheck> = {
  id: 'LA-CHK-CMD02',
  slice: CHECK_SLICE,
  name: 'change-check',
  description: "Changes a check row's domain, place in the run order, severity, summary, explanation, query or kinds. Its name and product do not change, and Lathe's own checks are read-only.",
  method: 'POST',
  route: '/api/check/change-check',
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
};

/** Changes the check's columns; one of Lathe's own is refused by its rules (LA-CHK-INV02). */
export function changeCheck(tx: Transaction, input: ChangeCheck): void {
  const checks = new CheckRepository(tx);
  const check = checks.load(input.name) ?? tx.refuse('missing', `there is no check ${input.name}`);
  check.check = changed(check.check, input, ['domain_id', 'position', 'severity', 'summary', 'explanation', 'query', 'kinds']);
  holdToRules(tx, check);
  checks.save(check);
}
