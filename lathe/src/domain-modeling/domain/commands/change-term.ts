import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { TermRow } from '../../../platform/data/tables.ts';
import { CHANGE_TERM_IDENTITY } from './identities.generated.ts';
import { changeTerm } from './handlers.generated.ts';

/** The term's changes: a column given is set, null clears an optional one; builds_on, when given, replaces the list. */
export type ChangeTerm = Pick<TermRow, 'id'> & { title?: TermRow['title']; meaning?: TermRow['meaning']; group_name?: TermRow['group_name'] | null; builds_on?: string[] };

export const CHANGE_TERM = {
  ...CHANGE_TERM_IDENTITY,
  input: {
    id: column('term', 'id', 'required'),
    title: column('term', 'title', 'optional'),
    meaning: column('term', 'meaning', 'optional'),
    group_name: column('term', 'group_name', 'clearable'),
    builds_on: ids('The terms its meaning uses, each defined without it. Replaces the list.', 'optional'),
  },
  handler: changeTerm,
} satisfies CommandDefinition<ChangeTerm>;
