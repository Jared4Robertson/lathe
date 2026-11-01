// Where each record sits, for the Exploring read models' projections (record summaries, the folder tree, the ERD): its
// kind, its parent (the one of its kind's parent columns that holds a value), and the product and domain it sits in,
// as the store's record_scope places it (platform/data/integrity.ts): up its parents to a product and a domain; a
// record of a kind with no owner by the longest product (or, for a kind placed by domain, domain) its ID starts with;
// and a view, integration, value object or UI component in the one domain that uses it, or in none when two or more
// do, or none. What sits under such a record follows it. It reads each source table once.
import { groupBy, groupOf } from '../platform/data/grouped.ts';
import type { ReadView } from '../platform/data/rules.ts';
import type { Row } from '../platform/data/rows.ts';

/** One record as the projections place it. */
export interface Placed {
  id: string;
  kind: string;
  title: string;
  /** The record it sits under, or null for a product and a kind with no owner. */
  parent: string | null;
  product: string | null;
  domain: string | null;
  /** Its row, for the projection that reads it; never part of an answer. */
  row: Row;
  /** Its line in its kind's data file, from 1: the rows are kept sorted by key, as the files hold them. */
  line: number;
}

/** How a domain uses a record with no owner: each row of the table names a user, placed through its parents, and what it uses. */
const USED_BY: { table: string; user: string; used: string }[] = [
  { table: 'presents', user: 'target_id', used: 'source_id' },
  { table: 'exchanges_with', user: 'source_id', used: 'target_id' },
  { table: 'entity_field', user: 'entity_id', used: 'type_value_object_id' },
  { table: 'event_field', user: 'domain_event_id', used: 'type_value_object_id' },
  { table: 'read_model_field', user: 'read_model_id', used: 'type_value_object_id' },
];

/** The longest of the IDs the ID starts with (and a hyphen), or null. */
const longestPrefix = (ids: readonly string[], id: string): string | null =>
  ids.filter((p) => id.startsWith(`${p}-`)).sort((a, b) => b.length - a.length)[0] ?? null;

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * Every record of the data, placed, by ID, in the schema's kind order and each kind's key order: the one the data's
 * holder keeps (Store.readerOf) until a table it read changes, shared by every projection that reads it, or else worked
 * out on this view. Nothing changes what it gives.
 */
export function placementOf(view: ReadView): ReadonlyMap<string, Placed> {
  return view.readerOf ? view.readerOf(placeRecords) : placeRecords(view);
}

// Every record of the data, placed (placementOf).
function placeRecords(view: ReadView): Map<string, Placed> {
  const { schema } = view;
  const placed = new Map<string, Placed>();
  for (const kind of Object.keys(schema.kinds)) {
    const parents = schema.kinds[kind].parents;
    view.rows(kind).forEach((row, at) => {
      const id = String(row.id);
      const parent = parents.map((p) => text(row[p.column])).find((v) => v !== null) ?? null;
      placed.set(id, { id, kind, title: String(row.title ?? ''), parent, product: null, domain: null, row, line: at + 1 });
    });
  }
  const products = [...placed.values()].filter((r) => r.kind === 'product').map((r) => r.id);
  const domains = new Map([...placed.values()].filter((r) => r.kind === 'domain').map((r) => [r.id, text(r.row.product_id)]));
  const domainIds = [...domains.keys()];

  // Up the parents to the top: a product, a domain on the way (the nearest of each), and the top record. Each record's
  // is its own over its parent's, so each is worked out once and kept (a walk per record would climb the same chains
  // again and again); a chain that comes back on itself is walked from each of its records as it stands.
  type Up = { product: string | null; domain: string | null; top: Placed };
  const ownUp = (at: Placed, above: Up): Up => ({
    product: at.kind === 'product' ? at.id : at.kind === 'domain' ? (domains.get(at.id) ?? above.product) : above.product,
    domain: at.kind === 'domain' ? at.id : above.domain,
    top: above.top,
  });
  const ups = new Map<string, Up>();
  const walk = (start: Placed): Up => {
    const seen = new Set<string>();
    let product: string | null = null;
    let domain: string | null = null;
    let top = start;
    for (let at: Placed | undefined = start; at && !seen.has(at.id); at = at.parent ? placed.get(at.parent) : undefined) {
      seen.add(at.id);
      top = at;
      if (at.kind === 'domain') { domain ??= at.id; product ??= domains.get(at.id) ?? null; }
      if (at.kind === 'product') product ??= at.id;
    }
    return { product, domain, top };
  };
  const upOf = (start: Placed): Up => {
    const chain: Placed[] = [];
    const seen = new Set<string>();
    let at: Placed | undefined = start;
    let above: Up | undefined;
    while (at) {
      above = ups.get(at.id);
      if (above) break;
      if (seen.has(at.id)) return walk(start);
      seen.add(at.id);
      chain.push(at);
      at = at.parent ? placed.get(at.parent) : undefined;
    }
    let up: Up = above ?? { product: null, domain: null, top: chain[chain.length - 1] };
    for (let i = chain.length - 1; i >= 0; i--) {
      up = ownUp(chain[i], up);
      ups.set(chain[i].id, up);
    }
    return up;
  };
  const anchorOf = (start: Placed): { product: string | null; domain: string | null; top: Placed } => {
    const up = upOf(start);
    let { product, domain } = up;
    const { top } = up;
    if (top.kind !== 'product' && top.parent === null && schema.kinds[top.kind]?.parents.length === 0) {
      if (schema.kinds[top.kind].idScope === 'domain') {
        const d = longestPrefix(domainIds, top.id);
        domain ??= d;
        product ??= d ? domains.get(d) ?? null : null;
      } else {
        product ??= longestPrefix(products, top.id);
      }
    }
    return { product, domain, top };
  };
  const tops = new Map<string, string>();
  for (const r of placed.values()) {
    const { product, domain, top } = anchorOf(r);
    r.product = product;
    r.domain = domain;
    tops.set(r.id, top.id);
  }

  // The kinds with no owner take the one domain that uses them; what sits under them follows.
  const users = new Map<string, Set<string>>();
  const use = (used: string | null, user: string | null) => {
    if (!used || !user) return;
    const domain = placed.get(user)?.domain;
    if (domain) users.set(used, (users.get(used) ?? new Set()).add(domain));
  };
  for (const u of USED_BY) if (schema.tables[u.table]) for (const row of view.rows(u.table)) use(text(row[u.used]), text(row[u.user]));
  if (schema.tables.renders && schema.tables.presents) {
    const presented = groupBy(view.rows('presents'), (h) => h.source_id);
    for (const r of view.rows('renders')) for (const p of groupOf(presented, String(r.target_id))) use(String(r.source_id), String(p.target_id));
  }
  for (const r of placed.values()) {
    if (r.domain) continue;
    const used = users.get(tops.get(r.id) ?? r.id);
    if (used?.size === 1) r.domain = [...used][0];
  }
  return placed;
}

/** Whether a placed record is in a product's space: its own, or of no product. */
export const inSpace = (record: Placed, product: string): boolean => record.product === product || record.product === null;
