import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { TermRow } from '../../../platform/data/tables.ts';
import { DOMAIN_SLICE, changed } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The term's changes: a column given is set, null clears an optional one; builds_on, when given, replaces the list. */
export type ChangeTerm = Pick<TermRow, 'id'> & { title?: TermRow['title']; meaning?: TermRow['meaning']; group_name?: TermRow['group_name'] | null; builds_on?: string[] };

export const CHANGE_TERM: CommandDefinition<ChangeTerm> = {
  id: 'LA-AUT-CMD167',
  slice: DOMAIN_SLICE,
  name: 'change-term',
  description: "Changes a term's title, meaning or group, or the terms it builds on (the whole list).",
  method: 'POST',
  route: '/api/domain/change-term',
  input: {
    id: column('term', 'id', 'required'),
    title: column('term', 'title', 'optional'),
    meaning: column('term', 'meaning', 'optional'),
    group_name: column('term', 'group_name', 'clearable'),
    builds_on: ids('The terms its meaning uses, each defined without it. Replaces the list.', 'optional'),
  },
  handler: changeTerm,
};

/** Changes the term's columns and links; refused when they lead back to it. */
export function changeTerm(tx: Transaction, input: ChangeTerm): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('term', input.id) ?? tx.refuse('missing', `there is no term ${input.id}`);
  domain.terms = domain.terms.map((t) => (t.row.id === input.id ? { row: changed(t.row, input, ['title', 'meaning', 'group_name']), buildsOn: input.builds_on ?? t.buildsOn } : t));
  holdToRules(tx, domain);
  domains.save(domain);
}
