import type { SpecIndex, SpecRoute } from '../specs/data';

// One address per thing, whichever views show it (LA-PAT-APP-CODE-R19). A record is at its bare
// ID (`/LA-TRC-UC09`), a product and a domain included, whose one page is their overview (`/LA`,
// `/LA-EXP`). A group is at its place in the graph's tree (a stage or folder, `/LA-EXP/define/use-cases`, or a record's
// group of one kind of child, `/<parent-id>/<kind>`), and a group within one adds its parts
// (`/DM-SHOP/design/test-plan/acceptance/…`).
// App pages are lowercase words (`/`, `/format`, `/settings/appearance`), so they never clash with
// an ID, which starts with a capital; a space's Checks page is its product's ID and a word (`/LA/checks`). Every address
// of a record or group is made here, by addressOf. The open views (wiki, graph, model, one pane
// each) are a query parameter, `?view=wiki,graph`, so a shared link opens as it was seen.

/** A record ID, as FORMAT.md defines it: a capital first, then capitals and digits, in parts joined by hyphens. */
export const RECORD_ID = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/;
export const isRecordId = (part: string) => RECORD_ID.test(part);

/** The product list, the app's home page. */
export const HOME_PATH = '/';

/** The first word of every other app page: lowercase, so no ID can take its address. */
export const APP_PAGES: readonly string[] = ['format', 'settings'];

/** The word after a product's ID that addresses its space's Checks page. */
export const SPACE_CHECKS = 'checks';
/** The address of a space's Checks page: `/LA/checks`. */
export const checksPathOf = (product: string) => `/${encodeURIComponent(product)}/${SPACE_CHECKS}`;

/**
 * The address of a record (its bare ID) or of a group (its parent's ID, its kind and the parts of a
 * group within it, as in `LA-EXP/define/use-cases`). The index is not needed: an ID is its own address.
 */
export function addressOf(id: string): string {
  return `/${id.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * True for the address path of a focus page (a record's bare ID, or a group's parent ID and kind):
 * what a tab holds. A stored tab that is not one is dropped.
 */
export function isFocusPath(path: string): boolean {
  if (!path.startsWith('/')) return false;
  try {
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    return parts.length > 0 && isRecordId(parts[0]) && addressOf(parts.join('/')) === path && path !== checksPathOf(parts[0]);
  } catch {
    return false;
  }
}

export type ViewName = 'wiki' | 'graph' | 'model';
/** Every view, in the order its panes sit, left to right. */
export const VIEW_NAMES: readonly ViewName[] = ['wiki', 'graph', 'model'];
export const VIEW_LABELS: Record<ViewName, string> = { wiki: 'Wiki', graph: 'Graph', model: 'Model' };
export const isViewName = (v: unknown): v is ViewName => typeof v === 'string' && (VIEW_NAMES as readonly string[]).includes(v);

/** True for a page a space remembers as its last: a focus page or the space's Checks page. */
export function isSpacePath(path: string): boolean {
  if (isFocusPath(path)) return true;
  const id = path.split('/')[1] ?? '';
  return isRecordId(id) && path === checksPathOf(id);
}

/** The views a list names ("wiki,graph"), each once and in pane order; empty when it names none. */
export function parseViews(value: string | null | undefined): ViewName[] {
  if (!value) return [];
  const named = new Set(value.split(',').map((v) => v.trim()));
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

/** The kinds whose pages offer the Model view: an ERD of a domain, or of an aggregate with its entities and events. */
export const MODEL_KINDS: ReadonlySet<string> = new Set(['domain', 'aggregate', 'entity', 'domain_event']);

/** The views a page offers: Model only on a domain, aggregate, entity or domain event. */
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

/** The graph's center for a page: the record's ID, or a group's ID. */
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
