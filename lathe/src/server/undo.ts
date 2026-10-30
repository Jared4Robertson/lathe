// Undo a turn (LA-PLT-UC19-R20): the Owner's chat shows what Claude changed in a turn and rolls it back in one click,
// never by editing files or git, but through the aggregates' own commands, in reverse. The plan is made from the
// product's rows before the turn (a snapshot the page asked the server to keep when the turn began), the rows now and
// the order Claude's own commands touched the records in:
//   a record the turn added      is removed by its kind's remove command;
//   a record the turn removed    is added again by its kind's add command, from its rows before;
//   a record the turn changed    is changed back by its kind's change command, each field the turn changed set to its old value.
// A record of a kind with no such command is refused, saying so. Each step runs in one write, so the aggregates' rules
// hold over all of it: a record something since depends on is refused with the reason, and nothing changes.
import { recordChanges, type RecordChange, type Tables } from '../changes.ts';
import { ALL_COMMANDS } from '../commands.ts';
import { compareIds } from '../platform/data/ids.ts';
import type { Row, Value } from '../platform/data/rows.ts';
import type { SchemaDescription } from '../platform/data/schema.ts';
import type { AnyCommand, Field } from '../platform/commands/definition.ts';

/** One command of the undo: its definition and input, and when it applies (the record is there, or is not). */
export interface UndoStep {
  definition: AnyCommand;
  input: Record<string, unknown>;
  /** The record it acts on. */
  id: string;
  /** `present`: it applies only while the record exists (a removal or a change; an earlier step may have removed it with its parent); `absent`: only while it does not (an add). */
  when: 'present' | 'absent';
}

/** An undo that cannot be made, with every reason. */
export class UndoRefusal extends Error {
  readonly reasons: string[];
  constructor(reasons: string[]) {
    super(reasons.join('\n'));
    this.reasons = reasons;
  }
}

const kebab = (table: string) => table.replaceAll('_', '-');
const commandNamed = (verb: string, kind: string): AnyCommand | undefined => ALL_COMMANDS.find((d) => d.name === `${verb}-${kebab(kind)}`);

const byKey = (rows: readonly Row[] | undefined, match: (r: Row) => boolean) => (rows ?? []).filter(match);

/** The IDs a record linked to by a relation in the rows (the relation's table, from `source_id` to `target_id`). */
const linksOf = (rows: Tables, relation: string, id: string): string[] =>
  byKey(rows[relation], (r) => r.source_id === id).map((r) => String(r.target_id));

/** The part rows a record owned in a table, in position order, as the columns the command takes. */
function partsOf(schema: SchemaDescription, rows: Tables, table: string, columns: readonly string[], id: string): Record<string, Value>[] {
  const owner = schema.tables[table]?.ownerColumn;
  if (!owner) return [];
  return byKey(rows[table], (r) => r[owner] === id)
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((r) => Object.fromEntries(columns.filter((c) => r[c] !== undefined).map((c) => [c, r[c]])));
}

/** A field's value for a record in the rows before the turn, or `undefined` when the record has none (a field the command may leave out). */
function oldValue(schema: SchemaDescription, field: Field, name: string, rows: Tables, kindTable: string, row: Row, id: string): { value: unknown } | { problem: string } | null {
  switch (field.kind) {
    case 'column': {
      if (field.table !== kindTable) return { problem: `${name} is in ${field.table}, not ${kindTable}` };
      const value = row[field.column];
      if (value !== undefined) return { value };
      return field.clearable ? { value: null } : field.required ? { problem: `${name} has no value to restore` } : null;
    }
    case 'id': {
      const [target] = linksOf(rows, name, id);
      return target !== undefined ? { value: target } : field.clearable ? { value: null } : null;
    }
    case 'ids':
      return { value: linksOf(rows, name, id) };
    case 'parts':
      return { value: partsOf(schema, rows, field.table, field.columns, id) };
    default:
      return { problem: `${name} cannot be read back from the rows` };
  }
}

/** The order the turn's commands touched the records in: a record's place is its last command's, one without takes its nearest parent's, and one with none comes last. */
function placeOf(id: string, order: readonly string[]): number {
  for (let at = order.length - 1; at >= 0; at--) if (order[at] === id) return at;
  let best = -1;
  let longest = 0;
  order.forEach((other, at) => {
    if (id.startsWith(`${other}-`) && other.length > longest) { longest = other.length; best = at; }
  });
  return best;
}

/**
 * The commands that roll the data back to the rows before the turn, last change first. `order` is the IDs Claude's
 * commands named, in the order it ran them. Throws an UndoRefusal with every record that cannot be rolled back.
 */
export function planUndo(schema: SchemaDescription, before: Tables, now: Tables, order: readonly string[]): UndoStep[] {
  const changes = recordChanges(schema, before, now);
  const reasons: string[] = [];
  const steps: { step: UndoStep; place: number; rank: number }[] = [];
  const add = (step: UndoStep, rank: number) => steps.push({ step, place: placeOf(step.id, order), rank });

  for (const c of changes) {
    const kindTable = c.kind;
    const verb = c.change === 'added' ? 'remove' : c.change === 'removed' ? 'add' : 'change';
    const definition = commandNamed(verb, kindTable);
    if (!definition) { reasons.push(`${c.id}: there is no ${verb}-${kebab(kindTable)} command to put it back.`); continue; }
    if (c.change === 'added') {
      const keys = Object.keys(definition.input);
      if (keys.length !== 1 || keys[0] !== 'id') { reasons.push(`${c.id}: ${definition.name} takes more than the ID, so it cannot be undone.`); continue; }
      add({ definition, input: { id: c.id }, id: c.id, when: 'present' }, 2);
      continue;
    }
    const row = byKey(before[kindTable], (r) => r.id === c.id)[0];
    if (!row) { reasons.push(`${c.id}: its rows before the turn are not known.`); continue; }
    const input: Record<string, unknown> = { id: c.id };
    const problems: string[] = [];
    if (c.change === 'removed') {
      for (const [name, field] of Object.entries(definition.input)) {
        if (name === 'id') continue;
        const got = oldValue(schema, field, name, before, kindTable, row, c.id);
        if (got && 'problem' in got) problems.push(got.problem);
        else if (got && !(Array.isArray(got.value) && got.value.length === 0)) input[name] = got.value;
        else if (field.required) problems.push(`${name} has no value to restore`);
      }
    } else {
      problems.push(...changedFields(schema, c, definition, before, kindTable, row, input));
    }
    if (problems.length) { reasons.push(`${c.id}: ${problems.join('; ')}.`); continue; }
    if (c.change === 'removed') {
      input.id = c.id;
      add({ definition, input, id: c.id, when: 'absent' }, 0);
    } else {
      add({ definition, input, id: c.id, when: 'present' }, 1);
    }
  }
  if (reasons.length) throw new UndoRefusal(reasons);
  // Last command first; among records of one place, those put back (parents first), then changed back, then removed (children first).
  steps.sort((a, b) => b.place - a.place || a.rank - b.rank || (a.rank === 2 ? compareIds(b.step.id, a.step.id) : compareIds(a.step.id, b.step.id)));
  return steps.map((s) => s.step);
}

/** The change command's input for a changed record: each field the turn changed, set to its old value; the reasons any field cannot be. */
function changedFields(schema: SchemaDescription, c: RecordChange, definition: AnyCommand, before: Tables, kindTable: string, row: Row, input: Record<string, unknown>): string[] {
  const problems: string[] = [];
  const set = (name: string, what: string) => {
    const field = definition.input[name];
    if (!field) { problems.push(`${definition.name} cannot change ${what}`); return; }
    const got = oldValue(schema, field, name, before, kindTable, row, c.id);
    if (got && 'problem' in got) problems.push(got.problem);
    else if (got) input[name] = got.value;
    else problems.push(`${what} had no value before and cannot be cleared`);
  };
  for (const f of c.fields) set(f.name, f.name);
  for (const l of [...c.links.added, ...c.links.removed]) if (!(l.relation in input)) set(l.relation, `its ${l.relation} links`);
  for (const p of c.parts) {
    const name = Object.entries(definition.input).find(([, field]) => field.kind === 'parts' && field.table === p.table)?.[0];
    if (name === undefined) problems.push(`${definition.name} cannot change its ${p.table} rows`);
    else if (!(name in input)) set(name, `its ${p.table} rows`);
  }
  return problems;
}
