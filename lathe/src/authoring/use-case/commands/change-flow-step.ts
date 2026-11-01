import { column, id, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { FlowStepRow } from '../../../platform/data/tables.ts';
import { CHANGE_FLOW_STEP_IDENTITY } from './identities.generated.ts';
import { changeFlowStep } from './handlers.generated.ts';

/** The step's changes: a column given is set, null clears its interface; a list given replaces its links; null clears what it invokes. */
export type ChangeFlowStep = Pick<FlowStepRow, 'id'> & {
  title?: string;
  interface_id?: string | null;
  fulfills?: string[];
  invokes?: string | null;
  exchanges_with?: string[];
};

export const CHANGE_FLOW_STEP = {
  ...CHANGE_FLOW_STEP_IDENTITY,
  input: {
    id: column('flow_step', 'id', 'required'),
    title: column('flow_step', 'title', 'optional'),
    interface_id: column('flow_step', 'interface_id', 'clearable'),
    fulfills: ids('The UC requirements of its own use case it fulfills. Replaces the list.', 'optional'),
    invokes: id('The command or query it invokes, if any.', 'clearable'),
    exchanges_with: ids('The integrations it exchanges with. Replaces the list.', 'optional'),
  },
  handler: changeFlowStep,
} satisfies CommandDefinition<ChangeFlowStep>;
