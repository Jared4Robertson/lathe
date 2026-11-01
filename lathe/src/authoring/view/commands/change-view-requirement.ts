import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ViewRequirementRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { ViewRepository } from '../repository.ts';
import { CHANGE_VIEW_REQUIREMENT_IDENTITY } from './identities.generated.ts';

/** The view requirement's changes: a column given is set, null clears an optional one. */
export type ChangeViewRequirement = Pick<ViewRequirementRow, 'id'> & { title?: ViewRequirementRow['title']; statement?: ViewRequirementRow['statement']; group_name?: ViewRequirementRow['group_name'] | null };

export const CHANGE_VIEW_REQUIREMENT: CommandDefinition<ChangeViewRequirement> = {
  ...CHANGE_VIEW_REQUIREMENT_IDENTITY,
  input: {
    id: column('view_requirement', 'id', 'required'),
    title: column('view_requirement', 'title', 'optional'),
    statement: column('view_requirement', 'statement', 'optional'),
    group_name: column('view_requirement', 'group_name', 'clearable'),
  },
  handler: changeViewRequirement,
};

/** Changes the view requirement's columns. */
export function changeViewRequirement(tx: Transaction, input: ChangeViewRequirement): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view_requirement', input.id) ?? tx.refuse('missing', `there is no view requirement ${input.id}`);
  view.requirements = view.requirements.map((x) => (x.id === input.id ? changed(x, input, ['title', 'statement', 'group_name']) : x));
  views.save(view);
}
