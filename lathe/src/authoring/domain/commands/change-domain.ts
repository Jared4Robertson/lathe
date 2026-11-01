import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DomainRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_DOMAIN_IDENTITY } from './identities.generated.ts';

/** The domain's changes: a column given is set, null clears an optional one. */
export type ChangeDomain = Pick<DomainRow, 'id'> & { title?: DomainRow['title']; subdomain_type?: DomainRow['subdomain_type']; description?: DomainRow['description']; notes?: DomainRow['notes'] | null };

export const CHANGE_DOMAIN = {
  ...CHANGE_DOMAIN_IDENTITY,
  input: {
    id: column('domain', 'id', 'required'),
    title: column('domain', 'title', 'optional'),
    subdomain_type: column('domain', 'subdomain_type', 'optional'),
    description: column('domain', 'description', 'optional'),
    notes: column('domain', 'notes', 'clearable'),
  },
  handler: changeDomain,
} satisfies CommandDefinition<ChangeDomain>;

/** Changes the domain's own columns. */
export function changeDomain(tx: Transaction, input: ChangeDomain): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.id) ?? tx.refuse('missing', `there is no domain ${input.id}`);
  domain.domain = changed(domain.domain, input, ['title', 'subdomain_type', 'description', 'notes']);
  holdToRules(tx, domain);
  domains.save(domain);
}
