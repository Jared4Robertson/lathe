import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { TermRow } from '../../../platform/data/tables.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_TERM_IDENTITY } from './identities.generated.ts';

/** The term and the domain it moves to. */
export type MoveTerm = Pick<TermRow, 'id' | 'domain_id'>;

export const MOVE_TERM = {
  ...MOVE_TERM_IDENTITY,
  input: {
    id: column('term', 'id', 'required'),
    domain_id: column('term', 'domain_id', 'required'),
  },
  handler: moveTerm,
} satisfies CommandDefinition<MoveTerm>;

// The term leaves its domain's instance with its new domain named, and the new IDs then carry it into the other.
export function moveTerm(tx: Transaction, input: MoveTerm): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('term', input.id) ?? tx.refuse('missing', `there is no term ${input.id}`);
  const at = domain.terms.findIndex((x) => x.row.id === input.id);
  const renames = toDomain(tx, { id: input.id, label: 'term', domainId: domain.root }, input.domain_id);
  domain.terms[at] = { ...domain.terms[at], row: { ...domain.terms[at].row, domain_id: input.domain_id } };
  holdToRules(tx, domain);
  domains.save(domain);
  domains.carryRenames(renames);
}
