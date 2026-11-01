import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { CapabilityRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_CAPABILITY_IDENTITY } from './identities.generated.ts';

/** The capability's changes: a column given is set; serves, when given, replaces the list. */
export type ChangeCapability = Pick<CapabilityRow, 'id'> & { title?: CapabilityRow['title']; position?: CapabilityRow['position']; description?: CapabilityRow['description']; serves?: string[] };

export const CHANGE_CAPABILITY: CommandDefinition<ChangeCapability> = {
  ...CHANGE_CAPABILITY_IDENTITY,
  input: {
    id: column('capability', 'id', 'required'),
    title: column('capability', 'title', 'optional'),
    position: column('capability', 'position', 'optional'),
    description: column('capability', 'description', 'optional'),
    serves: ids('The business outcomes it serves. Replaces the list.', 'optional'),
  },
  handler: changeCapability,
};

/** Changes the capability's columns and links. */
export function changeCapability(tx: Transaction, input: ChangeCapability): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('capability', input.id) ?? tx.refuse('missing', `there is no capability ${input.id}`);
  domain.capabilities = domain.capabilities.map((c) => (c.row.id === input.id ? { row: changed(c.row, input, ['title', 'position', 'description']), serves: input.serves ?? c.serves } : c));
  holdToRules(tx, domain);
  domains.save(domain);
}
