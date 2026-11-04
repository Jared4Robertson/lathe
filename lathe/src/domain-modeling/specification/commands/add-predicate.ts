import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { PredicateRow } from '../../../platform/data/tables.ts';
import { ADD_PREDICATE_IDENTITY } from './identities.generated.ts';
import { addPredicate } from './handlers.generated.ts';

export type AddPredicate = Pick<PredicateRow, 'id' | 'title' | 'specification_id' | 'file'> & { meets?: string[]; packages?: string[]; helpers?: string[] };

export const ADD_PREDICATE = {
  ...ADD_PREDICATE_IDENTITY,
  input: {
    id: column('predicate', 'id', 'required'),
    title: column('predicate', 'title', 'required'),
    specification_id: column('predicate', 'specification_id', 'required'),
    file: column('predicate', 'file', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
    helpers: texts('The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', 'optional'),
  },
  handler: addPredicate,
} satisfies CommandDefinition<AddPredicate>;
