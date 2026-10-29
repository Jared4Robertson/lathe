import { byIdOrder, type SpecIndex } from '../specs/data';
import { obligationsUnder } from './chain';
import { isObligation } from './offer';

// The top of the Trace stage's tree (LA-V98-R03), kept apart so it can be reshaped without touching the layout, the
// chains, the walk or the painting (tree.ts builds everything below it): what sits under the product, under each
// business outcome and under each domain.
//
// - The product holds its business outcomes first, then its domains in the record tree's order, then the parents of its
//   own obligations (a product pattern, a standard, anything outside every domain), then the Untraced mark when coverage
//   reports any record untraced (tree.ts fills it).
// - An outcome holds a link to each capability that serves it: a box that focuses the real capability in its domain.
// - A domain holds the parents of its own obligations side by side: its capabilities, aggregates, views, endpoints and
//   patterns, then any other record an obligation hangs from, then an obligation right under the domain itself, each kind
//   in the record tree's order.
// Every node is a real record, a link or the Untraced mark: there are no folders.

/** The Untraced mark's key: last under the product, holding every record no chain reaches. */
export const UNTRACED = 'untraced';
/** A link box's key: the outcome it sits under and the capability it leads to. */
export const linkKey = (outcome: string, capability: string) => `link:${outcome}:${capability}`;
/** The capability a link box leads to, or null for any other key. */
export const linkTarget = (key: string): string | null => (key.startsWith('link:') ? key.slice(key.indexOf(':', 5) + 1) : null);

const STRUCTURE: ReadonlySet<string> = new Set(['product', 'domain']);
/** The parents' kinds first under a domain or the product, in this order; any other after them. */
const PARENT_KINDS = ['capability', 'aggregate', 'view', 'endpoint', 'pattern'];

/** An obligation's records from the top parent under its owner down to itself, and its owner (its domain, else its product). */
export function pathOf(index: SpecIndex, obligation: string): { owner: string | null; path: string[] } {
  const record = index.byId.get(obligation);
  if (!record) return { owner: null, path: [] };
  const owner = record.domain ?? record.product;
  const path = [obligation];
  const seen = new Set(path);
  for (let up = record.parent ? index.byId.get(record.parent) : undefined; up && up.id !== owner && !STRUCTURE.has(up.kind) && !seen.has(up.id); up = up.parent ? index.byId.get(up.parent) : undefined) {
    path.unshift(up.id);
    seen.add(up.id);
  }
  return { owner, path };
}

/** The capabilities that serve an outcome, in ID order. */
const servedBy = (index: SpecIndex, outcome: string) => (index.incoming.get(outcome) ?? [])
  .filter((l) => l.relation === 'serves' && index.byId.get(l.source)?.kind === 'capability')
  .map((l) => l.source)
  .sort((a, b) => byIdOrder({ id: a }, { id: b }));

/**
 * The top of a product's Trace tree: the children of the product, of each outcome and of each domain, by key. `untraced`
 * says whether the product has records no chain reaches, for the Untraced mark.
 */
export function traceTop(index: SpecIndex, product: string, untraced: boolean): Map<string, string[]> {
  const top = new Map<string, string[]>();
  const outcomes = index.workspace.records
    .filter((r) => r.kind === 'business_outcome' && r.product === product)
    .map((r) => r.id)
    .sort((a, b) => byIdOrder({ id: a }, { id: b }));
  for (const o of outcomes) top.set(o, servedBy(index, o).map((c) => linkKey(o, c)));

  const domains = (index.domainsOf.get(product) ?? []).map((d) => d.id);
  const under = new Map<string, string[]>([[product, []], ...domains.map((d) => [d, []] as [string, string[]])]);
  for (const o of obligationsUnder(index, product)) {
    const { owner, path } = pathOf(index, o);
    const list = owner === null ? undefined : under.get(owner);
    if (list && path.length > 0 && !list.includes(path[0])) list.push(path[0]);
  }
  /** A parent's rank: its kind's among PARENT_KINDS, then any other parent, then an obligation standing there itself. */
  const rank = (id: string) => {
    const kind = index.byId.get(id)?.kind ?? '';
    const at = PARENT_KINDS.indexOf(kind);
    return at >= 0 ? at : isObligation(index, id) ? PARENT_KINDS.length + 1 : PARENT_KINDS.length;
  };
  const ranked = (ids: readonly string[]) => ids.map((id, i) => ({ id, i, r: rank(id) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.id);
  for (const d of domains) top.set(d, ranked(under.get(d)!));
  top.set(product, [...outcomes, ...domains, ...ranked(under.get(product)!), ...(untraced ? [UNTRACED] : [])]);
  return top;
}
