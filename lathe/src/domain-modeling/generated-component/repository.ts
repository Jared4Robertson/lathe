// Generated from data/ by `npm run generate`. Do not edit.
// GeneratedComponentRepository (LA-MOD-REPO29): Loads a generated component whole (its row and the business outcomes it
// serves) from the transaction's draft and saves exactly the rows that changed, in its aggregate's own tables only, and
// only its own record's rows of the shared serves table; a removal is refused, naming what references it, while
// anything left references it, such as a guarantee it makes.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { GENERATED_COMPONENT_TABLES, generatedComponentRows, generatedComponentsFrom, type GeneratedComponent } from './model.ts';

export class GeneratedComponentRepository extends Repository<GeneratedComponent> {
  constructor(tx: Transaction) {
    super(tx, 'GeneratedComponentRepository', GENERATED_COMPONENT_TABLES);
  }

  protected read(rootId: string): GeneratedComponent | undefined {
    return generatedComponentsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(generatedComponent: GeneratedComponent): InstanceRows {
    return generatedComponentRows(generatedComponent);
  }
}
