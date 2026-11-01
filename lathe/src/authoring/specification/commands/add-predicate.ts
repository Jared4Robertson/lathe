import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PredicateRow } from '../../../platform/data/tables.ts';
import { SpecificationRepository } from '../repository.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { specificationOneEach } from '../rules.ts';
import { ADD_PREDICATE_IDENTITY } from './identities.generated.ts';

export type AddPredicate = Pick<PredicateRow, 'id' | 'title' | 'specification_id' | 'file'> & { meets?: string[]; packages?: string[] };

export const ADD_PREDICATE: CommandDefinition<AddPredicate> = {
  ...ADD_PREDICATE_IDENTITY,
  input: {
    id: column('predicate', 'id', 'required'),
    title: column('predicate', 'title', 'required'),
    specification_id: column('predicate', 'specification_id', 'required'),
    file: column('predicate', 'file', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
  },
  handler: addPredicate,
};

/** Adds the predicate to its specification, which has none yet. */
export function addPredicate(tx: Transaction, input: AddPredicate): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.load(input.specification_id) ?? tx.refuse('missing', `there is no specification ${input.specification_id}`);
  const { meets = [], packages = [], ...row } = input;
  refuseBroken(specificationOneEach([...(specification.predicate ? [specification.predicate.row] : []), row], []));
  specification.predicate = { row, meets, packages };
  specifications.save(specification);
}
