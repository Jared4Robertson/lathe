// How a kind's IDs are written, read from the schema (meta_kind.id_pattern, the kind's parents and its id_scope) so the
// next-id queries of the aggregates do not repeat it: the kinds a record may sit under, the letters its ID ends in and
// how many digits follow them.
import type { SchemaDescription } from './schema.ts';

/** What a kind's ID pattern says about the end of its IDs. */
export interface IdShape {
  /** The kinds a record of the kind may sit under. */
  parents: string[];
  /** The letters its ID ends in after its parent's, such as R in <view>-R<nn>. */
  letters: string;
  /** The digits after the letters, zero when the ID is the letters alone (<command>-H). */
  width: number;
}

/** The end of an ID pattern: letters and a number (RP<nn>), letters alone (H), or null when the end is a name. The last alternative counts: the table's ID is <entity or read model>-TB, or <domain>-TB<nn>. */
export function idEnd(pattern: string): { letters: string; width: number } | null {
  const last = pattern.trim().split(/,? or /).pop()!;
  const m = /-([A-Z]+)(?:<(n+)>)?$/.exec(last);
  return m ? { letters: m[1], width: m[2]?.length ?? 0 } : null;
}

/** The shape of a kind's IDs, from its pattern, its parents and the scope its IDs start with. */
export function idShapeOf(schema: SchemaDescription, kind: string): IdShape {
  const described = schema.kinds[kind];
  if (!described) throw new Error(`There is no kind ${kind}.`);
  const end = described.idPattern && idEnd(described.idPattern);
  if (!end) throw new Error(`The kind ${kind} has no ID that ends in letters.`);
  const parents = described.parents.length ? described.parents.map((p) => p.kind) : described.idScope === 'product' || described.idScope === 'domain' ? [described.idScope] : [];
  return { parents, ...end };
}

/** One past the highest number in use after the prefix, written with the shape's digits. */
export function onePast(reader: { highestAfter(prefix: string): number }, prefix: string, shape: Pick<IdShape, 'width'>): string {
  return `${prefix}${String(reader.highestAfter(prefix) + 1).padStart(shape.width, '0')}`;
}
