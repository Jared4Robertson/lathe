// Generated from data/ by `npm run generate`. Do not edit.
// StandardRepository (LA-AUT-REPO03): Loads a standard whole from the transaction's draft (its rules and rule tests)
// and saves exactly the rows that changed, in the Standard aggregate's own tables only; a write to any other table is
// refused when it is made (`DataFiles`). A rule or rule test is loaded through the standard that holds it
// (`loadHolding`), and a removal is refused, naming the referrers, while anything outside references what goes.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { STANDARD_TABLES, standardRows, standardsFrom, type Standard, type StandardKind } from './model.ts';

export class StandardRepository extends Repository<Standard> {
  constructor(tx: Transaction) {
    super(tx, 'StandardRepository', STANDARD_TABLES);
  }

  protected read(rootId: string): Standard | undefined {
    return standardsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(standard: Standard): InstanceRows {
    return standardRows(standard);
  }

  /** Loads the standard that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: StandardKind, id: string): Standard | undefined {
    const root = this.rootOf(kind, id);
    const standard = root === undefined ? undefined : this.load(root);
    return standard && holds(standard, kind, id) ? standard : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: StandardKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'standard': return id;
      case 'standard_rule': return this.rootOf('standard', String(row.standard_id));
      case 'standard_rule_test': return this.rootOf('standard_rule', String(row.standard_rule_id));
    }
  }
}

/** Whether the standard holds the record of the kind with this ID. */
function holds(standard: Standard, kind: StandardKind, id: string): boolean {
  switch (kind) {
    case 'standard': return standard.root === id;
    case 'standard_rule': return standard.rules.some((x) => x.id === id);
    case 'standard_rule_test': return standard.ruleTests.some((x) => x.row.id === id);
  }
}
