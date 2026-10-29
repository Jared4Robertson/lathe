// Change a flow (LA-AUT-CMD108): Changes a flow's title. Its interface is in its ID, so a flow through another interface is another flow.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { FlowRow } from '../../../platform/data/tables.ts';
import { USE_CASE_SLICE, useCaseChanged } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The flow's new title. */
export type ChangeFlow = Pick<FlowRow, 'id' | 'title'>;

/** Change a flow (LA-AUT-CMD108). */
export const CHANGE_FLOW: CommandDefinition<ChangeFlow> = {
  id: 'LA-AUT-CMD108',
  slice: USE_CASE_SLICE,
  name: 'change-flow',
  description: "Changes a flow's title. Its interface is in its ID, so a flow through another interface is another flow.",
  method: 'POST',
  route: '/api/use-case/change-flow',
  input: {
    id: column('flow', 'id', 'required'),
    title: column('flow', 'title', 'required'),
  },
  handler: changeFlow,
};

/** Changes the flow's title. */
export function changeFlow(tx: Transaction, input: ChangeFlow): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow', input.id) ?? tx.refuse('missing', `there is no flow ${input.id}`);
  useCase.flows = useCase.flows.map((f) => (f.id === input.id ? { ...f, title: input.title } : f));
  holdToRules(tx, useCase);
  useCases.save(useCase);
  useCaseChanged(tx, useCase);
}
