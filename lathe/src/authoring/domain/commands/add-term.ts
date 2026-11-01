import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { TermRow } from '../../../platform/data/tables.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_TERM_IDENTITY } from './identities.generated.ts';

export type AddTerm = Pick<TermRow, 'id' | 'title' | 'domain_id' | 'meaning' | 'group_name'> & { builds_on?: string[] };

export const ADD_TERM: CommandDefinition<AddTerm> = {
  ...ADD_TERM_IDENTITY,
  input: {
    id: column('term', 'id', 'required'),
    title: column('term', 'title', 'required'),
    domain_id: column('term', 'domain_id', 'required'),
    meaning: column('term', 'meaning', 'required'),
    group_name: column('term', 'group_name', 'optional'),
    builds_on: ids('The terms its meaning uses, of any domain of the product, each defined without it.', 'optional'),
  },
  handler: addTerm,
};

export function addTerm(tx: Transaction, input: AddTerm): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.domain_id) ?? tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { builds_on: buildsOn = [], ...row } = input;
  domain.terms.push({ row, buildsOn });
  holdToRules(tx, domain);
  domains.save(domain);
}
