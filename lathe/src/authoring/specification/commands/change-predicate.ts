import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PredicateRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { SpecificationRepository } from '../repository.ts';
import { CHANGE_PREDICATE_IDENTITY } from './identities.generated.ts';

/** The predicate's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangePredicate = Pick<PredicateRow, 'id'> & { title?: PredicateRow['title']; file?: PredicateRow['file'] | null; meets?: string[]; packages?: string[] };

export const CHANGE_PREDICATE = {
  ...CHANGE_PREDICATE_IDENTITY,
  input: {
    id: column('predicate', 'id', 'required'),
    title: column('predicate', 'title', 'optional'),
    file: column('predicate', 'file', 'clearable'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
  },
  handler: changePredicate,
} satisfies CommandDefinition<ChangePredicate>;

/** Changes the predicate's columns, links and packages. */
export function changePredicate(tx: Transaction, input: ChangePredicate): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.loadHolding('predicate', input.id) ?? tx.refuse('missing', `there is no predicate ${input.id}`);
  const predicate = specification.predicate!;
  specification.predicate = { row: changed(predicate.row, input, ['title', 'file']), meets: input.meets ?? predicate.meets, packages: input.packages ?? predicate.packages };
  specifications.save(specification);
}
