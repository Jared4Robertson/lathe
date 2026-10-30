// StorageRequirementRepository (LA-AUT-REPO22): loads and saves the Storage requirement aggregate whole, in its own
// tables only. A storage requirement test is reached through the storage requirement that holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import {
  kindInside,
  STORAGE_REQUIREMENT_KINDS,
  STORAGE_REQUIREMENT_TABLES,
  storageRequirementRows,
  storageRequirementsFrom,
  type StorageRequirement,
  type StorageRequirementKind,
} from './model.ts';

export class StorageRequirementRepository extends AggregateRepository<StorageRequirement> {
  constructor(tx: Transaction) {
    super(tx, 'StorageRequirementRepository', STORAGE_REQUIREMENT_TABLES);
  }

  protected read(rootId: string): StorageRequirement | undefined {
    return storageRequirementsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(requirement: StorageRequirement): InstanceRows {
    return storageRequirementRows(requirement);
  }

  /**
   * Loads the storage requirement that holds the record of the kind with this ID: the requirement itself, or the one a
   * storage requirement test sits under. Undefined when there is no such record.
   */
  loadHolding(kind: StorageRequirementKind, id: string): StorageRequirement | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    const column = STORAGE_REQUIREMENT_KINDS[kind];
    const requirement = this.load(column === null ? id : String(row[column]));
    return requirement && kindInside(requirement, id) === kind ? requirement : undefined;
  }
}
