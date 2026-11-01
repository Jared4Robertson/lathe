// Generated from data/ by `npm run generate`. Do not edit.
// UiComponentRepository (LA-AUT-REPO15): Loads a UI component whole from the transaction's draft (the views it renders,
// the standard rules it meets and the packages it uses) and saves exactly the rows that changed, in the UI component
// aggregate's own tables only; a write to any other table is refused when it is made.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { UI_COMPONENT_TABLES, uiComponentRows, uiComponentsFrom, type UiComponent } from './model.ts';

export class UiComponentRepository extends Repository<UiComponent> {
  constructor(tx: Transaction) {
    super(tx, 'UiComponentRepository', UI_COMPONENT_TABLES);
  }

  protected read(rootId: string): UiComponent | undefined {
    return uiComponentsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(uiComponent: UiComponent): InstanceRows {
    return uiComponentRows(uiComponent);
  }
}
