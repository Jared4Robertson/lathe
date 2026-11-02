import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { FlowRow } from '../../../platform/data/tables.ts';
import { CHANGE_FLOW_IDENTITY } from './identities.generated.ts';
import { changeFlow } from './handlers.generated.ts';

/** The flow's new title. */
export type ChangeFlow = Pick<FlowRow, 'id' | 'title'>;

export const CHANGE_FLOW = {
  ...CHANGE_FLOW_IDENTITY,
  input: {
    id: column('flow', 'id', 'required'),
    title: column('flow', 'title', 'required'),
  },
  handler: changeFlow,
} satisfies CommandDefinition<ChangeFlow>;
