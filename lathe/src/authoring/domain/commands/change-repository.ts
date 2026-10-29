// Change a repository (LA-AUT-CMD173): Changes a repository's title, file or description, the aggregate it persists (null clears it), or the standard rules it meets or packages it uses (each the whole list).
import { column, id, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { RepositoryRow } from '../../../platform/data/tables.ts';
import { DOMAIN_SLICE, changed } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The repository's changes: a column given is set, null clears an optional one or the aggregate it persists; a list given replaces the list. */
export type ChangeRepository = Pick<RepositoryRow, 'id'> & { title?: RepositoryRow['title']; file?: RepositoryRow['file'] | null; description?: RepositoryRow['description']; persists?: string | null; meets?: string[]; packages?: string[] };

/** Change a repository (LA-AUT-CMD173). */
export const CHANGE_REPOSITORY: CommandDefinition<ChangeRepository> = {
  id: 'LA-AUT-CMD173',
  slice: DOMAIN_SLICE,
  name: 'change-repository',
  description: "Changes a repository's title, file or description, the aggregate it persists (null clears it), or the standard rules it meets or packages it uses (each the whole list).",
  method: 'POST',
  route: '/api/domain/change-repository',
  input: {
    id: column('repository', 'id', 'required'),
    title: column('repository', 'title', 'optional'),
    file: column('repository', 'file', 'clearable'),
    description: column('repository', 'description', 'optional'),
    persists: id('The aggregate it loads and saves, whole: one of its own domain.', 'clearable'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
  },
  handler: changeRepository,
};

/** Changes the repository's columns, links and packages. */
export function changeRepository(tx: Transaction, input: ChangeRepository): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('repository', input.id) ?? tx.refuse('missing', `there is no repository ${input.id}`);
  domain.repositories = domain.repositories.map((r) =>
    r.row.id === input.id
      ? {
          row: changed(r.row, input, ['title', 'file', 'description']),
          persists: input.persists === undefined ? r.persists : input.persists,
          meets: input.meets ?? r.meets,
          packages: input.packages ?? r.packages,
          shares: r.shares,
        }
      : r,
  );
  holdToRules(tx, domain);
  domains.save(domain);
}
