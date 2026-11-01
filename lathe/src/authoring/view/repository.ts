// Generated from data/ by `npm run generate`. Do not edit.
// ViewRepository (LA-AUT-REPO12): Loads a view whole from the transaction's draft (its view requirements and their view
// tests, with the test data sets each starts from) and saves exactly the rows that changed, in the View aggregate's own
// tables only; a write to any other table is refused when it is made.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { VIEW_TABLES, viewRows, viewsFrom, type View, type ViewKind } from './model.ts';

export class ViewRepository extends Repository<View> {
  constructor(tx: Transaction) {
    super(tx, 'ViewRepository', VIEW_TABLES);
  }

  protected read(rootId: string): View | undefined {
    return viewsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(view: View): InstanceRows {
    return viewRows(view);
  }

  /** Loads the view that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: ViewKind, id: string): View | undefined {
    const root = this.rootOf(kind, id);
    const view = root === undefined ? undefined : this.load(root);
    return view && holds(view, kind, id) ? view : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: ViewKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'view': return id;
      case 'view_requirement': return this.rootOf('view', String(row.view_id));
      case 'view_test': return this.rootOf('view_requirement', String(row.view_requirement_id));
    }
  }
}

/** Whether the view holds the record of the kind with this ID. */
function holds(view: View, kind: ViewKind, id: string): boolean {
  switch (kind) {
    case 'view': return view.root === id;
    case 'view_requirement': return view.requirements.some((x) => x.id === id);
    case 'view_test': return view.tests.some((x) => x.row.id === id);
  }
}
