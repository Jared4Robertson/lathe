import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { FlowRow } from '../../../platform/data/tables.ts';
import { ADD_FLOW_IDENTITY } from './identities.generated.ts';
import { addFlow } from './handlers.generated.ts';

/** A new flow. */
export type AddFlow = Pick<FlowRow, 'id' | 'title' | 'use_case_id'>;

export const ADD_FLOW = {
  ...ADD_FLOW_IDENTITY,
  input: {
    id: column('flow', 'id', 'required'),
    title: column('flow', 'title', 'required'),
    use_case_id: column('flow', 'use_case_id', 'required'),
  },
  handler: addFlow,
} satisfies CommandDefinition<AddFlow>;
