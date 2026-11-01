// The Slot filling aggregate (LA-TRC-A4): a technical record, written by hand, that fills a slot of a pattern (a fills
// link): a fill, accidental complexity recorded at the slot it is owed to. One instance is one fill, whole, named by
// its record and its slot.
import type { Row } from '../../platform/data/rows.ts';

/** One fill, whole. */
export interface SlotFilling {
  /** The record and the slot, as "<record> fills <slot>": the instance's root. */
  readonly root: string;
  /** The technical record that fills the slot. */
  record: string;
  slot: string;
}

/** The tables the Slot filling aggregate keeps its rows in: the link. */
export const SLOT_FILLING_TABLES = ['fills'] as const;

/** The root of the fill of the slot by the record. */
export const fillingOf = (record: string, slot: string): string => `${record} fills ${slot}`;

/** The fills in the data, each whole; only the one whose root is given, when given. */
export function fillingsFrom(rows: (table: string) => Row[], only?: string): SlotFilling[] {
  return rows('fills')
    .map((l) => ({ record: String(l.source_id), slot: String(l.target_id) }))
    .map((f) => ({ root: fillingOf(f.record, f.slot), ...f }))
    .filter((f) => only === undefined || f.root === only);
}

/** The instance's rows, by table. */
export function fillingRows(filling: SlotFilling): Map<string, Row[]> {
  return new Map<string, Row[]>([['fills', [{ source_id: filling.record, target_id: filling.slot }]]]);
}
