import { domainPath, groupPath, productPath, recordPath, type SpecIndex, type SpecRoute } from '../specs/data';
import { isGraphNode, parseGroupId } from '../graph/model';

// One address per thing, whichever view shows it. A record is at /records/<id>, a group at
// /records/<parent-id>/<kind>, a product and a domain at their overview pages under /specs. The
// view (wiki, graph or split) is a query parameter, so a shared link opens as it was seen.

export type ViewMode = 'wiki' | 'graph' | 'split';
export const VIEW_MODES: readonly ViewMode[] = ['wiki', 'graph', 'split'];
export const VIEW_LABELS: Record<ViewMode, string> = { wiki: 'Wiki', graph: 'Graph', split: 'Split' };
export const isViewMode = (v: unknown): v is ViewMode => typeof v === 'string' && (VIEW_MODES as readonly string[]).includes(v);

/** The view named in a query string (`?view=graph`), or null. */
export function viewFromSearch(search: string): ViewMode | null {
  const v = new URLSearchParams(search).get('view');
  return isViewMode(v) ? v : null;
}

/** An address with the view in its query string. */
export const withView = (path: string, view: ViewMode) => `${path}?view=${view}`;

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
    return g ? groupPath(g.parent, g.kind) : recordPath(id);
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
  return withView(g ? groupPath(g.parent, g.kind) : recordPath(id), 'graph');
}
