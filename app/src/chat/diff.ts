import type { SpecIndex } from '../specs/data';

// The records a turn of the chat changed (LA-PLT-UC19-R03): the spec before the turn against the
// spec after it, by record. Whatever wrote the change (Lathe's MCP tools, the CLI, a hand in the
// app), the store's records say what it was: a record added or removed, or its title, fields, part
// rows and links changed, each field with its value before and after.

export interface FieldChange { field: string; before: string | null; after: string | null }
export interface RecordDiff {
  id: string;
  kind: string;
  title: string;
  change: 'added' | 'removed' | 'changed';
  fields: FieldChange[];
}

type Rows = Record<string, unknown>;
/** A record's columns besides its ID and title. */
const fieldsOf = (index: SpecIndex, id: string): Rows => {
  const row = index.byId.get(id)?.row;
  if (!row) return {};
  const { id: _id, title: _title, ...rest } = row as Rows;
  return rest;
};
/** A record's part rows, by part table. */
const partsOf = (index: SpecIndex, id: string): Record<string, unknown[]> => Object.fromEntries(index.parts.get(id) ?? []);
const show = (v: unknown): string | null => (v === undefined || v === null ? null : typeof v === 'string' ? v : JSON.stringify(v));
const linksOf = (index: SpecIndex, id: string) => new Set((index.outgoing.get(id) ?? []).map((l) => `${l.relation} → ${l.target}`));

/** What changed in one record's fields, parts and links. */
function fieldChanges(before: SpecIndex, after: SpecIndex, id: string): FieldChange[] {
  const a = before.byId.get(id);
  const b = after.byId.get(id);
  const out: FieldChange[] = [];
  const title = (r: typeof a) => r?.title ?? null;
  if (title(a) !== title(b)) out.push({ field: 'title', before: title(a), after: title(b) });
  const fa = fieldsOf(before, id);
  const fb = fieldsOf(after, id);
  const fields = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  for (const f of [...fields].sort()) {
    const was = show(fa[f]);
    const now = show(fb[f]);
    if (was !== now) out.push({ field: f.replaceAll('_', ' '), before: was, after: now });
  }
  const pa = partsOf(before, id);
  const pb = partsOf(after, id);
  const parts = new Set([...Object.keys(pa), ...Object.keys(pb)]);
  for (const p of [...parts].sort()) {
    const was = (pa[p] ?? []).map((r) => JSON.stringify(r));
    const now = (pb[p] ?? []).map((r) => JSON.stringify(r));
    const gone = was.filter((r) => !now.includes(r));
    const came = now.filter((r) => !was.includes(r));
    if (gone.length || came.length) out.push({ field: p.replaceAll('_', ' '), before: gone.length ? gone.join('\n') : null, after: came.length ? came.join('\n') : null });
  }
  const wasLinks = linksOf(before, id);
  const nowLinks = linksOf(after, id);
  const lost = [...wasLinks].filter((l) => !nowLinks.has(l));
  const gained = [...nowLinks].filter((l) => !wasLinks.has(l));
  if (lost.length || gained.length) out.push({ field: 'links', before: lost.length ? lost.join('\n') : null, after: gained.length ? gained.join('\n') : null });
  return out;
}

/** The records added, removed or changed from one spec to the next, in ID order. */
export function diffIndexes(before: SpecIndex, after: SpecIndex): RecordDiff[] {
  if (before === after) return [];
  const ids = new Set([...before.byId.keys(), ...after.byId.keys()]);
  const out: RecordDiff[] = [];
  for (const id of ids) {
    const a = before.byId.get(id);
    const b = after.byId.get(id);
    const record = (b ?? a)!;
    if (a && b && a.row === b.row && before.parts.get(id) === after.parts.get(id) && before.outgoing.get(id) === after.outgoing.get(id)) continue;
    const fields = fieldChanges(before, after, id);
    if (a && b && fields.length === 0) continue;
    out.push({ id, kind: record.kind, title: record.title, change: !a ? 'added' : !b ? 'removed' : 'changed', fields });
  }
  return out.sort((x, y) => x.id.localeCompare(y.id, 'en', { numeric: true }));
}
