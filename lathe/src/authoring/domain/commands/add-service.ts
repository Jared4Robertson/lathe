import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ServiceRow } from '../../../platform/data/tables.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_SERVICE_IDENTITY } from './identities.generated.ts';

export type AddService = Pick<ServiceRow, 'id' | 'title' | 'domain_service_id' | 'file'> & { meets?: string[]; packages?: string[] };

export const ADD_SERVICE: CommandDefinition<AddService> = {
  ...ADD_SERVICE_IDENTITY,
  input: {
    id: column('service', 'id', 'required'),
    title: column('service', 'title', 'required'),
    domain_service_id: column('service', 'domain_service_id', 'required'),
    file: column('service', 'file', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
  },
  handler: addService,
};

export function addService(tx: Transaction, input: AddService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service', input.domain_service_id) ?? tx.refuse('missing', `there is no domain service ${input.domain_service_id}`);
  const { meets = [], packages = [], ...row } = input;
  domain.services.push({ row, meets, packages });
  holdToRules(tx, domain);
  domains.save(domain);
}
