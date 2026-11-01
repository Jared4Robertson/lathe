// The File facts read model (LA-TRC-RM05), shaped for its read: each product's addresses traced both ways. The
// addresses are traced once, on the load: the engine gathers the file facts, the address facts and the served
// addresses (index.ts, trace/routes.ts), the address checks word each address its files do not name, and the
// route-without-record gap rule each served address no record has. The projection reads those from the checks' run the
// query runner was given (`ReadView.checked`), placing each problem in its record's product, and traces nothing itself.
// It is the only code that reads the run for the query and the only code that writes the table.
import type { ReadView } from '../../platform/data/rules.ts';
import { inSpace, placementOf } from '../../exploring/placement.ts';

/** The checks that an operation's or view's address is named in the files of what implements it. */
const ADDRESS_CHECKS = ['endpoint-route-not-in-file', 'view-route-not-in-file'];
/** The gap rule for an address the code serves that no record has (trace/routes.ts). */
const SERVED_WITHOUT_RECORD = 'route-without-record';

/** A record whose address its files do not name, as its check words it. */
export interface UnnamedAddress {
  record: string;
  check: string;
  message: string;
}

/** A product's addresses traced both ways: those its files do not name, and those its code serves that no record has. */
export interface TracedAddresses {
  unnamed: UnnamedAddress[];
  /** Each served address with no record, as its gap words it (the file and line that serve it). */
  unrecorded: string[];
}

/** The read model's table, kept in memory: each product's traced addresses, by product. */
export interface FileFactsTable {
  products: Map<string, TracedAddresses>;
}

/** The projection: the read model's table, built from the checks' run on each read (in memory; nothing keeps it). */
export function fileFactsTableFrom(view: ReadView): FileFactsTable {
  const placed = placementOf(view);
  const problems = (view.checked?.problems ?? []).filter((p) => ADDRESS_CHECKS.includes(p.check) && p.record !== null);
  const products = new Map<string, TracedAddresses>();
  for (const row of view.rows('product')) {
    const product = String(row.id);
    products.set(product, {
      unnamed: problems.filter((p) => { const at = placed.get(p.record!); return !!at && inSpace(at, product); }).map((p) => ({ record: p.record!, check: p.check, message: p.message })),
      unrecorded: (view.checked?.coverage ?? []).filter((c) => c.product === product).flatMap((c) => c.gaps.filter((g) => g.missing === SERVED_WITHOUT_RECORD).map((g) => g.message)),
    });
  }
  return { products };
}
