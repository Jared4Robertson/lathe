// Change a term (LA-AUT-CMD167): Changes a term's title, meaning or group.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { TermRow } from '../../../platform/data/tables.ts';
import { DOMAIN_SLICE, changed } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The term's changes: a column given is set, null clears an optional one. */
export type ChangeTerm = Pick<TermRow, 'id'> & { title?: TermRow['title']; meaning?: TermRow['meaning']; group_name?: TermRow['group_name'] | null };

/** Change a term (LA-AUT-CMD167). */
export const CHANGE_TERM: CommandDefinition<ChangeTerm> = {
  id: 'LA-AUT-CMD167',
  slice: DOMAIN_SLICE,
  name: 'change-term',
  description: "Changes a term's title, meaning or group.",
  method: 'POST',
  route: '/api/domain/change-term',
  input: {
    id: column('term', 'id', 'required'),
    title: column('term', 'title', 'optional'),
    meaning: column('term', 'meaning', 'optional'),
    group_name: column('term', 'group_name', 'clearable'),
  },
  handler: changeTerm,
};

/** Changes the term's columns. */
export function changeTerm(tx: Transaction, input: ChangeTerm): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('term', input.id) ?? tx.refuse('missing', `there is no term ${input.id}`);
  domain.terms = domain.terms.map((t) => (t.id === input.id ? changed(t, input, ['title', 'meaning', 'group_name']) : t));
  holdToRules(tx, domain);
  domains.save(domain);
}
