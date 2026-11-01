// SlotFillingRepository (LA-TRC-REPO02): loads and saves the Slot filling aggregate whole (the fills link) in its own
// table only.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { fillingOf, fillingRows, fillingsFrom, SLOT_FILLING_TABLES, type SlotFilling } from './model.ts';

export class SlotFillingRepository extends AggregateRepository<SlotFilling> {
  constructor(tx: Transaction) {
    super(tx, 'SlotFillingRepository', SLOT_FILLING_TABLES);
  }

  protected read(root: string): SlotFilling | undefined {
    return fillingsFrom((table) => this.files.rows(table), root)[0];
  }

  protected rowsOf(filling: SlotFilling): InstanceRows {
    return fillingRows(filling);
  }

  /** Loads the fill of the slot by the record, or undefined when the record does not fill it. */
  loadFilling(record: string, slot: string): SlotFilling | undefined {
    return this.load(fillingOf(record, slot));
  }
}
