import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { PredicateRow } from '../../../platform/data/tables.ts';
import { CHANGE_PREDICATE_IDENTITY } from './identities.generated.ts';
import { changePredicate } from './handlers.generated.ts';

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
