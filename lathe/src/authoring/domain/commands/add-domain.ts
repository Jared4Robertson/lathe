import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DomainRow } from '../../../platform/data/tables.ts';
import { newDomain } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_DOMAIN_IDENTITY } from './identities.generated.ts';

/** A new domain: its row. */
export type AddDomain = Pick<DomainRow, 'id' | 'title' | 'product_id' | 'subdomain_type' | 'description' | 'notes'>;

export const ADD_DOMAIN: CommandDefinition<AddDomain> = {
  ...ADD_DOMAIN_IDENTITY,
  input: {
    id: column('domain', 'id', 'required'),
    title: column('domain', 'title', 'required'),
    product_id: column('domain', 'product_id', 'required'),
    subdomain_type: column('domain', 'subdomain_type', 'required'),
    description: column('domain', 'description', 'required'),
    notes: column('domain', 'notes', 'optional'),
  },
  handler: addDomain,
};

/** Adds the domain, whole and new. */
export function addDomain(tx: Transaction, input: AddDomain): void {
  const domains = new DomainRepository(tx);
  const domain = domains.create(newDomain(input));
  holdToRules(tx, domain);
  domains.save(domain);
}
