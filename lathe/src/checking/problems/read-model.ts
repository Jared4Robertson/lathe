// The Problems read model (LA-CHK-RM01), shaped for the Checks panel: a product's problems by check, errors first, the
// workspace's (those of no product) by check after them, and the counts. A problem is the checks' run's, not a row's:
// the projection reads the run the query runner was given (`ReadView.checked`) and the rows only to place each
// problem's record in its product, as the records' scope does (up its parents to a product; a record of a kind with no
// owner by the longest product, or domain, its ID starts with). It is the only code that reads them for the queries and
// the only code that writes the read model's table; the query handler reads that table only through the reader.
import type { ReadView } from '../../platform/data/rules.ts';

/** One problem as the panel lists it. */
export interface ListedProblem {
  severity: 'error' | 'warning';
  /** The check that found it. */
  check: string;
  /** The record it is about, or null for one about no record. */
  record: string | null;
  message: string;
}

/** One check's problems, in the run's order: errors first, then by record. */
export interface CheckProblems {
  check: string;
  problems: ListedProblem[];
}

/** A product's problems as its Checks panel reads them. */
export interface ProductProblems {
  product: string;
  /** Its errors and warnings, the workspace's among them. */
  errors: number;
  warnings: number;
  /** Its own problems by check, in the order of each check's first problem (errors first). */
  own: CheckProblems[];
  /** The problems that belong to no product (about no record, an unknown one, or one no product holds), by check. */
  workspace: CheckProblems[];
}

/** The read model's table, kept in memory: each product's problems, by product. */
export interface ProblemsTable {
  products: Map<string, ProductProblems>;
}

/** Errors before warnings, then by check name and record. */
const problemOrder = (a: ListedProblem, b: ListedProblem) =>
  (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) ||
  a.check.localeCompare(b.check) ||
  (a.record ?? '').localeCompare(b.record ?? '', 'en', { numeric: true });

/** Problems by check, in the order of their first problem (errors first). */
function byCheck(problems: readonly ListedProblem[]): CheckProblems[] {
  const groups = new Map<string, ListedProblem[]>();
  for (const p of [...problems].sort(problemOrder)) groups.set(p.check, [...(groups.get(p.check) ?? []), p]);
  return [...groups].map(([check, listed]) => ({ check, problems: listed }));
}

/** The longest of the IDs the ID starts with (and a hyphen), or undefined. */
const longestPrefix = (ids: readonly string[], id: string) => ids.filter((p) => id.startsWith(`${p}-`)).sort((a, b) => b.length - a.length)[0];

/**
 * The product a record sits in: up its parents to a product; for a record whose topmost record has no owner, the
 * product its ID starts with (or, for a kind placed by domain, its domain's product). Null when it sits in none (a
 * parent that is no record, or no product matches), undefined when there is no such record.
 */
function productPlacer(view: ReadView): (id: string) => string | null | undefined {
  const products = view.rows('product').map((p) => String(p.id));
  const domains = new Map(view.rows('domain').map((d) => [String(d.id), String(d.product_id)]));
  const domainIds = [...domains.keys()];
  return (id) => {
    let at = view.record(id);
    if (!at) return undefined;
    let atId = id;
    const seen = new Set<string>();
    while (!seen.has(atId)) {
      seen.add(atId);
      if (at.kind === 'product') return atId;
      const kind = view.schema.kinds[at.kind];
      const row = at.row;
      const column = kind?.parents.find((p) => row[p.column] !== undefined && row[p.column] !== null && row[p.column] !== '')?.column;
      if (column === undefined) {
        if (!kind || kind.parents.length > 0) return null;
        if (kind.idScope === 'domain') {
          const domain = longestPrefix(domainIds, atId);
          return domain === undefined ? null : domains.get(domain) ?? null;
        }
        return longestPrefix(products, atId) ?? null;
      }
      const parent = String(row[column]);
      const next = view.record(parent);
      if (!next) return null;
      at = next;
      atId = parent;
    }
    return null;
  };
}

/** The projection: the read model's table, built from the checks' run and the rows on each read (in memory; nothing keeps it). */
export function problemsTableFrom(view: ReadView): ProblemsTable {
  const placeOf = productPlacer(view);
  const own = new Map<string, ListedProblem[]>();
  const workspace: ListedProblem[] = [];
  for (const p of view.checked?.problems ?? []) {
    const listed: ListedProblem = { severity: p.severity, check: p.check, record: p.record, message: p.message };
    const product = p.record === null ? null : placeOf(p.record);
    const list = product ? own.get(product) : workspace;
    if (list) list.push(listed);
    else own.set(product!, [listed]);
  }
  const shared = byCheck(workspace);
  const products = new Map<string, ProductProblems>();
  for (const row of view.rows('product')) {
    const product = String(row.id);
    const mine = own.get(product) ?? [];
    const errors = [...mine, ...workspace].filter((p) => p.severity === 'error').length;
    products.set(product, { product, errors, warnings: mine.length + workspace.length - errors, own: byCheck(mine), workspace: shared });
  }
  return { products };
}
