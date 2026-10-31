import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ServiceRow } from '../../../platform/data/tables.ts';
import { DOMAIN_SLICE } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export type AddService = Pick<ServiceRow, 'id' | 'title' | 'domain_service_id' | 'file'> & { meets?: string[]; packages?: string[] };

export const ADD_SERVICE: CommandDefinition<AddService> = {
  id: 'LA-AUT-CMD175',
  slice: DOMAIN_SLICE,
  name: 'add-service',
  description: 'Adds the service that implements a domain service in code, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/domain/add-service',
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
