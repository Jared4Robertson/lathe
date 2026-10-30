import type { RecordIndex } from '../exploring/record-summaries/record-index';
import { isRecordId } from './address';

// Records and groups are at their IDs, made by addressOf (address.ts); the app's one page of its own is the products
// picker at `/`. Every tool (Checks, Appearance, the format pages) opens over the stage, in the address's query
// (overlays.ts).

export type SpecRoute =
  | { page: 'product'; product: string }
  | { page: 'domain'; product: string; domain: string }
  | { page: 'record'; id: string }
  | { page: 'group'; parent: string; kind: string }
  | { page: 'specs' }
  | { page: 'missing' };

/**
 * Parses a path: `/` (the products picker), a record's bare ID, or a group's parent ID and kind. Any other address is
 * missing. With the space's index, a product's and a domain's ID is their overview; without it (while the space is
 * read) any ID reads as a record.
 */
export function parseSpecRoute(pathname: string, index?: RecordIndex | null): SpecRoute {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { page: 'specs' };
  if (isRecordId(parts[0])) {
    if (parts.length >= 2) return { page: 'group', parent: parts[0], kind: parts.slice(1).join('/') };
    const record = index?.byId.get(parts[0]);
    if (record?.kind === 'product') return { page: 'product', product: record.id };
    if (record?.kind === 'domain' && record.product) return { page: 'domain', product: record.product, domain: record.id };
    return { page: 'record', id: parts[0] };
  }
  return { page: 'missing' };
}
