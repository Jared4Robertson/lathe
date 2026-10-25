import { domainPath, groupPath, productPath, recordPath, type SpecIndex, type SpecRoute } from '../specs/data';
import { isGraphNode, parseGroupId } from '../graph/model';

// One address per thing, whichever views show it. A record is at /records/<id>, a group at
// /records/<parent-id>/<kind>, a product and a domain at their overview pages under /specs. The
// open views (wiki, graph, model, one pane each) are a query parameter, `?view=wiki,graph`, so a
// shared link opens as it was seen. The old `?view=split` opens the wiki and the graph.

export type ViewName = 'wiki' | 'graph' | 'model';
/** Every view, in the order its panes sit, left to right. */
export const VIEW_NAMES: readonly ViewName[] = ['wiki', 'graph', 'model'];
export const VIEW_LABELS: Record<ViewName, string> = { wiki: 'Wiki', graph: 'Graph', model: 'Model' };
export const isViewName = (v: unknown): v is ViewName => typeof v === 'string' && (VIEW_NAMES as readonly string[]).includes(v);

/** The views a list names ("wiki,graph", or the old "split"), each once and in pane order; empty when it names none. */
export function parseViews(value: string | null | undefined): ViewName[] {
  if (!value) return [];
  const named = new Set(value.split(',').flatMap((v) => (v.trim() === 'split' ? ['wiki', 'graph'] : [v.trim()])));
  return VIEW_NAMES.filter((v) => named.has(v));
}

/** The views named in a query string (`?view=wiki,graph`), or null when it names none. */
export function viewsFromSearch(search: string): ViewName[] | null {
  const views = parseViews(new URLSearchParams(search).get('view'));
  return views.length > 0 ? views : null;
}

/** An address with its open views in the query string. */
export const withView = (path: string, views: ViewName | readonly ViewName[]) =>
  `${path}?view=${(typeof views === 'string' ? [views] : VIEW_NAMES.filter((v) => views.includes(v))).join(',')}`;

/** The kinds whose pages offer the Model view: an ERD of a domain, or of an aggregate and its entities. */
export const MODEL_KINDS: ReadonlySet<string> = new Set(['domain', 'aggregate', 'entity']);

/** The views a page offers: Model only on a domain, aggregate or entity. */
export function viewsOffered(index: SpecIndex, focus: string): ViewName[] {
  const kind = index.byId.get(focus)?.kind;
  return VIEW_NAMES.filter((v) => v !== 'model' || (kind !== undefined && MODEL_KINDS.has(kind)));
}

/** What a page shows of the views asked for: those it offers, or the wiki when none of them is. */
export function viewsShown(asked: readonly ViewName[], offered: readonly ViewName[]): ViewName[] {
  const shown = VIEW_NAMES.filter((v) => asked.includes(v) && offered.includes(v));
  return shown.length > 0 ? shown : ['wiki'];
}

/** The pages that show one focus (a record, group, product or domain) in the wiki and graph views. */
export type FocusRoute = Extract<SpecRoute, { page: 'product' | 'domain' | 'record' | 'group' }>;
export const isFocusRoute = (r: SpecRoute | null): r is FocusRoute => !!r && ['product', 'domain', 'record', 'group'].includes(r.page);

/** The graph's center for a page: the record's ID, or a group's `<parent-id>/<kind>`. */
export function focusOf(route: FocusRoute): string {
  switch (route.page) {
    case 'product': return route.product;
    case 'domain': return route.domain;
    case 'record': return route.id;
    case 'group': return `${route.parent}/${route.kind}`;
  }
}

/** The address of a record or group: a product's or domain's overview, a group's page, or the record page. */
export function addressOf(index: SpecIndex, id: string): string {
  const record = index.byId.get(id);
  if (!record) {
    const g = parseGroupId(id);
    return g ? groupPath(g.parent, [g.kind, ...g.path].join('/')) : recordPath(id);
  }
  if (record.kind === 'product') return productPath(id);
  if (record.kind === 'domain' && record.product) return domainPath(record.product, id);
  return recordPath(id);
}

/** Where an old /graph address goes now: the same thing in the Graph view (the first product for /graph itself). */
export function graphRedirect(index: SpecIndex, pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'graph') return null;
  if (parts.length === 1) {
    const first = index.products[0];
    return first ? withView(productPath(first.id), 'graph') : null;
  }
  const id = parts.slice(1).map(decodeURIComponent).join('/');
  if (isGraphNode(index, id)) return withView(addressOf(index, id), 'graph');
  const g = parseGroupId(id);
  return withView(g ? groupPath(g.parent, [g.kind, ...g.path].join('/')) : recordPath(id), 'graph');
}
