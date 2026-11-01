import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { InterfaceRow } from '../../../platform/data/tables.ts';
import { CHANGE_INTERFACE_IDENTITY } from './identities.generated.ts';
import { changeInterface } from './handlers.generated.ts';

/** The interface's changes: a column given is set; a list given replaces its roles or the use cases it offers. */
export type ChangeInterface = Pick<InterfaceRow, 'id'> & { title?: string; kind?: InterfaceRow['kind']; description?: string; public?: boolean; actors?: string[]; offers?: string[] };

export const CHANGE_INTERFACE = {
  ...CHANGE_INTERFACE_IDENTITY,
  input: {
    id: column('interface', 'id', 'required'),
    title: column('interface', 'title', 'optional'),
    kind: column('interface', 'kind', 'optional'),
    description: column('interface', 'description', 'optional'),
    public: column('interface', 'public', 'optional'),
    actors: texts('The roles of the product that use it, in order. Replaces the list.', 'optional'),
    offers: ids('The use cases of the product it offers. Replaces the list.', 'optional'),
  },
  handler: changeInterface,
} satisfies CommandDefinition<ChangeInterface>;
