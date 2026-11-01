import { column, id, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { FlowStepRow } from '../../../platform/data/tables.ts';
import { ADD_FLOW_STEP_IDENTITY } from './identities.generated.ts';
import { addFlowStep } from './handlers.generated.ts';

export type AddFlowStep = Pick<FlowStepRow, 'id' | 'title' | 'flow_id' | 'path' | 'position'> & {
  fulfills?: string[];
  invokes?: string;
  happens_in?: string;
  exchanges_with?: string[];
};

export const ADD_FLOW_STEP = {
  ...ADD_FLOW_STEP_IDENTITY,
  input: {
    id: column('flow_step', 'id', 'required'),
    title: column('flow_step', 'title', 'required'),
    flow_id: column('flow_step', 'flow_id', 'required'),
    path: column('flow_step', 'path', 'required'),
    position: column('flow_step', 'position', 'required'),
    fulfills: ids('The UC requirements of its own use case it fulfills.', 'optional'),
    invokes: id('The command or query it invokes, if any.', 'optional'),
    happens_in: id('The view it happens in, if any: only on a web app, desktop or other interface.', 'optional'),
    exchanges_with: ids('The integrations it exchanges with.', 'optional'),
  },
  handler: addFlowStep,
} satisfies CommandDefinition<AddFlowStep>;
