// Generated from data/ by `npm run generate`. Do not edit.
// GuaranteeRepository (LA-MOD-REPO28): Loads a guarantee whole (its guarantee tests, the building blocks that keep it,
// and the test data sets its tests start from) from the transaction's draft and saves exactly the rows that changed, in
// its aggregate's own tables only; a write to any other table is refused when it is made (`DataFiles`). A guarantee
// test is loaded through the guarantee that holds it (`loadHolding`), and a removal is refused, naming what references
// it, while anything left references it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { GUARANTEE_TABLES, guaranteeRows, guaranteesFrom, type Guarantee, type GuaranteeKind } from './model.ts';

export class GuaranteeRepository extends Repository<Guarantee> {
  constructor(tx: Transaction) {
    super(tx, 'GuaranteeRepository', GUARANTEE_TABLES);
  }

  protected read(rootId: string): Guarantee | undefined {
    return guaranteesFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(guarantee: Guarantee): InstanceRows {
    return guaranteeRows(guarantee);
  }

  /** Loads the guarantee that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: GuaranteeKind, id: string): Guarantee | undefined {
    const root = this.rootOf(kind, id);
    const guarantee = root === undefined ? undefined : this.load(root);
    return guarantee && holds(guarantee, kind, id) ? guarantee : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: GuaranteeKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'guarantee': return id;
      case 'guarantee_test': return this.rootOf('guarantee', String(row.guarantee_id));
    }
  }
}

/** Whether the guarantee holds the record of the kind with this ID. */
function holds(guarantee: Guarantee, kind: GuaranteeKind, id: string): boolean {
  switch (kind) {
    case 'guarantee': return guarantee.root === id;
    case 'guarantee_test': return guarantee.tests.some((x) => x.row.id === id);
  }
}
