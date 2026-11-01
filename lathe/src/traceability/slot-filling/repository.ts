// Generated from data/ by `npm run generate`. Do not edit.
// SlotFillingRepository (LA-TRC-REPO02): Loads a fill whole from the transaction's draft (its fills link) and saves
// exactly the rows that changed, in the fills table only.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { SLOT_FILLING_TABLES, slotFillingRows, slotFillingsFrom, type SlotFilling } from './model.ts';

export class SlotFillingRepository extends Repository<SlotFilling> {
  constructor(tx: Transaction) {
    super(tx, 'SlotFillingRepository', SLOT_FILLING_TABLES);
  }

  protected read(rootId: string): SlotFilling | undefined {
    return slotFillingsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(slotFilling: SlotFilling): InstanceRows {
    return slotFillingRows(slotFilling);
  }
}
