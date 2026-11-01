// Generated from data/ by `npm run generate`. Do not edit.
// InterfaceRepository (LA-AUT-REPO24): Loads an interface whole from the transaction's draft (its row, the roles that
// use it in order, and the use cases it offers) and saves exactly the rows that changed, in the Interface aggregate's
// own tables only; a write to any other table is refused when it is made (`DataFiles`). A removal is refused, naming
// the referrers, while anything outside the interface references it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { INTERFACE_TABLES, interfaceRows, interfacesFrom, type Interface } from './model.ts';

export class InterfaceRepository extends Repository<Interface> {
  constructor(tx: Transaction) {
    super(tx, 'InterfaceRepository', INTERFACE_TABLES);
  }

  protected read(rootId: string): Interface | undefined {
    return interfacesFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(theInterface: Interface): InstanceRows {
    return interfaceRows(theInterface);
  }
}
