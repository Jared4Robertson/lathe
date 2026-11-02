import { column, id, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { PolicyRow } from '../../../platform/data/tables.ts';
import { CHANGE_POLICY_IDENTITY } from './identities.generated.ts';
import { changePolicy } from './handlers.generated.ts';

/** The policy's changes: a column given is set; null clears the event it hears; a list given replaces the list. */
export type ChangePolicy = Pick<PolicyRow, 'id'> & { title?: string; statement?: string; hears?: string | null; exchanges_with?: string[] };

export const CHANGE_POLICY = {
  ...CHANGE_POLICY_IDENTITY,
  input: {
    id: column('policy', 'id', 'required'),
    title: column('policy', 'title', 'optional'),
    statement: column('policy', 'statement', 'optional'),
    hears: id('The event it hears: of its own domain, or another domain\'s published one.', 'clearable'),
    exchanges_with: ids('The integrations it exchanges with as it acts. Replaces the list.', 'optional'),
  },
  handler: changePolicy,
} satisfies CommandDefinition<ChangePolicy>;
