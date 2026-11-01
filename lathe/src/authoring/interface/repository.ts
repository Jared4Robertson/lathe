// InterfaceRepository (LA-AUT-REPO24): loads and saves the Interface aggregate whole, in its own tables only.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { INTERFACE_TABLES, interfaceRows, interfacesFrom, type Interface } from './model.ts';

export class InterfaceRepository extends AggregateRepository<Interface> {
  constructor(tx: Transaction) {
    super(tx, 'InterfaceRepository', INTERFACE_TABLES);
  }

  protected read(rootId: string): Interface | undefined {
    return interfacesFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(iface: Interface): InstanceRows {
    return interfaceRows(iface);
  }
}
