// UiComponentRepository (LA-AUT-REPO15): loads and saves the UI component aggregate whole, in its own tables only.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { UI_COMPONENT_TABLES, uiComponentRows, uiComponentsFrom, type UiComponent } from './model.ts';

export class UiComponentRepository extends AggregateRepository<UiComponent> {
  constructor(tx: Transaction) {
    super(tx, 'UiComponentRepository', UI_COMPONENT_TABLES);
  }

  protected read(rootId: string): UiComponent | undefined {
    return uiComponentsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(component: UiComponent): InstanceRows {
    return uiComponentRows(component);
  }
}
