// Add a view requirement (LA-AUT-CMD313): Adds a view requirement under its view: one rule the view must follow.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ViewRequirementRow } from '../../../platform/data/tables.ts';
import { VIEW_SLICE } from '../model.ts';
import { ViewRepository } from '../repository.ts';

/** A new view requirement. */
export type AddViewRequirement = Pick<ViewRequirementRow, 'id' | 'title' | 'view_id' | 'statement' | 'group_name'>;

/** Add a view requirement (LA-AUT-CMD313). */
export const ADD_VIEW_REQUIREMENT: CommandDefinition<AddViewRequirement> = {
  id: 'LA-AUT-CMD313',
  slice: VIEW_SLICE,
  name: 'add-view-requirement',
  description: 'Adds a view requirement under its view: one rule the view must follow.',
  method: 'POST',
  route: '/api/view/add-view-requirement',
  input: {
    id: column('view_requirement', 'id', 'required'),
    title: column('view_requirement', 'title', 'required'),
    view_id: column('view_requirement', 'view_id', 'required'),
    statement: column('view_requirement', 'statement', 'required'),
    group_name: column('view_requirement', 'group_name', 'optional'),
  },
  handler: addViewRequirement,
};

/** Adds the view requirement under its view. */
export function addViewRequirement(tx: Transaction, input: AddViewRequirement): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view', input.view_id) ?? tx.refuse('missing', `there is no view ${input.view_id}`);
  view.requirements.push(input);
  views.save(view);
}
