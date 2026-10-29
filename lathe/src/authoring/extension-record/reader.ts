// The Extension record reader: the interface the Extension record aggregate's query handlers depend on to read the
// Extension record read model (LA-AUT-RM39) and the kinds the products declare, and today's implementation over the
// current data, built by the read model's projection. A handler reads through it only, never the aggregate's model or
// repository.
import type { ReadView } from '../../platform/data/rules.ts';
import type { KindDescription } from '../../platform/data/schema.ts';
import { domainOf, productKinds, productOf } from './declaration.ts';
import { extensionRecordPagesFrom, extensionRecordSummariesFrom, type ExtensionRecordPage, type ExtensionRecordSummary } from './read-model.ts';

/** What the Extension record queries read. */
export interface ExtensionRecordReader {
  /** The kind of the record with this ID, or undefined when there is none. */
  kindOf(id: string): string | undefined;
  /** The kinds the products declare, by name. */
  productKinds(): KindDescription[];
  /** The page of the record with this ID. */
  page(id: string): ExtensionRecordPage;
  /** The records of the product kind under the parent, by ID. */
  list(kind: string, parent: string): ExtensionRecordSummary[];
  /** The product the record sits in, or null. */
  productOf(id: string): string | null;
  /** The domain the record sits in, or undefined. */
  domainOf(id: string): string | undefined;
  /** Every record ID in use, of any kind. */
  ids(): string[];
}

/** The reader over the current data. */
export function extensionRecordReader(view: ReadView): ExtensionRecordReader {
  return {
    kindOf: (id) => view.record(id)?.kind,
    productKinds: () => productKinds(view.schema),
    page: (id) => extensionRecordPagesFrom(view, id)[0],
    list: (kind, parent) => extensionRecordSummariesFrom(view, kind, parent),
    productOf: (id) => productOf(view, id),
    domainOf: (id) => domainOf(view, id),
    ids: () => Object.keys(view.schema.kinds).flatMap((kind) => view.rows(kind).map((r) => String(r.id))),
  };
}
