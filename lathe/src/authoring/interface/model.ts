// The Interface aggregate (LA-AUT-A24): a way a product is used, such as an app a person works in, calls other
// programs make, or a command line, with the roles of its product that use it, in order, and the use cases it offers.
// One instance is one interface, whole; it holds only the links its own records start. The patterns it follows, and
// the values it gives their settings, are Pattern following's (LA-TRC-A3).
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { AggregateShape } from '../../platform/data/repository.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { InterfaceRow } from '../../platform/data/tables.ts';

/** One interface, whole. */
export interface Interface {
  /** The interface's ID: the aggregate's root. */
  readonly root: string;
  row: InterfaceRow;
  /** The roles of its product that use it, in order. */
  actors: string[];
  /** The use cases it offers, by ID. */
  offers: string[];
}

/** The tables the Interface aggregate keeps its rows in: its kinds, and the relation it starts. */
export const INTERFACE_TABLES = ['interface', 'interface_actor', 'offers'] as const;

/** How the aggregate's kind sits in an instance: the interface's row, its roles in order and the use cases it offers. Its repository is generated from it. @public (read by `npm run generate`) */
export const INTERFACE_SHAPE = {
  interface: { at: 'row', lists: { actors: 'actors', offers: 'offers' } },
} as const satisfies AggregateShape;

/** The interfaces in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function interfacesFrom(rows: (table: string) => Row[], only?: string): Interface[] {
  const interfaces = rows('interface').filter((r) => only === undefined || r.id === only) as unknown as InterfaceRow[];
  if (!interfaces.length) return [];
  const actorsOf = groupBy(rows('interface_actor'), (a) => a.interface_id);
  const offers = bySource(rows('offers'));
  return interfaces.map((row) => ({
    root: row.id,
    row,
    actors: [...groupOf(actorsOf, row.id)].sort((a, b) => Number(a.position) - Number(b.position)).map((a) => String(a.role_name)),
    offers: groupOf(offers, row.id),
  }));
}

/** The instance's rows, by table. */
export function interfaceRows(iface: Interface): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['interface', [iface.row as unknown as Row]],
    ['interface_actor', iface.actors.map((role, at) => ({ interface_id: iface.root, position: at + 1, role_name: role }))],
    ['offers', iface.offers.map((target) => ({ source_id: iface.root, target_id: target }))],
  ]);
}
