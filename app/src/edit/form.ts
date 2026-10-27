import type { ColumnDescription, ColumnKind, SchemaDescription, TableDescription } from '../../../lathe/src/store/schema';
import type { Command } from '../../../lathe/src/store/store';
import { kindOrder, parentColumns, partsOf, partTablesOf, type Row, type SpecIndex, type SpecRecord, type Value } from '../specs/data';
import { TEXT_COLUMNS } from '../specs/RecordText';

// The record form, generated from the schema description (pure logic, tested directly): a kind's
// columns as typed inputs, its parent as a choice among the records of its allowed parent kinds,
// the links it may start as choices among their valid targets, and the part rows it owns. A draft
// holds every input as text; commandsFor turns a draft into the store's commands, one write.

/** How a column is edited. */
export type InputKind = 'line' | 'text' | 'integer' | 'boolean' | 'choice' | 'date' | 'list';

export interface FormField {
  name: string;
  label: string;
  input: InputKind;
  /** The column's type, which decides the value the text becomes. */
  type: ColumnKind;
  required: boolean;
  description: string;
  /** For a choice: its values in order. */
  values?: string[];
}

const label = (name: string) => name.replaceAll('_', ' ');

/** The input a column gets: an enum is a choice, a whole number a number, true/false a check (or a choice when it may be left out). */
export function fieldOf(column: ColumnDescription): FormField {
  const base = { name: column.name, label: label(column.name), type: column.kind, required: column.required, description: column.description ?? '' };
  switch (column.kind) {
    case 'enum': return { ...base, input: 'choice', values: column.values ?? [] };
    case 'integer': return { ...base, input: 'integer' };
    case 'boolean': return column.required ? { ...base, input: 'boolean' } : { ...base, input: 'choice', values: ['true', 'false'] };
    case 'date': return { ...base, input: 'date' };
    case 'text_list': return { ...base, input: 'list' };
    case 'text': return { ...base, input: TEXT_COLUMNS.has(column.name) ? 'text' : 'line' };
  }
}

/** A kind's own fields: every column of its table but its ID and its parent columns, in the table's order. */
export function formFields(schema: SchemaDescription, kind: string): FormField[] {
  const skip = new Set(['id', ...parentColumns(schema, kind)]);
  return (schema.tables[kind]?.columns ?? []).filter((c) => !skip.has(c.name)).map(fieldOf);
}

/** The part tables a kind's records own, each with the columns a person fills (not the owner, not a position the form keeps). */
export interface PartForm {
  table: string;
  label: string;
  description: string;
  fields: FormField[];
  /** The rows are numbered by this column, from 1, in the order they are listed. */
  position: string | null;
}

export function partForms(schema: SchemaDescription, kind: string): PartForm[] {
  return partTablesOf(schema, kind)
    .map((name) => schema.tables[name])
    .map((t) => {
      const position = t.primaryKey.includes('position') ? 'position' : null;
      return {
        table: t.name,
        label: label(t.name),
        description: t.description ?? '',
        position,
        fields: t.columns.filter((c) => c.name !== t.ownerColumn && c.name !== position).map(fieldOf),
      };
    });
}

/** The records a record of this kind may sit under, in the same product, grouped by kind, nearest kind first. */
export function parentChoices(index: SpecIndex, kind: string, product: string | null, self?: string): { kind: string; records: SpecRecord[] }[] {
  const parents = index.workspace.schema.kinds[kind]?.parents ?? [];
  const below = self ? descendantsOf(index, self) : new Set<string>();
  return parents.map((p) => ({
    kind: p.kind,
    records: index.workspace.records
      .filter((r) => r.kind === p.kind && r.id !== self && !below.has(r.id) && (p.kind === 'product' ? !product || r.id === product : r.product === product))
      .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })),
  })).filter((g) => g.records.length > 0);
}

function descendantsOf(index: SpecIndex, id: string): Set<string> {
  const found = new Set<string>();
  const walk = (at: string) => { for (const c of index.children.get(at) ?? []) if (!found.has(c.id)) { found.add(c.id); walk(c.id); } };
  walk(id);
  return found;
}

/** A relation a record of this kind may start, with the kinds it may point at ('*' for any). */
export interface LinkForm {
  relation: string;
  label: string;
  description: string;
  targets: string[];
}

export function linkForms(index: SpecIndex, kind: string): LinkForm[] {
  return Object.values(index.workspace.schema.relations)
    .filter((r) => r.pairs.some((p) => p.source === kind))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => ({
      relation: r.name,
      label: r.forwardLabel,
      description: r.description ?? '',
      targets: [...new Set(r.pairs.filter((p) => p.source === kind).map((p) => p.target))].sort(kindOrder(index.workspace.schema)),
    }));
}

/** The records a link may point at: of its target kinds, in the same product, not the record itself. */
export function linkTargets(index: SpecIndex, link: LinkForm, product: string | null, self: string | null): SpecRecord[] {
  const any = link.targets.includes('*');
  return index.workspace.records
    .filter((r) => (any || link.targets.includes(r.kind)) && r.id !== self && r.product === product)
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

/** The kinds whose records may sit under a record of this kind. */
export const childKinds = (schema: SchemaDescription, kind: string) =>
  Object.values(schema.kinds).filter((k) => k.parents.some((p) => p.kind === kind)).map((k) => k.name).sort(kindOrder(schema));

// ---------- IDs ----------

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The ID a new record of the kind under this parent should take, from the kind's ID convention: the
 * next free number (the convention's `<nn>`), or the fixed start of a named ID (a pattern's `<P>-PAT-`)
 * for the person to finish; '' when the convention says nothing usable.
 */
export function suggestId(index: SpecIndex, kind: string, parentId: string | null): string {
  const pattern = index.workspace.schema.kinds[kind]?.idPattern;
  if (!pattern) return '';
  const parent = parentId ? index.byId.get(parentId) : undefined;
  const product = parent ? (parent.kind === 'product' ? parent.id : parent.product) : null;
  const domain = parent ? (parent.kind === 'domain' ? parent.id : parent.domain) : null;
  const parentLabel = parent ? (index.kinds.get(parent.kind)?.label ?? parent.kind).toLowerCase() : '';
  // Alternatives are joined by "or" outside the placeholders ("<view, endpoint, flow, API or integration>-R<nn>, or <P>-<D>-IR<nn>").
  for (const alternative of pattern.split(/,? or (?![^<]*>)/)) {
    // <D> is the domain's whole ID, which starts with the product's: <P>-<D> is written as the domain's ID.
    // A new domain's own <D> is the part the person names.
    const own = kind === 'domain' ? alternative.replace('<D>', '<name>') : alternative;
    const shape = own.replace(/\s+under the .*$/, '').replace('<P>-<D>', '<D>').trim();
    let unresolved = false;
    const start = shape.replace(/<([^>]+)>/g, (whole, name: string) => {
      if (name === 'P') { if (!product) unresolved = true; return product ?? ''; }
      if (name === 'D') { if (!domain) unresolved = true; return domain ?? ''; }
      if (name === 'nn' || name === 'n' || name === 'name') return whole;
      // A placeholder naming the parent's kind ("<use case>", "<view, endpoint, flow, API or integration>").
      if (parent && name.toLowerCase().split(/,\s*|\s+or\s+/).some((n) => n.trim() === parentLabel || n.trim() === parent.kind)) return parent.id;
      unresolved = true;
      return '';
    });
    if (unresolved) continue;
    const numbered = /^(.*)<(nn?)>$/.exec(start);
    if (numbered) {
      const [, prefix, digits] = numbered;
      const taken = new RegExp(`^${escape(prefix)}(\\d+)$`);
      let max = 0;
      for (const id of index.byId.keys()) { const m = taken.exec(id); if (m) max = Math.max(max, Number(m[1])); }
      return prefix + String(max + 1).padStart(digits.length, '0');
    }
    return start.replace(/<name>$/, '');
  }
  return '';
}

// ---------- Drafts ----------

/** What the form holds: every input as text. */
export interface Draft {
  id: string;
  values: Record<string, string>;
  /** The chosen parent's ID, or '' for none. */
  parent: string;
  /** Each relation's targets. */
  links: Record<string, string[]>;
  /** Each part table's rows, every column as text. */
  parts: Record<string, Record<string, string>[]>;
}

/** A value as the form shows it. */
export function valueText(value: Value | undefined): string {
  if (value === undefined) return '';
  if (Array.isArray(value)) return value.join('\n');
  return String(value);
}

/** The draft of an existing record: its row, parent, links and parts as they are. */
export function draftOf(index: SpecIndex, record: SpecRecord): Draft {
  const { schema } = index.workspace;
  const values = Object.fromEntries(formFields(schema, record.kind).map((f) => [f.name, valueText(record.row[f.name])]));
  const links: Record<string, string[]> = {};
  for (const l of linkForms(index, record.kind)) {
    links[l.relation] = (index.outgoing.get(record.id) ?? []).filter((x) => x.relation === l.relation).map((x) => x.target);
  }
  const parts: Record<string, Record<string, string>[]> = {};
  for (const p of partForms(schema, record.kind)) {
    parts[p.table] = partsOf(index, record.id, p.table).map((row) => Object.fromEntries(p.fields.map((f) => [f.name, valueText(row[f.name])])));
  }
  return { id: record.id, values, parent: record.parent ?? '', links, parts };
}

/** The draft of a new record of the kind under a parent: empty fields (a required true/false starts false), a suggested ID. */
export function newDraft(index: SpecIndex, kind: string, parent: string | null): Draft {
  const { schema } = index.workspace;
  const values = Object.fromEntries(formFields(schema, kind).map((f) => [f.name, f.input === 'boolean' ? 'false' : '']));
  return {
    id: suggestId(index, kind, parent),
    values,
    parent: parent ?? '',
    links: Object.fromEntries(linkForms(index, kind).map((l) => [l.relation, []])),
    parts: Object.fromEntries(partForms(schema, kind).map((p) => [p.table, []])),
  };
}

/** Why a field's text is not a value of its type, or null when it is (or is empty). */
export function fieldProblem(field: FormField, text: string): string | null {
  const t = text.trim();
  if (t === '') return field.required ? `${field.label[0].toUpperCase()}${field.label.slice(1)} is required.` : null;
  if (field.input === 'integer' && !/^-?\d+$/.test(t)) return 'Give a whole number.';
  if (field.input === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(t)) return 'Give a date written YYYY-MM-DD.';
  if (field.input === 'choice' && !(field.values ?? []).includes(t)) return `Choose one of ${(field.values ?? []).join(', ')}.`;
  return null;
}

/** A field's text as the value the store takes, or null for none. */
export function fieldValue(field: FormField, text: string): Value | null {
  const t = field.input === 'text' ? text.replace(/\s+$/, '') : text.trim();
  if (t.trim() === '') return null;
  switch (field.type) {
    case 'integer': return Number(t);
    case 'boolean': return t === 'true';
    case 'text_list': return t.split('\n').map((x) => x.trim()).filter(Boolean);
    default: return t;
  }
}

/** Every problem the form can see before it writes, by input: `field:<name>`, `id`, `parent`, `part:<table>:<row>:<name>`. */
export function draftProblems(index: SpecIndex, kind: string, draft: Draft, adding: boolean): Map<string, string> {
  const { schema } = index.workspace;
  const problems = new Map<string, string>();
  if (adding) {
    if (!draft.id.trim()) problems.set('id', 'Give the record an ID.');
    else if (index.byId.has(draft.id.trim())) problems.set('id', `${draft.id.trim()} is already a record.`);
  }
  for (const f of formFields(schema, kind)) {
    const p = fieldProblem(f, draft.values[f.name] ?? '');
    if (p) problems.set(`field:${f.name}`, p);
  }
  if ((schema.kinds[kind]?.parents.length ?? 0) > 0 && !draft.parent) problems.set('parent', 'Choose where it sits.');
  for (const part of partForms(schema, kind)) {
    (draft.parts[part.table] ?? []).forEach((row, i) => {
      for (const f of part.fields) {
        const p = fieldProblem(f, row[f.name] ?? '');
        if (p) problems.set(`part:${part.table}:${i}:${f.name}`, p);
      }
    });
  }
  return problems;
}

/** Where a command came from in the form, so a refusal shows beside it: 'fields', 'parent', `links:<relation>` or `parts:<table>`. */
export type CommandPlace = string;

/**
 * The parent columns a new record under this parent takes, as the store's move fills them: the
 * parent's own column, then each other parent column that is required or shares a foreign key
 * with it, from the parent's ancestry (a domain rule under an entity takes its aggregate and domain;
 * an interaction requirement under an endpoint takes its domain, not its API).
 */
export function parentValues(index: SpecIndex, kind: string, parentId: string): Row {
  const { schema } = index.workspace;
  const parents = schema.kinds[kind]?.parents ?? [];
  const table = schema.tables[kind];
  const direct = parents.find((p) => p.kind === index.byId.get(parentId)?.kind);
  if (!direct || !table) return {};
  const ancestry = new Map<string, string>();
  for (let at = index.byId.get(parentId); at && !ancestry.has(at.kind); at = at.parent ? index.byId.get(at.parent) : undefined) ancestry.set(at.kind, at.id);
  const row: Row = { [direct.column]: parentId };
  for (const p of parents) {
    if (p === direct) continue;
    const id = ancestry.get(p.kind);
    const required = table.columns.find((c) => c.name === p.column)?.required ?? false;
    const shared = table.foreignKeys.some((f) => f.columns.includes(p.column) && f.columns.includes(direct.column));
    if (id && (required || shared)) row[p.column] = id;
  }
  return row;
}

function partRows(table: TableDescription, part: PartForm, owner: string, rows: Record<string, string>[]): Row[] {
  return rows.map((texts, i) => {
    const row: Row = { [table.ownerColumn!]: owner };
    if (part.position) row[part.position] = i + 1;
    for (const f of part.fields) {
      const v = fieldValue(f, texts[f.name] ?? '');
      if (v !== null) row[f.name] = v;
    }
    return row;
  });
}

const sameRows = (a: Row[], b: Row[]) => JSON.stringify(a) === JSON.stringify(b);
/** A part row's key, as the store takes it. */
const keyOf = (table: TableDescription, row: Row): Record<string, Value> => Object.fromEntries(table.primaryKey.map((k) => [k, row[k]]));

/**
 * The commands that make the record what the draft says, in one write: for a new record its row
 * (with its parent columns), its parts and its links; for an existing one the changed columns, a
 * move when its parent changed, the links taken away and added, and each part table whose rows
 * changed written again. Each command's place says which part of the form it came from.
 */
export function commandsFor(index: SpecIndex, kind: string, draft: Draft, existing: SpecRecord | null): { commands: Command[]; places: CommandPlace[] } {
  const { schema } = index.workspace;
  const commands: Command[] = [];
  const places: CommandPlace[] = [];
  const push = (command: Command, place: CommandPlace) => { commands.push(command); places.push(place); };
  const fields = formFields(schema, kind);
  const id = existing ? existing.id : draft.id.trim();

  if (!existing) {
    const row: Row = { id, ...(draft.parent ? parentValues(index, kind, draft.parent) : {}) };
    for (const f of fields) {
      const v = fieldValue(f, draft.values[f.name] ?? '');
      if (v !== null) row[f.name] = v;
    }
    push({ op: 'add', table: kind, row }, 'fields');
  } else {
    const changes: Record<string, Value | null> = {};
    for (const f of fields) {
      const v = fieldValue(f, draft.values[f.name] ?? '');
      const was = existing.row[f.name] ?? null;
      if (JSON.stringify(v) !== JSON.stringify(was)) changes[f.name] = v;
    }
    if (Object.keys(changes).length > 0) push({ op: 'set', table: kind, key: id, changes }, 'fields');
    if (draft.parent && draft.parent !== (existing.parent ?? '')) push({ op: 'move', id, parent: draft.parent }, 'parent');
  }

  for (const link of linkForms(index, kind)) {
    const before = existing ? (index.outgoing.get(id) ?? []).filter((l) => l.relation === link.relation).map((l) => l.target) : [];
    const after = draft.links[link.relation] ?? [];
    for (const t of before) if (!after.includes(t)) push({ op: 'unlink', relation: link.relation, source: id, target: t }, `links:${link.relation}`);
    for (const t of after) if (!before.includes(t)) push({ op: 'link', relation: link.relation, source: id, target: t }, `links:${link.relation}`);
  }

  for (const part of partForms(schema, kind)) {
    const table = schema.tables[part.table];
    const before = existing ? partsOf(index, id, part.table) : [];
    const after = partRows(table, part, id, draft.parts[part.table] ?? []);
    if (sameRows(before, after)) continue;
    for (const row of before) push({ op: 'remove', table: part.table, key: keyOf(table, row) }, `parts:${part.table}`);
    for (const row of after) push({ op: 'add', table: part.table, row }, `parts:${part.table}`);
  }
  return { commands, places };
}

/** What still names a record, so removing it would be refused: its children, the links into it, and rows of other records' parts that name it. */
export function referrersOf(index: SpecIndex, id: string): { id: string; how: string }[] {
  const found: { id: string; how: string }[] = [];
  for (const c of index.children.get(id) ?? []) found.push({ id: c.id, how: 'sits under it' });
  for (const l of index.incoming.get(id) ?? []) found.push({ id: l.source, how: `links to it (${l.relation.replaceAll('_', ' ')})` });
  for (const p of index.workspace.parts) {
    if (p.owner === id) continue;
    if (Object.entries(p.row).some(([column, v]) => column !== index.workspace.schema.tables[p.table]?.ownerColumn && v === id)) found.push({ id: p.owner, how: `names it in a ${p.table.replaceAll('_', ' ')} row` });
  }
  return found;
}

/** What goes with a record when it is removed: its part rows and the links it starts. */
export function removedWith(index: SpecIndex, id: string): { parts: number; links: number } {
  let parts = 0;
  for (const rows of index.parts.get(id)?.values() ?? []) parts += rows.length;
  return { parts, links: (index.outgoing.get(id) ?? []).length };
}
