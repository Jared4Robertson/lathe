// The Provision aggregate (LA-TRC-A5): what provides a record from outside the product (a provided_by link): a
// dependency, a platform or a generic subdomain, reached through an integration or named by a record of a product's
// own kind, which decides the record once for everyone who uses it. A provided record is accounted for, and a provided
// obligation built and proved, through its provider. One instance is one record's provision, whole, named by the
// record: a record has one provider at most.
import type { Row } from '../../platform/data/rows.ts';

/** One record's provision, whole. */
export interface Provision {
  /** The provided record's ID: the instance's root. */
  readonly root: string;
  /** What provides it: an integration, or a record of a product's own kind. */
  provider: string;
}

/** The tables the Provision aggregate keeps its rows in: the link. */
export const PROVISION_TABLES = ['provided_by'] as const;

/** The provisions in the data, each whole; only the given record's, when given. */
export function provisionsFrom(rows: (table: string) => Row[], only?: string): Provision[] {
  return rows('provided_by')
    .filter((l) => only === undefined || l.source_id === only)
    .map((l) => ({ root: String(l.source_id), provider: String(l.target_id) }));
}

/** The instance's rows, by table. */
export function provisionRows(provision: Provision): Map<string, Row[]> {
  return new Map<string, Row[]>([['provided_by', [{ source_id: provision.root, target_id: provision.provider }]]]);
}
