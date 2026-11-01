// The Provision aggregate (LA-TRC-A5): what provides a record from outside the product (a provided_by link): a
// dependency, a platform or a generic subdomain, reached through an integration or named by a record of a product's
// own kind, which decides the record once for everyone who uses it. A provided record is accounted for, and a provided
// obligation built and proved, through its provider. One instance is one record's provision, whole, named by the
// record: a record has one provider at most.
import type { AggregateShape } from '../../platform/data/repository.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ProvidedByRow } from '../../platform/data/tables.ts';

/** One record's provision, whole. */
export interface Provision {
  /** The provided record's ID: the instance's root. */
  readonly root: string;
  /** The provided_by link: its source is the provided record, its target what provides it (an integration, or a record of a product's own kind). */
  providedBy: ProvidedByRow;
}

/** The tables the Provision aggregate keeps its rows in: the link. */
export const PROVISION_TABLES = ['provided_by'] as const;

/** How the aggregate's kind sits in an instance: the provided_by link. */
export const PROVISION_SHAPE = {
  provided_by: { at: 'providedBy' },
} as const satisfies AggregateShape;

/** The provisions in the data, each whole; only the given record's, when given. */
export function provisionsFrom(rows: (table: string) => Row[], only?: string): Provision[] {
  return (rows('provided_by') as unknown as ProvidedByRow[])
    .filter((l) => only === undefined || l.source_id === only)
    .map((l) => ({ root: l.source_id, providedBy: { source_id: l.source_id, target_id: l.target_id } }));
}

/** The instance's rows, by table. */
export function provisionRows(provision: Provision): Map<string, Row[]> {
  return new Map<string, Row[]>([['provided_by', [provision.providedBy as unknown as Row]]]);
}
