import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ViewTestRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { ViewRepository } from '../repository.ts';
import { CHANGE_VIEW_TEST_IDENTITY } from './identities.generated.ts';

/** The view test's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeViewTest = Pick<ViewTestRow, 'id'> & { title?: ViewTestRow['title']; level?: ViewTestRow['level']; state?: ViewTestRow['state']; when?: ViewTestRow['when']; then?: ViewTestRow['then']; file?: ViewTestRow['file'] | null; manual_reason?: ViewTestRow['manual_reason'] | null; size?: ViewTestRow['size'] | null; smoke?: ViewTestRow['smoke'] | null; external?: ViewTestRow['external'] | null; notes?: ViewTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_VIEW_TEST: CommandDefinition<ChangeViewTest> = {
  ...CHANGE_VIEW_TEST_IDENTITY,
  input: {
    id: column('view_test', 'id', 'required'),
    title: column('view_test', 'title', 'optional'),
    level: column('view_test', 'level', 'optional'),
    state: column('view_test', 'state', 'optional'),
    when: column('view_test', 'when', 'optional'),
    then: column('view_test', 'then', 'optional'),
    file: column('view_test', 'file', 'clearable'),
    manual_reason: column('view_test', 'manual_reason', 'clearable'),
    size: column('view_test', 'size', 'clearable'),
    smoke: column('view_test', 'smoke', 'clearable'),
    external: column('view_test', 'external', 'clearable'),
    notes: column('view_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeViewTest,
};

/** Changes the view test's columns and links. */
export function changeViewTest(tx: Transaction, input: ChangeViewTest): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view_test', input.id) ?? tx.refuse('missing', `there is no view test ${input.id}`);
  view.tests = view.tests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'when', 'then', 'file', 'manual_reason', 'size', 'smoke', 'external', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  views.save(view);
}
