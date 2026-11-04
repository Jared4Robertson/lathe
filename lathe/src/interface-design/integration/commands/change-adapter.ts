import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { AdapterRow } from '../../../platform/data/tables.ts';
import { CHANGE_ADAPTER_IDENTITY } from './identities.generated.ts';
import { changeAdapter } from './handlers.generated.ts';

/** The adapter's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeAdapter = Pick<AdapterRow, 'id'> & { title?: AdapterRow['title']; description?: AdapterRow['description']; file?: AdapterRow['file'] | null; meets?: string[]; packages?: string[] };

export const CHANGE_ADAPTER = {
  ...CHANGE_ADAPTER_IDENTITY,
  input: {
    id: column('adapter', 'id', 'required'),
    title: column('adapter', 'title', 'optional'),
    description: column('adapter', 'description', 'optional'),
    file: column('adapter', 'file', 'clearable'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
  },
  handler: changeAdapter,
} satisfies CommandDefinition<ChangeAdapter>;
