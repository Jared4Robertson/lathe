import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { moveStep } from '../../../platform/data/step-order.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { FlowStepRow } from '../../../platform/data/tables.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_FLOW_STEP_IDENTITY } from './identities.generated.ts';

/** The step, the path it goes to (its own when none is given) and the position it takes there. */
export type MoveFlowStep = Pick<FlowStepRow, 'id' | 'position'> & { path?: string };

export const MOVE_FLOW_STEP = {
  ...MOVE_FLOW_STEP_IDENTITY,
  input: {
    id: column('flow_step', 'id', 'required'),
    path: column('flow_step', 'path', 'optional'),
    position: column('flow_step', 'position', 'required'),
  },
  handler: moveFlowStep,
} satisfies CommandDefinition<MoveFlowStep>;

/** Puts the step at the position of the path, and renumbers the path it leaves and the path it joins so each stays 1, 2, 3. */
export function moveFlowStep(tx: Transaction, input: MoveFlowStep): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow_step', input.id) ?? tx.refuse('missing', `there is no flow step ${input.id}`);
  const flowId = useCase.steps.find((s) => s.row.id === input.id)!.row.flow_id;
  const moved = new Map(moveStep(useCase.steps.map((s) => s.row).filter((r) => r.flow_id === flowId), input.id, input.path, input.position, (rule, message) => tx.refuse(rule, message)).map((row) => [row.id, row]));
  useCase.steps = useCase.steps.map((s) => ({ ...s, row: moved.get(s.row.id) ?? s.row }));
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
