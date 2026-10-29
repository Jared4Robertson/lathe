// Add a capability (LA-AUT-CMD163): Adds a capability to its domain, at a position, with the business outcomes it serves.
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { CapabilityRow } from '../../../platform/data/tables.ts';
import { DOMAIN_SLICE } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new capability, with the business outcomes it serves. */
export type AddCapability = Pick<CapabilityRow, 'id' | 'title' | 'domain_id' | 'position' | 'description'> & { serves?: string[] };

/** Add a capability (LA-AUT-CMD163). */
export const ADD_CAPABILITY: CommandDefinition<AddCapability> = {
  id: 'LA-AUT-CMD163',
  slice: DOMAIN_SLICE,
  name: 'add-capability',
  description: 'Adds a capability to its domain, at a position, with the business outcomes it serves.',
  method: 'POST',
  route: '/api/domain/add-capability',
  input: {
    id: column('capability', 'id', 'required'),
    title: column('capability', 'title', 'required'),
    domain_id: column('capability', 'domain_id', 'required'),
    position: column('capability', 'position', 'required'),
    description: column('capability', 'description', 'required'),
    serves: ids('The business outcomes it serves.', 'optional'),
  },
  handler: addCapability,
};

/** Adds the capability to its domain, with its links. */
export function addCapability(tx: Transaction, input: AddCapability): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.domain_id) ?? tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { serves = [], ...row } = input;
  domain.capabilities.push({ row, serves });
  holdToRules(tx, domain);
  domains.save(domain);
}
