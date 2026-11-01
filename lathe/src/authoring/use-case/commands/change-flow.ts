import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { FlowRow } from '../../../platform/data/tables.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_FLOW_IDENTITY } from './identities.generated.ts';

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

/** Changes the flow's title. */
export function changeFlow(tx: Transaction, input: ChangeFlow): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow', input.id) ?? tx.refuse('missing', `there is no flow ${input.id}`);
  useCase.flows = useCase.flows.map((f) => (f.id === input.id ? { ...f, title: input.title } : f));
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
