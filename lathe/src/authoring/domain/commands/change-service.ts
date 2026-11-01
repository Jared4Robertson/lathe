import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ServiceRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_SERVICE_IDENTITY } from './identities.generated.ts';

/** The service's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeService = Pick<ServiceRow, 'id'> & { title?: ServiceRow['title']; file?: ServiceRow['file'] | null; meets?: string[]; packages?: string[] };

export const CHANGE_SERVICE: CommandDefinition<ChangeService> = {
  ...CHANGE_SERVICE_IDENTITY,
  input: {
    id: column('service', 'id', 'required'),
    title: column('service', 'title', 'optional'),
    file: column('service', 'file', 'clearable'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
  },
  handler: changeService,
};

/** Changes the service's columns, links and packages. */
export function changeService(tx: Transaction, input: ChangeService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('service', input.id) ?? tx.refuse('missing', `there is no service ${input.id}`);
  domain.services = domain.services.map((s) =>
    s.row.id === input.id ? { row: changed(s.row, input, ['title', 'file']), meets: input.meets ?? s.meets, packages: input.packages ?? s.packages } : s,
  );
  holdToRules(tx, domain);
  domains.save(domain);
}
