// StandardRepository (LA-AUT-REPO03): loads and saves the Standard aggregate whole, in its own tables only. A rule or
// a rule test is reached through the standard that holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { kindInside, STANDARD_KINDS, STANDARD_TABLES, standardRows, standardsFrom, type Standard, type StandardKind } from './model.ts';

export class StandardRepository extends AggregateRepository<Standard> {
  constructor(tx: Transaction) {
    super(tx, 'StandardRepository', STANDARD_TABLES);
  }

  protected read(rootId: string): Standard | undefined {
    return standardsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(standard: Standard): InstanceRows {
    return standardRows(standard);
  }

  /**
   * Loads the standard that holds the record of the kind with this ID: the standard itself, or the standard of the
   * rule or rule test, found up its parents inside the aggregate. Undefined when there is no such record.
   */
  loadHolding(kind: StandardKind, id: string): Standard | undefined {
    let at: { kind: StandardKind; id: string } = { kind, id };
    for (;;) {
      const row = this.files.find(at.kind, { id: at.id });
      if (!row) return undefined;
      if (at.kind === 'standard') break;
      const column = STANDARD_KINDS[at.kind];
      at = { kind: column === 'standard_id' ? 'standard' : 'standard_rule', id: String(row[column]) };
    }
    const standard = this.load(at.id);
    return standard && kindInside(standard, id) === kind ? standard : undefined;
  }
}
