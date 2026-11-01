import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { CapabilityRow } from '../../../platform/data/tables.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_CAPABILITY_IDENTITY } from './identities.generated.ts';

export type AddCapability = Pick<CapabilityRow, 'id' | 'title' | 'domain_id' | 'position' | 'description'> & { serves?: string[] };

export const ADD_CAPABILITY = {
  ...ADD_CAPABILITY_IDENTITY,
  input: {
    id: column('capability', 'id', 'required'),
    title: column('capability', 'title', 'required'),
    domain_id: column('capability', 'domain_id', 'required'),
    position: column('capability', 'position', 'required'),
    description: column('capability', 'description', 'required'),
    serves: ids('The business outcomes it serves.', 'optional'),
  },
  handler: addCapability,
} satisfies CommandDefinition<AddCapability>;

export function addCapability(tx: Transaction, input: AddCapability): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.domain_id) ?? tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { serves = [], ...row } = input;
  domain.capabilities.push({ row, serves });
  holdToRules(tx, domain);
  domains.save(domain);
}
