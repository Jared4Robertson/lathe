import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { CapabilityRow } from '../../../platform/data/tables.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_CAPABILITY_IDENTITY } from './identities.generated.ts';

/** The capability and the domain it moves to. */
export type MoveCapability = Pick<CapabilityRow, 'id' | 'domain_id'>;

export const MOVE_CAPABILITY = {
  ...MOVE_CAPABILITY_IDENTITY,
  input: {
    id: column('capability', 'id', 'required'),
    domain_id: column('capability', 'domain_id', 'required'),
  },
  handler: moveCapability,
} satisfies CommandDefinition<MoveCapability>;

// The capability leaves its domain's instance with its new domain named, and the new IDs then carry it into the other.
export function moveCapability(tx: Transaction, input: MoveCapability): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('capability', input.id) ?? tx.refuse('missing', `there is no capability ${input.id}`);
  const at = domain.capabilities.findIndex((x) => x.row.id === input.id);
  const renames = toDomain(tx, { id: input.id, label: 'capability', domainId: domain.root }, input.domain_id);
  domain.capabilities[at] = { ...domain.capabilities[at], row: { ...domain.capabilities[at].row, domain_id: input.domain_id } };
  holdToRules(tx, domain);
  domains.save(domain);
  domains.carryRenames(renames);
}
