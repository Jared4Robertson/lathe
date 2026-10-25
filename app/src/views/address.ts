import type { SpecIndex, SpecRoute } from '../specs/data';

// One address per thing, whichever views show it (LA-PAT-APP-CODE-R19). A record is at its bare
// ID (`/LA-BRW-UC01`), a product and a domain included, whose one page is their overview (`/LA`,
// `/LA-BRW`). A group is at its parent's ID and its kind (`/LA-BRW/use_case`), and a group within
// one adds its parts (`/DM-SHOP/test/acceptance/…`, `/LA-BRW/design/technical-specification`).
// App pages are lowercase words (`/`, `/checks`, `/format`, `/settings/appearance`,
// `/diagrams/<slug>`), so they never clash with an ID, which starts with a capital. Every address
// of a record or group is made here, by addressOf. The open views (wiki, graph, model, one pane
// each) are a query parameter, `?view=wiki,graph`, so a shared link opens as it was seen; the old
// `?view=split` opens the wiki and the graph. Old addresses (/records, /specs, /graph) redirect to
// these (legacyAddress), and tabs saved with them are read in today's form (currentAddress).

/** A record ID, as FORMAT.md defines it: a capital first, then capitals and digits, in parts joined by hyphens. */
export const RECORD_ID = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/;
export const isRecordId = (part: string) => RECORD_ID.test(part);

/** The product list, the app's home page. */
export const HOME_PATH = '/';

/** The first word of every other app page: lowercase, so no ID can take its address. */
export const APP_PAGES: readonly string[] = ['checks', 'format', 'settings', 'diagrams'];

/** The first words of the old addresses, which redirect (legacyAddress). */
export const OLD_PREFIXES: readonly string[] = ['records', 'specs', 'graph'];

/**
 * The address of a record (its bare ID) or of a group (its parent's ID, its kind and the parts of a
 * group within it, as in `LA-BRW/use_case`). The index is not needed: an ID is its own address.
 */
export function addressOf(id: string): string;
export function addressOf(index: SpecIndex | null | undefined, id: string): string;
export function addressOf(a: SpecIndex | string | null | undefined, b?: string): string {
  const id = typeof b === 'string' ? b : (a as string);
  return `/${id.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Where an old address goes now, to the same thing: `/records/<id>` and `/records/<parent>/<kind>…`
 * lose their prefix, `/specs` is the product list, `/specs/<product>` the product and
 * `/specs/<product>/<domain>` the domain (`…/graph` in the Graph view), and `/graph/<id>` is the
 * same thing in the Graph view. Undefined for an address that is not old; null for `/graph` alone
 * while the specs are loading, as it opens the first product's graph (`firstProduct`).
 */
export function legacyAddress(pathname: string, firstProduct?: string | null): string | null | undefined {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const at = (ids: string[]) => addressOf(ids.join('/'));
  const inGraph = (path: string) => `${path}?view=graph`;
  switch (parts[0]) {
    case 'records':
      return parts.length >= 2 ? at(parts.slice(1)) : HOME_PATH;
    case 'specs':
      if (parts.length === 1) return HOME_PATH;
      if (parts.length === 2) return at([parts[1]]);
      if (parts.length === 3) return at([parts[2]]);
      if (parts.length === 4 && parts[3] === 'graph') return inGraph(at([parts[2]]));
      return HOME_PATH;
    case 'graph':
      if (parts.length > 1) return inGraph(at(parts.slice(1)));
      if (firstProduct === undefined) return null;
      return firstProduct ? inGraph(at([firstProduct])) : HOME_PATH;
    default:
      return undefined;
  }
}

/** A redirect's whole address: its path and query, with the old address's other query parameters and its hash kept. */
export function redirectTarget(to: string, search: string, hash = ''): string {
  const [path, query = ''] = to.split('?');
  const params = new URLSearchParams(search);
  for (const [k, v] of new URLSearchParams(query)) params.set(k, v);
  const qs = params.toString().replaceAll('%2C', ',');
  return `${path}${qs ? `?${qs}` : ''}${hash}`;
}

/** A stored page address in today's form: an old one (a tab or a space's last page saved before) becomes its new one. */
export function currentAddress(stored: string): string {
  const [path, query] = stored.split('?');
  const now = legacyAddress(path);
  if (typeof now !== 'string') return stored;
  return query === undefined ? now : redirectTarget(now, `?${query}`);
}

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

/** A focus page's address path, without the views: the page a tab holds. */
export const pathOf = (route: FocusRoute): string => addressOf(focusOf(route));
