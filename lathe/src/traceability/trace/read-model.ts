// The Trace read model (LA-TRC-RM11), shaped for the Trace stage: each obligation of a product's space with its chain
// (what designs it, builds it and proves it, the files those name, and the links between them), the gaps coverage
// reports for it and whether only proof is asked of its kind; the records coverage reports untraced; and the Serves
// links the All-at-once view draws: the product's business outcomes, and each use case of its space with the outcomes
// its capability serves and the obligations it reaches (the Serves reach, trace/serves.ts). Chains and
// coverage are the checks' run's, not rows': the projection reads the run the query runner was given
// (`ReadView.checked`) and the rows only to place each obligation in its product, as the records' scope does (up its
// parents to a product; a record of a kind with no owner by the longest product, or domain, its ID starts with). A
// product's space holds its own records and those of no product. The projection is the only code that reads them for
// the queries and the only code that writes the read model's table; the query handler reads it only through the reader.
import type { ReadView } from '../../platform/data/rules.ts';
import { useCaseReaches } from '../../trace/serves.ts';

/** What an obligation misses, as coverage names it. */
export type TraceGap = 'designed' | 'built' | 'proved';

/** A file a build record or a test names, with the records that name it. */
export interface TracedFile {
  path: string;
  namedBy: string[];
}

/** One obligation's trace: its chain, its gaps and whether only proof is asked of it. */
export interface ObligationTrace {
  obligation: string;
  design: string[];
  build: string[];
  tests: string[];
  files: TracedFile[];
  /** The chain's links, each from the record nearer the obligation to the one it leads to: [source, target]. */
  links: [string, string][];
  /** Its gaps wherever it is owed, in the order designed, built, proved. */
  gaps: TraceGap[];
  /** Whether only proof is asked of its kind (a pattern rule): its design and build are not owed. */
  proofOnly: boolean;
}

/** A use case of a product's space with its Serves links: the outcomes its capability serves and the obligations it reaches. */
export interface UseCaseLinks {
  useCase: string;
  /** The business outcomes its capability serves, in ID order: none when it serves none. */
  outcomes: string[];
  /** The obligations of the space it reaches, in ID order. */
  reaches: string[];
}

/** A product's traces as its Trace stage reads them. */
export interface ProductTraces {
  product: string;
  /** Each obligation of its space with a chain or a gap. */
  traces: ObligationTrace[];
  /** The records coverage reports untraced: of a kind a chain reaches, and reached by none. */
  untraced: string[];
  /** The product's business outcomes, in ID order. */
  outcomes: string[];
  /** Each use case of its space, in ID order, with its Serves links. */
  useCases: UseCaseLinks[];
}

/** The read model's table, kept in memory: each product's traces, by product. */
export interface TraceTable {
  products: Map<string, ProductTraces>;
}

const GAPS: readonly TraceGap[] = ['designed', 'built', 'proved'];

const byId = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

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
export function traceTableFrom(view: ReadView): TraceTable {
  const placeOf = productPlacer(view);
  const run = view.checked;
  const reaches = useCaseReaches(view);
  const isObligation = (id: string) => !!view.schema.kinds[view.record(id)?.kind ?? '']?.obligation;
  const inSpace = (id: string, product: string) => { const at = placeOf(id); return at === product || at === null; };
  const products = new Map<string, ProductTraces>();
  for (const row of view.rows('product')) {
    const product = String(row.id);
    const coverage = (run?.coverage ?? []).filter((c) => c.product === product);
    const missing = new Map<string, Set<string>>();
    const untraced = new Set<string>();
    const proofOnly = new Set<string>();
    for (const c of coverage) {
      for (const o of c.obligations) if (o.proof_only) proofOnly.add(o.kind);
      for (const g of c.gaps) {
        if (g.missing === 'record-untraced') untraced.add(g.id);
        else if ((GAPS as readonly string[]).includes(g.missing)) missing.set(g.id, (missing.get(g.id) ?? new Set()).add(g.missing));
      }
    }
    // The space's chains, by obligation: its own obligations' and those of no product.
    const chains = new Map((run?.chains ?? []).filter((c) => { const at = placeOf(c.obligation); return at === product || at === null; }).map((c) => [c.obligation, c]));
    const obligations = [...new Set([...chains.keys(), ...missing.keys()])];
    const traces = obligations.map((obligation): ObligationTrace => {
      const chain = chains.get(obligation);
      const gaps = missing.get(obligation) ?? new Set<string>();
      return {
        obligation,
        design: [...(chain?.design ?? [])],
        build: [...(chain?.build ?? [])],
        tests: [...(chain?.tests ?? [])],
        files: (chain?.files ?? []).map((f) => ({ path: f.path, namedBy: [...f.named_by] })),
        links: (chain?.links ?? []).map(([source, target]) => [source, target]),
        gaps: GAPS.filter((g) => gaps.has(g)),
        proofOnly: proofOnly.has(view.record(obligation)?.kind ?? ''),
      };
    });
    const outcomes = view.rows('business_outcome').map((o) => String(o.id)).filter((o) => placeOf(o) === product).sort(byId);
    const useCases = [...reaches].filter(([u]) => inSpace(u, product)).sort(([a], [b]) => byId(a, b)).map(([useCase, r]): UseCaseLinks => ({
      useCase,
      outcomes: r.outcomes.filter((o) => outcomes.includes(o)),
      reaches: [...r.reached].filter((id) => isObligation(id) && inSpace(id, product)).sort(byId),
    }));
    products.set(product, { product, traces, untraced: [...untraced], outcomes, useCases });
  }
  return { products };
}
