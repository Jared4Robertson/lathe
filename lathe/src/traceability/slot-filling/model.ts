// The Slot filling aggregate (LA-TRC-A4): a technical record, written by hand, that fills a slot of a pattern (a fills
// link): a fill, accidental complexity recorded at the slot it is owed to. One instance is one fill, whole, named by
// its record and its slot.
import type { AggregateShape } from '../../platform/data/repository.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { FillsRow } from '../../platform/data/tables.ts';

/** One fill, whole. */
export interface SlotFilling {
  /** The record and the slot, as "<record> fills <slot>": the instance's root. */
  readonly root: string;
  /** The fills link: its source is the technical record that fills the slot, its target the slot. */
  fills: FillsRow;
}

/** The tables the Slot filling aggregate keeps its rows in: the link. */
export const SLOT_FILLING_TABLES = ['fills'] as const;

/** How the aggregate's kind sits in an instance: the fills link. */
export const SLOT_FILLING_SHAPE = {
  fills: { at: 'fills' },
} as const satisfies AggregateShape;

/** The root of the fill of the slot by the record. */
export const fillingOf = (record: string, slot: string): string => `${record} fills ${slot}`;

/** The fills in the data, each whole; only the one whose root is given, when given. */
export function slotFillingsFrom(rows: (table: string) => Row[], only?: string): SlotFilling[] {
  return (rows('fills') as unknown as FillsRow[])
    .map((l) => ({ root: fillingOf(l.source_id, l.target_id), fills: { source_id: l.source_id, target_id: l.target_id } }))
    .filter((f) => only === undefined || f.root === only);
}

/** The instance's rows, by table. */
export function slotFillingRows(filling: SlotFilling): Map<string, Row[]> {
  return new Map<string, Row[]>([['fills', [filling.fills as unknown as Row]]]);
}
