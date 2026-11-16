import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { GuaranteeRow } from '../../../platform/data/tables.ts';
import { CHANGE_GUARANTEE_IDENTITY } from './identities.generated.ts';
import { changeGuarantee } from './handlers.generated.ts';

/** The guarantee's changes: a column given is set, an emptied one cleared; kept_by and meets, when given, replace the list. Its maker never changes. */
export type ChangeGuarantee = Pick<GuaranteeRow, 'id'> & { title?: GuaranteeRow['title']; statement?: GuaranteeRow['statement']; consumers?: string | null; group_name?: string | null; kept_by?: string[]; meets?: string[] };

export const CHANGE_GUARANTEE = {
  ...CHANGE_GUARANTEE_IDENTITY,
  input: {
    id: column('guarantee', 'id', 'required'),
    title: column('guarantee', 'title', 'optional'),
    statement: column('guarantee', 'statement', 'optional'),
    consumers: column('guarantee', 'consumers', 'clearable'),
    group_name: column('guarantee', 'group_name', 'clearable'),
    kept_by: ids('The building blocks that keep it. Replaces the list.', 'optional'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
  },
  handler: changeGuarantee,
} satisfies CommandDefinition<ChangeGuarantee>;
