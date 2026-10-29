import { byIdOrder, type SpecIndex } from '../specs/data';
import { obligationsUnder } from './chain';
import { isObligation } from './offer';

// The top of the Trace stage's tree (LA-V98-R03), kept apart so it can be reshaped without touching the layout, the
// chains, the walk or the painting (tree.ts builds each obligation's chain below it): the records from the product down to
// each obligation, so that each trace reads left to right from a business outcome to its tests.
//
// - The product holds its business outcomes in ID order, then the Not under an outcome branch, then the Untraced mark
//   when coverage reports any record untraced (tree.ts fills it).
// - An outcome holds the use cases of every capability that serves it, in the record tree's order, and below each the
//   record tree down to its obligations. The capability is not drawn: it is named on its use case's kind line (tree.ts).
//   A use case whose capability serves several outcomes is repeated under each, with everything under it.
// - Not under an outcome holds every obligation no outcome reaches (an invariant, a view requirement, a specification, a
//   domain service, a use case whose capability serves nothing), grouped by domain in the record tree's order, then the
//   parents of the product's own obligations (a product pattern, anything outside every domain) last. A domain holds its
//   obligations' parents side by side (use cases, aggregates, views, endpoints, patterns, then any other record an
//   obligation hangs from, then an obligation right under the domain itself), each kind in the record tree's order.
// Every node is a real record, the Not under an outcome branch or the Untraced mark: there are no folders.
//
// Keys: under an outcome a record's key is `<outcome>|<id>`, as a record may sit under several; under Not under an
// outcome, where each sits once, its ID.

/** The Untraced mark's key: last under the product, holding every record no chain reaches. */
export const UNTRACED = 'untraced';
/** The Not under an outcome branch's key: after the outcomes, holding every obligation no outcome reaches. */
export const OUTSIDE = 'outside';

const STRUCTURE: ReadonlySet<string> = new Set(['product', 'domain']);
/** The parents' kinds first under a domain or the product, in this order; any other after them. */
const PARENT_KINDS = ['use_case', 'aggregate', 'view', 'endpoint', 'pattern'];

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

/** The outcomes a capability serves, in ID order. */
const servesOf = (index: SpecIndex, capability: string) => (index.outgoing.get(capability) ?? [])
  .filter((l) => l.relation === 'serves' && index.byId.get(l.target)?.kind === 'business_outcome')
  .map((l) => l.target)
  .sort((a, b) => byIdOrder({ id: a }, { id: b }));

/** The top of a product's Trace tree, from the product down to each obligation. */
export interface TraceTop {
  /** Each key's children, in order. */
  children: Map<string, string[]>;
  /** The record each key stands for (every key but the branch's and the mark's). */
  ids: Map<string, string>;
  /** Each place an obligation sits, in the tree's order: its key and its ID. */
  obligations: { key: string; id: string }[];
  /** How many obligations sit under Not under an outcome. */
  outside: number;
}

/** A product's Trace tree from the product down to each obligation. `untraced` says whether to end with the Untraced mark. */
export function traceTop(index: SpecIndex, product: string, untraced: boolean): TraceTop {
  const children = new Map<string, string[]>();
  const ids = new Map<string, string>([[product, product]]);
  const obligations: { key: string; id: string }[] = [];
  const add = (parent: string, child: string) => { const list = children.get(parent); if (list) { if (!list.includes(child)) list.push(child); } else children.set(parent, [child]); };
  const outcomes = index.workspace.records
    .filter((r) => r.kind === 'business_outcome' && r.product === product)
    .map((r) => r.id)
    .sort((a, b) => byIdOrder({ id: a }, { id: b }));
  for (const o of outcomes) { ids.set(o, o); children.set(o, []); }

  // Not under an outcome: each owner's (a domain's, the product's) obligations and their parents, by ID.
  const domains = (index.domainsOf.get(product) ?? []).map((d) => d.id);
  const owned = new Map<string, string[]>([...domains.map((d) => [d, []] as [string, string[]]), [product, []]]);
  let outside = 0;
  for (const o of obligationsUnder(index, product)) {
    const { owner, path } = pathOf(index, o);
    const capability = path.find((id) => index.byId.get(id)?.kind === 'capability');
    const trail = path.filter((id) => id !== capability);
    if (owner === null || trail.length === 0) continue;
    const served = capability ? servesOf(index, capability).filter((b) => outcomes.includes(b)) : [];
    if (served.length > 0) {
      for (const outcome of served) {
        let parent = outcome;
        for (const id of trail) { const key = `${outcome}|${id}`; add(parent, key); ids.set(key, id); parent = key; }
        obligations.push({ key: parent, id: o });
      }
      continue;
    }
    const list = owned.get(owner);
    if (!list) continue;
    if (!list.includes(trail[0])) list.push(trail[0]);
    for (let i = 1; i < trail.length; i++) add(trail[i - 1], trail[i]);
    for (const id of trail) ids.set(id, id);
    obligations.push({ key: o, id: o });
    outside++;
  }

  /** A parent's rank: its kind's among PARENT_KINDS, then any other parent, then an obligation standing there itself. */
  const rank = (id: string) => {
    const kind = index.byId.get(id)?.kind ?? '';
    const at = PARENT_KINDS.indexOf(kind);
    return at >= 0 ? at : isObligation(index, id) ? PARENT_KINDS.length + 1 : PARENT_KINDS.length;
  };
  const ranked = (list: readonly string[]) => list.map((id, i) => ({ id, i, r: rank(id) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.id);
  const branch: string[] = [];
  for (const d of domains) {
    const list = owned.get(d)!;
    if (list.length === 0) continue;
    ids.set(d, d);
    children.set(d, ranked(list));
    branch.push(d);
  }
  branch.push(...ranked(owned.get(product)!));
  if (branch.length > 0) children.set(OUTSIDE, branch);
  children.set(product, [...outcomes, ...(branch.length > 0 ? [OUTSIDE] : []), ...(untraced ? [UNTRACED] : [])]);

  // The obligations in the tree's order: depth first from the product.
  const at = new Map(obligations.map((p) => [p.key, p]));
  const ordered: { key: string; id: string }[] = [];
  const walk = (key: string) => { const p = at.get(key); if (p) ordered.push(p); for (const c of children.get(key) ?? []) walk(c); };
  walk(product);
  return { children, ids, obligations: ordered, outside };
}
