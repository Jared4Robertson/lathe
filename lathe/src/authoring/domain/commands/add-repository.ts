// Add a repository (LA-AUT-CMD172): Adds a repository to its domain, with the aggregate it persists, the data store it is stored in, the standard rules it meets and the packages it uses.
import { column, id, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { RepositoryRow } from '../../../platform/data/tables.ts';
import { DOMAIN_SLICE } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new repository, with the links it starts and the packages it uses. */
export type AddRepository = Pick<RepositoryRow, 'id' | 'title' | 'domain_id' | 'file' | 'description'> & { persists?: string; stored_in?: string; meets?: string[]; packages?: string[] };

/** Add a repository (LA-AUT-CMD172). */
export const ADD_REPOSITORY: CommandDefinition<AddRepository> = {
  id: 'LA-AUT-CMD172',
  slice: DOMAIN_SLICE,
  name: 'add-repository',
  description: 'Adds a repository to its domain, with the aggregate it persists, the data store it is stored in, the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/domain/add-repository',
  input: {
    id: column('repository', 'id', 'required'),
    title: column('repository', 'title', 'required'),
    domain_id: column('repository', 'domain_id', 'required'),
    file: column('repository', 'file', 'optional'),
    description: column('repository', 'description', 'required'),
    persists: id('The aggregate it loads and saves, whole: one of its own domain.', 'optional'),
    stored_in: id('The data store it loads and saves its aggregate in.', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
  },
  handler: addRepository,
};

/** Adds the repository to its domain, with its links and packages. */
export function addRepository(tx: Transaction, input: AddRepository): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.domain_id) ?? tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { persists, stored_in, meets = [], packages = [], ...row } = input;
  domain.repositories.push({ row, persists: persists ?? null, storedIn: stored_in ?? null, meets, packages, shares: [] });
  holdToRules(tx, domain);
  domains.save(domain);
}
