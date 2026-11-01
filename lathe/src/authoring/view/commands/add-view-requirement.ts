import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ViewRequirementRow } from '../../../platform/data/tables.ts';
import { ViewRepository } from '../repository.ts';
import { ADD_VIEW_REQUIREMENT_IDENTITY } from './identities.generated.ts';

/** A new view requirement. */
export type AddViewRequirement = Pick<ViewRequirementRow, 'id' | 'title' | 'view_id' | 'statement' | 'group_name'>;

export const ADD_VIEW_REQUIREMENT = {
  ...ADD_VIEW_REQUIREMENT_IDENTITY,
  input: {
    id: column('view_requirement', 'id', 'required'),
    title: column('view_requirement', 'title', 'required'),
    view_id: column('view_requirement', 'view_id', 'required'),
    statement: column('view_requirement', 'statement', 'required'),
    group_name: column('view_requirement', 'group_name', 'optional'),
  },
  handler: addViewRequirement,
} satisfies CommandDefinition<AddViewRequirement>;

export function addViewRequirement(tx: Transaction, input: AddViewRequirement): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view', input.view_id) ?? tx.refuse('missing', `there is no view ${input.view_id}`);
  view.requirements.push(input);
  views.save(view);
}
