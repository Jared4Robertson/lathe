import { column, id, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { FlowStepRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_FLOW_STEP_IDENTITY } from './identities.generated.ts';

/** The step's changes: a column given is set; a list given replaces its links; null clears a single link. */
export type ChangeFlowStep = Pick<FlowStepRow, 'id'> & {
  title?: string;
  path?: string;
  position?: number;
  fulfills?: string[];
  invokes?: string | null;
  happens_in?: string | null;
  exchanges_with?: string[];
};

export const CHANGE_FLOW_STEP: CommandDefinition<ChangeFlowStep> = {
  ...CHANGE_FLOW_STEP_IDENTITY,
  input: {
    id: column('flow_step', 'id', 'required'),
    title: column('flow_step', 'title', 'optional'),
    path: column('flow_step', 'path', 'optional'),
    position: column('flow_step', 'position', 'optional'),
    fulfills: ids('The UC requirements of its own use case it fulfills. Replaces the list.', 'optional'),
    invokes: id('The command or query it invokes, if any.', 'clearable'),
    happens_in: id('The view it happens in, if any: only on a web app, desktop or other interface.', 'clearable'),
    exchanges_with: ids('The integrations it exchanges with. Replaces the list.', 'optional'),
  },
  handler: changeFlowStep,
};

/** Changes the step's columns and links. */
export function changeFlowStep(tx: Transaction, input: ChangeFlowStep): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow_step', input.id) ?? tx.refuse('missing', `there is no flow step ${input.id}`);
  useCase.steps = useCase.steps.map((step) => {
    if (step.row.id !== input.id) return step;
    return {
      row: changed(step.row, input, ['title', 'path', 'position']),
      fulfills: input.fulfills ?? step.fulfills,
      invokes: input.invokes === undefined ? step.invokes : input.invokes,
      happensIn: input.happens_in === undefined ? step.happensIn : input.happens_in,
      exchangesWith: input.exchanges_with ?? step.exchangesWith,
    };
  });
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
