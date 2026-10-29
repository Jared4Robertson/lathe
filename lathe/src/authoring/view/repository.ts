// ViewRepository (LA-AUT-REPO12): loads and saves the View aggregate whole, in its own tables only. A view requirement
// or a view test is reached through the view that holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { kindInside, VIEW_TABLES, viewRows, viewsFrom, type View, type ViewKind } from './model.ts';

export class ViewRepository extends AggregateRepository<View> {
  constructor(tx: Transaction) {
    super(tx, 'ViewRepository', VIEW_TABLES);
  }

  protected read(rootId: string): View | undefined {
    return viewsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(view: View): InstanceRows {
    return viewRows(view);
  }

  /**
   * Loads the view that holds the record of the kind with this ID: the view itself, or the view of the requirement or
   * test, found up its parents. Undefined when there is no such record.
   */
  loadHolding(kind: ViewKind, id: string): View | undefined {
    let at: { kind: ViewKind; id: string } = { kind, id };
    while (at.kind !== 'view') {
      const row = this.files.find(at.kind, { id: at.id });
      if (!row) return undefined;
      at = at.kind === 'view_test' ? { kind: 'view_requirement', id: String(row.view_requirement_id) } : { kind: 'view', id: String(row.view_id) };
    }
    const view = this.load(at.id);
    return view && kindInside(view, id) === kind ? view : undefined;
  }
}
