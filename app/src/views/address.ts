import type { SpecRoute } from '../specs/data';

// One address per thing, whichever stage shows it (LA-PAT-APP-CODE-R19). A record is at its bare
// ID (`/LA-TRC-UC09`), a product and a domain included, whose one page is their overview (`/LA`,
// `/LA-EXP`). A group is at its place in the graph's tree (a stage or folder, `/LA-EXP/define/use-cases`, or a record's
// group of one kind of child, `/<parent-id>/<kind>`), and a group within one adds its parts
// (`/DM-SHOP/design/test-plan/acceptance/…`).
// The app has one page of its own, the products picker at `/`; everything else is a tool over the stage, opened in
// the query of the focus it is over (`?panel=checks`, `?page=format/kinds/use_case`, views/overlays.tsx), so no
// address of an app page can clash with an ID, which starts with a capital. Every address of a record or group is
// made here, by addressOf. The stage behind the page (the graph, the ERD or the trace) is a query parameter,
// `?stage=erd`, so a shared link opens as it was seen.

/** A record ID, as the schema shapes it: a capital first, then capitals and digits, in parts joined by hyphens. */
export const RECORD_ID = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/;
export const isRecordId = (part: string) => RECORD_ID.test(part);

/** The products picker over the last product's stage: the app's home page. */
export const HOME_PATH = '/';

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
    return parts.length > 0 && isRecordId(parts[0]) && addressOf(parts.join('/')) === path;
  } catch {
    return false;
  }
}

export type StageName = 'graph' | 'erd' | 'trace';
/** Every stage, in the stage switch's order. */
export const STAGE_NAMES: readonly StageName[] = ['graph', 'erd', 'trace'];
export const STAGE_LABELS: Record<StageName, string> = { graph: 'Graph', erd: 'ERD', trace: 'Trace' };
/** The stage a page shows when its address names none. Every stage works on every focus (LA-PAT-APP-UX-R17). */
export const DEFAULT_STAGE: StageName = 'graph';

/** The stage a value names ("erd"), or null when it names none. */
export function parseStage(value: string | null | undefined): StageName | null {
  const v = value?.trim();
  return STAGE_NAMES.find((s) => s === v) ?? null;
}

/** The stage named in a query string (`?stage=erd`), or null when it names none. */
export const stageFromSearch = (search: string): StageName | null => parseStage(new URLSearchParams(search).get('stage'));

/** An address with its stage in the query string. */
export const withStage = (path: string, stage: StageName) => `${path}?stage=${stage}`;

/** The pages that show one focus (a record, group, product or domain) on the stage and in the wiki card. */
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

/** A focus page's address path, without the stage: the page a tab holds. */
export const pathOf = (route: FocusRoute): string => addressOf(focusOf(route));
