import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { GuaranteeRow } from '../../../platform/data/tables.ts';
import { CHANGE_GUARANTEE_IDENTITY } from './identities.generated.ts';
import { changeGuarantee } from './handlers.generated.ts';

/** The guarantee's changes: a column given is set; kept_by, when given, replaces the list. Its domain never changes. */
export type ChangeGuarantee = Pick<GuaranteeRow, 'id'> & { title?: GuaranteeRow['title']; statement?: GuaranteeRow['statement']; kept_by?: string[] };

export const CHANGE_GUARANTEE = {
  ...CHANGE_GUARANTEE_IDENTITY,
  input: {
    id: column('guarantee', 'id', 'required'),
    title: column('guarantee', 'title', 'optional'),
    statement: column('guarantee', 'statement', 'optional'),
    kept_by: ids('The building blocks that keep it. Replaces the list.', 'optional'),
  },
  handler: changeGuarantee,
} satisfies CommandDefinition<ChangeGuarantee>;
