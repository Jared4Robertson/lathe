// Generated from data/ by `npm run generate`. Do not edit.
// StorageRequirementRepository (LA-MOD-REPO22): Loads a storage requirement whole (its storage requirement tests and
// the test data sets they start from) from the transaction's draft and saves exactly the rows that changed, in its
// aggregate's own tables only; a test is loaded through the requirement that holds it (`loadHolding`), and a removal is
// refused, naming what references it, while anything left references it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { STORAGE_REQUIREMENT_TABLES, storageRequirementRows, storageRequirementsFrom, type StorageRequirement, type StorageRequirementKind } from './model.ts';

export class StorageRequirementRepository extends Repository<StorageRequirement> {
  constructor(tx: Transaction) {
    super(tx, 'StorageRequirementRepository', STORAGE_REQUIREMENT_TABLES);
  }

  protected read(rootId: string): StorageRequirement | undefined {
    return storageRequirementsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(storageRequirement: StorageRequirement): InstanceRows {
    return storageRequirementRows(storageRequirement);
  }

  /** Loads the storage requirement that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: StorageRequirementKind, id: string): StorageRequirement | undefined {
    const root = this.rootOf(kind, id);
    const storageRequirement = root === undefined ? undefined : this.load(root);
    return storageRequirement && holds(storageRequirement, kind, id) ? storageRequirement : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: StorageRequirementKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'storage_requirement': return id;
      case 'storage_requirement_test': return this.rootOf('storage_requirement', String(row.storage_requirement_id));
    }
  }
}

/** Whether the storage requirement holds the record of the kind with this ID. */
function holds(storageRequirement: StorageRequirement, kind: StorageRequirementKind, id: string): boolean {
  switch (kind) {
    case 'storage_requirement': return storageRequirement.root === id;
    case 'storage_requirement_test': return storageRequirement.tests.some((x) => x.row.id === id);
  }
}
