// Add a view test (LA-AUT-CMD316): Adds a view test under its view requirement, with the test data sets it starts from.
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ViewTestRow } from '../../../platform/data/tables.ts';
import { VIEW_SLICE } from '../model.ts';
import { ViewRepository } from '../repository.ts';

/** A new view test, with the links it starts. */
export type AddViewTest = Pick<ViewTestRow, 'id' | 'title' | 'view_requirement_id' | 'level' | 'state' | 'when' | 'then' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'notes'> & { starts_from?: string[] };

/** Add a view test (LA-AUT-CMD316). */
export const ADD_VIEW_TEST: CommandDefinition<AddViewTest> = {
  id: 'LA-AUT-CMD316',
  slice: VIEW_SLICE,
  name: 'add-view-test',
  description: 'Adds a view test under its view requirement, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/view/add-view-test',
  input: {
    id: column('view_test', 'id', 'required'),
    title: column('view_test', 'title', 'required'),
    view_requirement_id: column('view_test', 'view_requirement_id', 'required'),
    level: column('view_test', 'level', 'required'),
    state: column('view_test', 'state', 'required'),
    when: column('view_test', 'when', 'required'),
    then: column('view_test', 'then', 'required'),
    file: column('view_test', 'file', 'optional'),
    manual_reason: column('view_test', 'manual_reason', 'optional'),
    size: column('view_test', 'size', 'optional'),
    smoke: column('view_test', 'smoke', 'optional'),
    external: column('view_test', 'external', 'optional'),
    notes: column('view_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addViewTest,
};

/** Adds the view test under its view requirement, with its links. */
export function addViewTest(tx: Transaction, input: AddViewTest): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view_requirement', input.view_requirement_id) ?? tx.refuse('missing', `there is no view requirement ${input.view_requirement_id}`);
  const { starts_from = [], ...row } = input;
  view.tests.push({ row, startsFrom: starts_from });
  views.save(view);
}
