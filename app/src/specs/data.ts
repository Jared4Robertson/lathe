import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Coverage, Problem } from '../../../lathe/src/types';
import type { Row, SpecData, Value } from '../../../lathe/src/server/contract';
import type { IdScope, SchemaDescription, Stage } from '../../../lathe/src/store/schema';
import { onLatheEvent } from '../events';
import { isRecordId, SPACE_CHECKS } from '../views/address';

export type { Coverage, Problem, Row, SchemaDescription, SpecData, Stage, Value };

// The app's spec index, built from the typed rows GET /api/spec serves (lathe/src/server/contract.ts):
// a record per row of a kind's table, its parent from the one of its kind's parent columns that
// holds a value, a link per row of a relation's table, and the part rows (an entity's fields, a use
// case's actors, a table's keys) under the record that owns them. A kind with no owner (a value
// object, a specification, a view, an integration, a UI component) has no parent: its product, and a
// specification's domain, follow from its ID. Every view reads this index.

/** A kind as the app reads it from the schema description. */
export interface Kind {
  kind: string;
  label: string;
  /** Its stage; null for the product, an open question, and a product's kind declared outside the stages. */
  stage: Stage | null;
  /** The kinds its records may sit under: none for a product and a kind with no owner, two for an endpoint, a table and an open question. */
  parent_kinds: string[];
  /** The columns every record of the kind must give, besides its id, title and parent columns. */
  required_fields: string[];
  /** An obligation must be designed, built and proved; coverage counts every obligation kind. */
  obligation: boolean;
  /** What its IDs start with: its product's, its domain's or its parent's ID; null for a product's own kind. */
  id_scope: IdScope | null;
  description: string;
}

/** A stage, in the order a product is modeled: domain model, use cases, interaction design, technical specification, test plan. */
export interface StageRule {
  stage: Stage;
  label: string;
  description: string;
}

/** One pair of kinds a relation may link. */
export interface RelationRule {
  relation: string;
  source_kind: string;
  /** A kind, or '*' for any kind. */
  target_kind: string;
  /** 'design': the link designs its target (a step fulfilling a UC requirement); 'proof': it proves it; '' otherwise. */
  role: 'design' | 'proof' | '';
  description: string;
  /** The link in plain words read from the source, in sentence case: "Fulfills". */
  forward_label: string;
  /** The link in plain words read from the target, in sentence case: "Fulfilled by". */
  reverse_label: string;
}

/** One record: a row of its kind's table, placed in the tree. */
export interface SpecRecord {
  id: string;
  kind: string;
  title: string;
  /** The record it sits under: the one of its kind's parent columns that holds a value; null for a product and a kind with no owner. */
  parent: string | null;
  /** The product it sits in (itself for a product). */
  product: string | null;
  /** The domain it sits in (itself for a domain), or null for what sits at product level. */
  domain: string | null;
  /** The row as the data file holds it: every column that has a value, typed. */
  row: Row;
  /** Its data file, relative to the product root, such as data/use_case.jsonl. */
  file: string;
  /** Its line in that file, from 1. */
  line: number;
}

/** One row of a relation's table. */
export interface SpecLink {
  source: string;
  relation: string;
  target: string;
}

/** One row of a part table (an entity's field, a table's key), with the record that owns it. */
export interface PartRow {
  table: string;
  owner: string;
  row: Row;
}

/** The typed data read into records, links and parts, with what the checks found. */
export interface Workspace {
  schema: SchemaDescription;
  /** The data folder, relative to the product root, such as data. */
  dataDir: string;
  /** Every kind, in the schema's kind order (kindOrder). */
  kinds: Kind[];
  /** The five stages, in order. */
  stages: StageRule[];
  /** Each relation's allowed pairs, one rule per pair. */
  relations: RelationRule[];
  records: SpecRecord[];
  links: SpecLink[];
  parts: PartRow[];
  /** The rows of the check table: each check's name, severity, summary and explanation. */
  checks: Row[];
  problems: Problem[];
  coverage: Coverage[];
}

/** A column's value as text: '' when it has none, a list joined by commas, a number or true/false written out. */
export function textOf(row: Row, column: string): string {
  const value = row[column];
  if (value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/** The columns of a kind's table that name a parent of the record (its own and the derived ones, such as domain_id). */
export function parentColumns(schema: SchemaDescription, kind: string): Set<string> {
  return new Set((schema.kinds[kind]?.parents ?? []).map((p) => p.column));
}

/**
 * The part tables a kind's records own: those whose owner column points at the kind's table, or at
 * a link the kind starts (a follower's setting values hang on its follows link).
 */
export function partTablesOf(schema: SchemaDescription, kind: string): string[] {
  const starts = (table: string) => {
    const relation = schema.relations[table];
    return !!relation && (relation.sourceTable === kind || (schema.supertypes[relation.sourceTable] ?? []).includes(kind));
  };
  return Object.values(schema.tables)
    .filter((t) => t.role === 'part' && t.foreignKeys.some((f) => f.columns[0] === t.ownerColumn && (f.table === kind || starts(f.table))))
    .map((t) => t.name)
    .sort();
}

/**
 * Orders kind names as the schema does: Lathe's kinds by their position (the product, the five stages in order, then
 * open questions), a product's own kinds after them, by name.
 */
export function kindOrder(schema: SchemaDescription): (a: string, b: string) => number {
  const rank = (kind: string) => schema.kinds[kind]?.position ?? Number.MAX_SAFE_INTEGER;
  return (a, b) => rank(a) - rank(b) || a.localeCompare(b);
}

/**
 * The product, or domain, an ID starts with: the longest of the IDs that, with a hyphen, starts it. A kind with no
 * owner takes its product (and a specification its domain) from its ID this way.
 */
function prefixOwner(ids: readonly string[], id: string): string | null {
  let best: string | null = null;
  for (const owner of ids) if (id.startsWith(`${owner}-`) && (!best || owner.length > best.length)) best = owner;
  return best;
}

/** Reads the schema's kinds, stages and relations, and the rows, into a Workspace. */
export function buildWorkspace(data: SpecData): Workspace {
  const { schema } = data;
  const names = Object.keys(schema.kinds).sort(kindOrder(schema));
  const kinds: Kind[] = names.map((name) => {
    const k = schema.kinds[name];
    const skip = new Set(['id', 'title', ...k.parents.map((p) => p.column)]);
    return {
      kind: name,
      label: k.label,
      stage: k.stage,
      parent_kinds: k.parents.map((p) => p.kind),
      required_fields: (schema.tables[name]?.columns ?? []).filter((c) => c.required && !skip.has(c.name)).map((c) => c.name),
      obligation: k.obligation,
      id_scope: k.idScope,
      description: k.description ?? '',
    };
  });
  const stages: StageRule[] = [...schema.stages]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ stage: s.name, label: s.label, description: s.description }));
  const relations: RelationRule[] = Object.values(schema.relations).flatMap((r) =>
    r.pairs.map((p) => ({
      relation: r.name,
      source_kind: p.source,
      target_kind: p.target,
      role: r.role ?? '',
      description: p.description || (r.description ?? ''),
      forward_label: r.forwardLabel,
      reverse_label: r.reverseLabel,
    })),
  );

  const dir = data.dataDir.replace(/\/+$/, '');
  const placed: Omit<SpecRecord, 'product' | 'domain'>[] = names.flatMap((kind) => {
    const parents = schema.kinds[kind].parents;
    return (data.tables[kind] ?? []).map((row, i) => {
      const parent = parents.map((p) => row[p.column]).find((v): v is string => typeof v === 'string' && v !== '') ?? null;
      return { id: String(row.id), kind, title: textOf(row, 'title'), parent, row, file: `${dir}/${kind}.jsonl`, line: i + 1 };
    });
  });
  const byId = new Map(placed.map((r) => [r.id, r]));
  const productIds = placed.filter((r) => r.kind === 'product').map((r) => r.id);
  const domainIds = placed.filter((r) => r.kind === 'domain').map((r) => r.id);
  // A record's product and domain: the nearest of each up its parent chain. A chain that ends in a kind with no owner
  // takes its product from that record's ID, and its domain too when that kind's IDs are domain-scoped.
  const scopeOf = (start: Omit<SpecRecord, 'product' | 'domain'>): { product: string | null; domain: string | null } => {
    const seen = new Set<string>();
    let product: string | null = null;
    let domain: string | null = null;
    let top = start;
    for (let r: typeof start | undefined = start; r && !seen.has(r.id); r = r.parent ? byId.get(r.parent) : undefined) {
      seen.add(r.id);
      top = r;
      if (r.kind === 'domain') domain ??= r.id;
      if (r.kind === 'product') product = r.id;
    }
    if (top.kind !== 'product' && !top.parent) {
      product ??= prefixOwner(productIds, top.id);
      if (!domain && schema.kinds[top.kind]?.idScope === 'domain') domain = prefixOwner(domainIds, top.id);
    }
    return { product, domain };
  };
  const records: SpecRecord[] = placed.map((r) => ({ ...r, ...scopeOf(r) }));

  const links: SpecLink[] = [];
  const parts: PartRow[] = [];
  for (const table of Object.values(schema.tables)) {
    const rows = data.tables[table.name];
    if (!rows) continue;
    if (table.role === 'link') {
      for (const row of rows) links.push({ source: String(row.source_id), relation: table.name, target: String(row.target_id) });
    } else if (table.role === 'part' && table.ownerColumn) {
      for (const row of rows) parts.push({ table: table.name, owner: String(row[table.ownerColumn]), row });
    }
  }
  return {
    schema,
    dataDir: dir,
    kinds,
    stages,
    relations,
    records,
    links,
    parts,
    checks: data.tables.check ?? [],
    problems: data.problems,
    coverage: data.coverage,
  };
}

export interface SpecIndex {
  workspace: Workspace;
  byId: Map<string, SpecRecord>;
  kinds: Map<string, Kind>;
  children: Map<string, SpecRecord[]>;
  outgoing: Map<string, SpecLink[]>;
  incoming: Map<string, SpecLink[]>;
  /** Each record's part rows, by part table, in key order. */
  parts: Map<string, Map<string, Row[]>>;
  problemsFor: Map<string, Problem[]>;
  coverage: Map<string, Coverage>;
  products: SpecRecord[];
  domainsOf: Map<string, SpecRecord[]>;
}

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

export const byIdOrder = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true });

export function indexWorkspace(workspace: Workspace): SpecIndex {
  const records = [...workspace.records].sort(byIdOrder);
  const byId = new Map(records.map((r) => [r.id, r]));
  const children = new Map<string, SpecRecord[]>();
  const outgoing = new Map<string, SpecLink[]>();
  const incoming = new Map<string, SpecLink[]>();
  const problemsFor = new Map<string, Problem[]>();
  const domainsOf = new Map<string, SpecRecord[]>();
  const parts = new Map<string, Map<string, Row[]>>();
  for (const r of records) {
    if (r.parent) push(children, r.parent, r);
    if (r.kind === 'domain' && r.product) push(domainsOf, r.product, r);
  }
  for (const l of workspace.links) {
    push(outgoing, l.source, l);
    push(incoming, l.target, l);
  }
  for (const p of workspace.parts) {
    let owned = parts.get(p.owner);
    if (!owned) { owned = new Map(); parts.set(p.owner, owned); }
    push(owned, p.table, p.row);
  }
  for (const p of workspace.problems) if (p.record) push(problemsFor, p.record, p);
  return {
    workspace,
    byId,
    kinds: new Map(workspace.kinds.map((k) => [k.kind, k])),
    children,
    outgoing,
    incoming,
    parts,
    problemsFor,
    coverage: new Map(workspace.coverage.map((c) => [c.domain, c])),
    products: records.filter((r) => r.kind === 'product'),
    domainsOf,
  };
}

/** A record's rows of one part table (an entity's fields, a use case's steps), in key order. */
export const partsOf = (index: SpecIndex, id: string, table: string): Row[] => index.parts.get(id)?.get(table) ?? [];

/** True when a problem belongs to no product: it names no record, or a record no product holds. */
export const isWorkspaceProblem = (index: SpecIndex, p: Problem) => !p.record || !index.byId.get(p.record)?.product;

const spaceCache = new WeakMap<SpecIndex, Map<string, SpecIndex>>();

/**
 * One product's space (hard separation between products): its own records, the records no product
 * holds, the links and parts among them, their coverage, and its problems with the workspace's
 * (those of no product). Nothing of another product is in it: every view and count inside a space
 * reads this, never the whole workspace. Built once per index and product.
 */
export function spaceIndex(index: SpecIndex, product: string): SpecIndex {
  let known = spaceCache.get(index);
  if (!known) { known = new Map(); spaceCache.set(index, known); }
  const cached = known.get(product);
  if (cached) return cached;
  const { workspace } = index;
  const inSpace = (r: SpecRecord | undefined) => !!r && (r.product === product || r.product === null);
  // A link or problem about an ID that is no record stays with the record that names it.
  const elsewhere = (id: string) => { const r = index.byId.get(id); return !!r && !inSpace(r); };
  const space = indexWorkspace({
    ...workspace,
    records: workspace.records.filter((r) => inSpace(r)),
    links: workspace.links.filter((l) => !elsewhere(l.source) && !elsewhere(l.target)),
    parts: workspace.parts.filter((p) => !elsewhere(p.owner)),
    checks: workspace.checks.filter((c) => c.product_id === undefined || c.product_id === product),
    problems: workspace.problems.filter((p) => !p.record || !elsewhere(p.record)),
    coverage: workspace.coverage.filter((c) => !elsewhere(c.domain)),
  });
  known.set(product, space);
  return space;
}

/** Errors before warnings, then by check name and record. */
export const problemOrder = (a: Problem, b: Problem) =>
  (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) ||
  a.check.localeCompare(b.check) ||
  (a.record ?? '').localeCompare(b.record ?? '', 'en', { numeric: true });

export interface SpecState {
  index: SpecIndex | null;
  error: string | null;
  /** Fetches the data again, as after a write. */
  reload: () => Promise<void>;
}

/** Fetches GET /api/spec once, again whenever the server reports a change to the data, and when asked. */
export function useSpec(): SpecState {
  const [data, setData] = useState<SpecData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const response = await fetch('/api/spec');
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? response.statusText);
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    reload();
    return onLatheEvent('spec:changed', reload);
  }, [reload]);

  const index = useMemo(() => (data ? indexWorkspace(buildWorkspace(data)) : null), [data]);
  return { index, error, reload };
}

// Records and groups are at their IDs, made by addressOf (app/src/views/address.ts); the app's own
// pages are lowercase words. A space's Checks page is inside the space, under its product's ID
// (checksPathOf).
export const formatPath = '/format';

export type SpecRoute =
  | { page: 'product'; product: string }
  | { page: 'domain'; product: string; domain: string }
  | { page: 'record'; id: string }
  | { page: 'group'; parent: string; kind: string }
  | { page: 'checks'; product: string }
  | { page: 'format' }
  | { page: 'format-kind'; kind: string }
  | { page: 'format-check'; check: string }
  | { page: 'specs' }
  | { page: 'missing' };

/** The app pages the spec routes leave to the shell: Settings. */
const SHELL_PAGES = new Set(['settings']);

/**
 * Parses a path: `/` (the products), an app page, a record's bare ID, a group's parent ID and
 * kind, or a product's ID and `checks` (its space's Checks page). Any other address is missing. With the index, a product's and a domain's ID is their
 * overview; without it (while the specs load) any ID reads as a record. Null for the shell's own
 * pages (Settings).
 */
export function parseSpecRoute(pathname: string, index?: SpecIndex | null): SpecRoute | null {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { page: 'specs' };
  if (SHELL_PAGES.has(parts[0])) return null;
  if (isRecordId(parts[0])) {
    if (parts.length === 2 && parts[1] === SPACE_CHECKS) return { page: 'checks', product: parts[0] };
    if (parts.length >= 2) return { page: 'group', parent: parts[0], kind: parts.slice(1).join('/') };
    const record = index?.byId.get(parts[0]);
    if (record?.kind === 'product') return { page: 'product', product: record.id };
    if (record?.kind === 'domain' && record.product) return { page: 'domain', product: record.product, domain: record.id };
    return { page: 'record', id: parts[0] };
  }
  if (parts[0] === 'format') {
    if (parts.length === 1) return { page: 'format' };
    // A kind's page and a check's page in the format reference.
    if (parts.length === 3 && parts[1] === 'kinds') return { page: 'format-kind', kind: parts[2] };
    if (parts.length === 3 && parts[1] === 'checks') return { page: 'format-check', check: parts[2] };
    return { page: 'missing' };
  }
  return { page: 'missing' };
}

export const kindLabel = (index: SpecIndex, kind: string) => index.kinds.get(kind)?.label ?? kind.replaceAll('_', ' ');
