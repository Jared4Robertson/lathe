// What changed in a product's data (LA-EXP-QR01): the one record diff Lathe has, between the data now and a baseline,
// by record. A record's rows are its own row in its kind's table, the part rows it owns (an entity's fields, a use
// case's actors) and the links it starts; a record is added when its own row is new, removed when its own row is gone,
// and changed when any of its rows is, each changed column with its value before and after, each part row added,
// removed or changed, and each link added or removed.
//
// It reads only rows and the schema, never a file or git, so the server, the web app's stages and the desktop chat
// all use it: Highlight changes and panel against a baseline (since the last commit, since the branch left the
// default branch, since the Reader last looked), the live marks against the data before a reload, and the chat
// against the data before a turn.
import type { FieldChange, HistoryChange } from './server/contract.ts';
import { describeKey, rowKey, type Row, type Value } from './platform/data/rows.ts';
import type { SchemaDescription, TableDescription } from './platform/data/schema.ts';
import { compareIds } from './platform/data/ids.ts';

export type { FieldChange, HistoryChange };

/** Every stored table's rows, by table name: what a data folder holds, or what it held at a commit. */
export type Tables = Record<string, readonly Row[]>;

/** A link a record starts, as a change names it. */
export interface LinkChange { relation: string; target: string }

/** One record's change from the baseline to now. */
export interface RecordChange {
  id: string;
  kind: string;
  /** Its title now, or before for a removed record. */
  title: string;
  change: 'added' | 'removed' | 'changed';
  /** The columns of its own row that changed (its title included), each before and after; for an added or removed record, none. */
  fields: FieldChange[];
  /** Its part rows added, removed or changed, each with its key and the columns that changed. */
  parts: HistoryChange[];
  /** The links it starts that were added and removed. */
  links: { added: LinkChange[]; removed: LinkChange[] };
}

const same = (a: Value | undefined, b: Value | undefined) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** A row's columns that differ between two versions of it, in the table's column order. */
function columnChanges(table: TableDescription, before: Row, after: Row): FieldChange[] {
  const out: FieldChange[] = [];
  for (const c of table.columns) {
    if (same(before[c.name], after[c.name])) continue;
    const f: FieldChange = { name: c.name };
    if (before[c.name] !== undefined) f.before = before[c.name];
    if (after[c.name] !== undefined) f.after = after[c.name];
    out.push(f);
  }
  return out;
}

/** Every column a row has, on one side. */
const allColumns = (table: TableDescription, row: Row, side: 'before' | 'after'): FieldChange[] =>
  table.columns.filter((c) => row[c.name] !== undefined).map((c) => ({ name: c.name, [side]: row[c.name] }));

/** The tables of each role the diff reads: the kinds', the parts' (with their owner column) and the links'. */
function tablesByRole(schema: SchemaDescription) {
  const kinds: TableDescription[] = [];
  const parts: TableDescription[] = [];
  const links: TableDescription[] = [];
  for (const name of schema.loadOrder) {
    const table = schema.tables[name];
    if (!table?.stored) continue;
    if (table.role === 'kind' && schema.kinds[name]) kinds.push(table);
    else if (table.role === 'part' && table.ownerColumn) parts.push(table);
    else if (table.role === 'link') links.push(table);
  }
  return { kinds, parts, links };
}

const byKey = (table: TableDescription, rows: readonly Row[] | undefined) => new Map((rows ?? []).map((r) => [rowKey(table, r), r]));

/** The records whose rows differ between the baseline and now, in ID order. */
export function recordChanges(schema: SchemaDescription, before: Tables, after: Tables): RecordChange[] {
  if (before === after) return [];
  const { kinds, parts, links } = tablesByRole(schema);
  const changes = new Map<string, RecordChange>();
  const kindOf = new Map<string, { kind: string; title: string }>();
  for (const table of kinds) {
    for (const r of before[table.name] ?? []) kindOf.set(String(r.id), { kind: table.name, title: String(r.title ?? '') });
    for (const r of after[table.name] ?? []) kindOf.set(String(r.id), { kind: table.name, title: String(r.title ?? '') });
  }
  /** The change of the record with this ID, made on first use; none for an ID that is no record on either side. */
  const of = (id: string): RecordChange | null => {
    const known = changes.get(id);
    if (known) return known;
    const k = kindOf.get(id);
    if (!k) return null;
    const made: RecordChange = { id, kind: k.kind, title: k.title, change: 'changed', fields: [], parts: [], links: { added: [], removed: [] } };
    changes.set(id, made);
    return made;
  };

  for (const table of kinds) {
    if (before[table.name] === after[table.name]) continue;
    const was = byKey(table, before[table.name]);
    const now = byKey(table, after[table.name]);
    for (const [key, row] of now) {
      const old = was.get(key);
      if (old === row) continue;
      if (!old) { of(String(row.id))!.change = 'added'; continue; }
      const fields = columnChanges(table, old, row);
      if (fields.length) of(String(row.id))!.fields = fields;
    }
    for (const [key, row] of was) if (!now.has(key)) of(String(row.id))!.change = 'removed';
  }

  for (const table of parts) {
    if (before[table.name] === after[table.name]) continue;
    const owner = table.ownerColumn!;
    const was = byKey(table, before[table.name]);
    const now = byKey(table, after[table.name]);
    const note = (row: Row, change: HistoryChange['change'], fields: FieldChange[]) => {
      const record = of(String(row[owner]));
      record?.parts.push({ table: table.name, key: describeKey(table, row), change, fields });
    };
    for (const [key, row] of now) {
      const old = was.get(key);
      if (old === row) continue;
      if (!old) { note(row, 'added', allColumns(table, row, 'after')); continue; }
      const fields = columnChanges(table, old, row);
      if (fields.length) note(row, 'changed', fields);
    }
    for (const [key, row] of was) if (!now.has(key)) note(row, 'removed', allColumns(table, row, 'before'));
  }

  for (const table of links) {
    if (before[table.name] === after[table.name]) continue;
    const was = byKey(table, before[table.name]);
    const now = byKey(table, after[table.name]);
    const link = (row: Row): LinkChange => ({ relation: table.name, target: String(row.target_id) });
    for (const [key, row] of now) if (!was.has(key)) of(String(row.source_id))?.links.added.push(link(row));
    for (const [key, row] of was) if (!now.has(key)) of(String(row.source_id))?.links.removed.push(link(row));
  }

  const out = [...changes.values()].filter((c) => c.change !== 'changed' || c.fields.length || c.parts.length || c.links.added.length || c.links.removed.length);
  // An added or removed record is the whole record: its parts and links come and go with it.
  for (const c of out) {
    if (c.change === 'changed') continue;
    c.fields = [];
    c.parts = [];
    c.links = { added: [], removed: [] };
  }
  return out.sort((a, b) => compareIds(a.id, b.id));
}

// ---------- A moment's data as a commit and what differed from it ----------
//
// "Since I last looked" is a moment, not a commit: the data then may hold changes not committed yet. A moment is kept
// small as the commit it was on and the rows that differed from that commit's then (a Delta): the commit's rows with
// the delta applied are the data of that moment.

/** The rows of each table that differ from a base: those added or changed (as they are now), and the keys of those removed. */
export type Delta = Record<string, { rows: Row[]; gone: string[] }>;

/** What `to` holds that `from` does not: per table, the rows added or changed and the keys removed. */
export function rowDelta(schema: SchemaDescription, from: Tables, to: Tables): Delta {
  const delta: Delta = {};
  for (const name of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const table = schema.tables[name];
    if (!table || from[name] === to[name]) continue;
    const was = byKey(table, from[name]);
    const now = byKey(table, to[name]);
    const rows = [...now].filter(([key, row]) => { const old = was.get(key); return !old || JSON.stringify(old) !== JSON.stringify(row); }).map(([, row]) => row);
    const gone = [...was.keys()].filter((key) => !now.has(key));
    if (rows.length || gone.length) delta[name] = { rows, gone };
  }
  return delta;
}

/** A base's tables with a delta applied: the data of the moment the delta was taken. */
export function applyDelta(schema: SchemaDescription, base: Tables, delta: Delta): Tables {
  const out: Tables = { ...base };
  for (const [name, { rows, gone }] of Object.entries(delta)) {
    const table = schema.tables[name];
    if (!table) continue;
    const kept = byKey(table, base[name]);
    for (const key of gone) kept.delete(key);
    for (const row of rows) kept.set(rowKey(table, row), row);
    out[name] = [...kept.values()];
  }
  return out;
}
