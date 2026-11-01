import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import type { ColumnDescription } from '../../../lathe/src/platform/data/schema';
import type { StoreProblem, Value, WriteAnswer } from '../../../lathe/src/server/contract';
import { Button } from '../components/Button';
import { navigate } from '../router';
import { useAnnounce } from '../shell/commands';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { RecordLink } from '../specs/parts';
import { ColumnField, IdField, IdsField, PartsField, Refusal, TextsField, columnValue, problemText, textsValue, type Choice } from './fields';

// The form an aggregate's editor sends one command from (LA-PAT-FIELD-INPUTS): its heading, its fields drawn from the
// shared field inputs in the order the editor gives, Save and Cancel, and the command's refusal with every reason at its
// top, taking focus, the draft kept. It knows no kind and no command: the editor says which fields, in what order, and
// what the submit sends.

/** A form's first input, which takes focus when it opens. */
export type FirstInput = RefObject<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement | null>;

/** A form that sends one command: its heading, its fields, Save and Cancel, and the refusal when it is refused. */
export function CommandForm({ eyebrow, title, submit, saveLabel, onCancel, children }: {
  eyebrow: string;
  title: string;
  /** Sends the command, or answers null when there is nothing to send. */
  submit: () => Promise<WriteAnswer | null>;
  saveLabel: string;
  onCancel: () => void;
  children: (first: FirstInput) => ReactNode;
}) {
  const formId = useId();
  const first = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  const [refusal, setRefusal] = useState<{ error: string; problems: StoreProblem[] } | null>(null);
  const [tries, setTries] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => { first.current?.focus(); }, []);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const answer = await submit();
    setSaving(false);
    setTries((t) => t + 1);
    if (answer && !answer.ok) setRefusal({ error: answer.error, problems: answer.problems });
  };
  return (
    <form className="record-form" aria-labelledby={`${formId}-heading`} onSubmit={onSubmit} noValidate>
      <header className="record-form-head">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={`${formId}-heading`}>{title}</h2>
      </header>
      {refusal && (
        <Refusal title="The change was refused. Nothing was saved." reasons={refusal.problems.length > 0 ? refusal.problems.map(problemText) : [refusal.error]} focusKey={tries} />
      )}
      <fieldset className="form-group">
        <legend>Fields</legend>
        {children(first)}
      </fieldset>
      <div className="record-form-actions">
        <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : saveLabel}</Button>
        <Button onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </form>
  );
}

/**
 * Add's or Change's fields for one kind, sharing their hints: Add's without the parent the form sends itself, Change's
 * without the record's key (its ID, unless the kind is keyed otherwise).
 */
export function addOrChangeFields<A extends InputFields, C extends InputFields>(adding: boolean, add: A, parent: keyof A & string, change: C, hints: { [K in keyof A | keyof C]?: FieldHint } = {}, key = 'id' as keyof C & string): FieldSpec[] {
  return adding ? formFields(add, [parent], hints) : formFields(change, [key], hints);
}

/** A form's draft: each field's text (a list of texts one per line), each list of IDs, and each list of part rows. */
export interface Draft {
  text: Record<string, string>;
  ids: Record<string, string[]>;
  parts: Record<string, Record<string, string>[]>;
}

export const emptyDraft = (): Draft => ({ text: {}, ids: {}, parts: {} });

/**
 * One field of a form, by what it is: a column of a table, a list of texts, a record it names, a list of them, or a list
 * of part rows; clearable when Change may clear it with null. An editor draws them from its command's input
 * (formFields); only a product's own kind, declared in its data, builds them from its declaration.
 */
export type FieldSpec = { field: string; clearable?: boolean } & (
  | { column: string; table: string; label?: string; long?: boolean; required?: boolean }
  | { label: string; description: string; texts: true; required?: boolean }
  | { label: string; description: string; one: Choice[]; required?: boolean }
  | { label: string; description: string; many: Choice[] }
  | { label: string; description: string; table: string; columns: readonly string[] });

/** One field of a command's input, as its definition gives it (generated into each slice's fields.generated.ts). */
export type InputField = { required: boolean; clearable: boolean } & (
  | { kind: 'column'; table: string; column: string }
  | { kind: 'id' | 'ids' | 'texts' | 'values' | 'links'; description: string }
  | { kind: 'parts'; table: string; columns: readonly string[]; description: string });

/** A command's input, field by field, in its definition's order. */
export type InputFields = Readonly<Record<string, InputField>>;

/**
 * What a form adds to a field that its command's input cannot say: its label where the field's name does not read
 * well, long text, the records a field naming one or more may choose from, and a description that names the record
 * at hand.
 */
export interface FieldHint {
  label?: string;
  long?: true;
  choices?: Choice[];
  description?: string;
}

/** The hint for a field of long text. */
export const LONG = { long: true } as const;

/** A field's name as a label: has_one is Has one. */
const labelOf = (field: string) => field.charAt(0).toUpperCase() + field.slice(1).replaceAll('_', ' ');

/**
 * A command's form fields, in its input's order, from its definition's input: each field's kind, description,
 * whether it is required and whether Change may clear it. `without` names the fields the form does not show (the key
 * or parent it sends itself); `hints` adds labels, long text and choices.
 */
export function formFields<F extends InputFields>(input: F, without: readonly (keyof F & string)[], hints: { [K in keyof F]?: FieldHint } = {}): FieldSpec[] {
  return Object.entries(input).filter(([field]) => !without.includes(field)).map(([field, f]): FieldSpec => {
    const hint: FieldHint = hints[field] ?? {};
    const shared = { field, clearable: f.clearable };
    const label = hint.label ?? labelOf(field);
    switch (f.kind) {
      case 'column':
        return { ...shared, column: f.column, table: f.table, ...(hint.label ? { label: hint.label } : {}), ...(hint.long ? { long: true } : {}), ...(f.required ? { required: true } : {}) };
      case 'texts':
        return { ...shared, label, description: hint.description ?? f.description, texts: true, required: f.required };
      case 'id':
        return { ...shared, label, description: hint.description ?? f.description, one: hint.choices ?? [], required: f.required };
      case 'ids':
        return { ...shared, label, description: hint.description ?? f.description, many: hint.choices ?? [] };
      case 'parts':
        return { ...shared, label, description: hint.description ?? f.description, table: f.table, columns: f.columns };
      default:
        throw new Error(`${field} is a product's declared ${f.kind}: its form builds it from the declaration`);
    }
  });
}

/** The column of a table, as the schema describes it. */
export function columnOf(index: RecordIndex, table: string, name: string): ColumnDescription {
  const found = index.meta.columns[table]?.find((c) => c.name === name);
  return found ?? { name, sqlType: 'VARCHAR', kind: 'text', required: false, description: null };
}

/** The fields of a form, drawn from the shared inputs in the order given; the first takes focus. */
export function Fields({ index, specs, draft, setDraft, first }: {
  index: RecordIndex;
  specs: FieldSpec[];
  draft: Draft;
  setDraft: (change: (d: Draft) => Draft) => void;
  first: FirstInput;
}) {
  const formId = useId();
  return (
    <>
      {specs.map((spec, at) => {
        const id = `${formId}-field-${spec.field}`;
        const ref = at === 0 ? first : undefined;
        if ('columns' in spec) {
          return (
            <PartsField key={spec.field} id={id} label={spec.label} description={spec.description}
              columns={spec.columns.map((c) => columnOf(index, spec.table, c))} rows={draft.parts[spec.field] ?? []}
              onChange={(rows) => setDraft((d) => ({ ...d, parts: { ...d.parts, [spec.field]: rows } }))} />
          );
        }
        if ('column' in spec) {
          const column = columnOf(index, spec.table, spec.column);
          return (
            <ColumnField key={spec.field} id={id} column={column} label={spec.label ?? (spec.field === 'id' ? 'ID' : spec.column.replaceAll('_', ' '))} long={spec.long}
              required={spec.required ?? column.required} value={draft.text[spec.field] ?? ''} inputRef={ref}
              onChange={(text) => setDraft((d) => ({ ...d, text: { ...d.text, [spec.field]: text } }))} />
          );
        }
        if ('texts' in spec) {
          return (
            <TextsField key={spec.field} id={id} label={spec.label} description={spec.description} required={spec.required} inputRef={ref}
              value={draft.text[spec.field] ?? ''} onChange={(text) => setDraft((d) => ({ ...d, text: { ...d.text, [spec.field]: text } }))} />
          );
        }
        if ('one' in spec) {
          return (
            <IdField key={spec.field} id={id} label={spec.label} description={spec.description} choices={spec.one} required={spec.required} inputRef={ref}
              value={draft.text[spec.field] ?? ''} onChange={(value) => setDraft((d) => ({ ...d, text: { ...d.text, [spec.field]: value } }))} />
          );
        }
        return (
          <IdsField key={spec.field} id={id} label={spec.label} description={spec.description} choices={spec.many} ids={draft.ids[spec.field] ?? []}
            renderId={(target) => <RecordLink index={index} id={target} />}
            onChange={(ids) => setDraft((d) => ({ ...d, ids: { ...d.ids, [spec.field]: ids } }))} />
        );
      })}
    </>
  );
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** A stored value as the text its input holds: '' for none, a list's items one per line. */
const cellText = (value: unknown): string => (value === undefined || value === null ? '' : Array.isArray(value) ? value.join('\n') : String(value));

/** A part row's columns as the text their inputs hold, a list column one item per line. */
const partText = (columns: readonly string[], row: Record<string, unknown>): Record<string, string> => Object.fromEntries(columns.map((c) => [c, cellText(row[c])]));

/** A part row's text as its columns' values, each left out when empty. */
function partValue(index: RecordIndex, spec: { table: string; columns: readonly string[] }, row: Record<string, string>): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const name of spec.columns) {
    const value = columnValue(columnOf(index, spec.table, name), row[name] ?? '');
    if (value !== undefined) out[name] = value;
  }
  return out;
}

/** A field's value from the draft: the column's value, the list of texts, the ID it names, the list of IDs, or the part rows; undefined when empty. */
export function draftValue(index: RecordIndex, spec: FieldSpec, draft: Draft): Value | Record<string, Value>[] | undefined {
  if ('columns' in spec) return (draft.parts[spec.field] ?? []).map((row) => partValue(index, spec, row));
  if ('many' in spec) return draft.ids[spec.field] ?? [];
  const text = draft.text[spec.field] ?? '';
  if ('texts' in spec) return textsValue(text);
  if ('column' in spec) return columnValue(columnOf(index, spec.table, spec.column), text);
  return text.trim() || undefined;
}

/**
 * The draft of a record's current values, by field: each column's text, each list of texts one item per line, each list
 * of IDs and each list of part rows (a part row's list column one item per line too).
 */
export function draftOf(specs: FieldSpec[], current: Record<string, unknown>): Draft {
  const draft = emptyDraft();
  for (const spec of specs) {
    const value = current[spec.field];
    if ('columns' in spec) draft.parts[spec.field] = ((value ?? []) as Record<string, unknown>[]).map((row) => partText(spec.columns, row));
    else if ('many' in spec) draft.ids[spec.field] = [...((value ?? []) as string[])];
    else draft.text[spec.field] = cellText(value);
  }
  return draft;
}

/**
 * A Change command's input: the record's key and each field whose value differs from the current one. A field
 * emptied is sent as null where the command may clear it, and otherwise as '' so the command refuses it with its reason.
 */
export function changeInput(index: RecordIndex, specs: FieldSpec[], draft: Draft, current: Record<string, unknown>, key: Record<string, unknown>): Record<string, unknown> {
  const input: Record<string, unknown> = { ...key };
  for (const spec of specs) {
    const value = draftValue(index, spec, draft);
    // Part rows are compared by the columns the form shows, as their draft holds them.
    // A list of texts is compared in order, none held as an empty list.
    const was = 'columns' in spec ? ((current[spec.field] ?? []) as Record<string, unknown>[]).map((row) => partValue(index, spec, partText(spec.columns, row)))
      : 'texts' in spec ? current[spec.field] ?? [] : current[spec.field];
    if ('many' in spec ? same([...(value as string[])].sort(), [...((was ?? []) as string[])].sort()) : same(value, was)) continue;
    input[spec.field] = value ?? (spec.clearable ? null : '');
  }
  return input;
}

/** An Add command's input: its parent's field and every field given, an empty list left out. */
export function addInput(index: RecordIndex, specs: FieldSpec[], draft: Draft, parent: Record<string, unknown>): Record<string, unknown> {
  const input: Record<string, unknown> = { ...parent };
  for (const spec of specs) {
    const value = draftValue(index, spec, draft);
    if (value === undefined || (Array.isArray(value) && value.length === 0)) continue;
    input[spec.field] = value;
  }
  return input;
}

/**
 * Remove: asks first, saying what goes with the record (what sits under it inside its aggregate), sends its Remove,
 * and shows the refusal (what still references it) in the question; on success it opens `then`.
 */
export function RemoveQuestion({ index, id, label, goes, remove, then, onCancel }: {
  index: RecordIndex;
  id: string;
  /** The record's kind in a sentence, such as business outcome. */
  label: string;
  /** The records that go with it. */
  goes: readonly string[];
  remove: () => Promise<WriteAnswer>;
  /** The address the page gives way to once the record is removed. */
  then: string;
  onCancel: () => void;
}) {
  const announce = useAnnounce();
  const [refusal, setRefusal] = useState<{ error: string; problems: StoreProblem[] } | null>(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const confirm = async () => {
    setBusy(true);
    const answer = await remove();
    setBusy(false);
    setTries((t) => t + 1);
    if (!answer.ok) { setRefusal({ error: answer.error, problems: answer.problems }); return; }
    announce(`Removed ${id}`);
    navigate(then);
  };
  return (
    <section className="remove-panel" aria-labelledby={`remove-${id}`}>
      <h2 id={`remove-${id}`} tabIndex={-1} ref={heading}>Remove {id}?</h2>
      <p>This removes the {label} <strong>{index.byId.get(id)?.title ?? id}</strong> and the links it starts{goes.length > 0 ? `, with the ${goes.length} ${goes.length === 1 ? 'record' : 'records'} under it` : ''}. It is refused while anything else still references them.</p>
      {goes.length > 0 && (
        <ul className="plain remove-referrers" aria-label={`What goes with ${id}`}>
          {goes.slice(0, 20).map((g) => <li key={g}><RecordLink index={index} id={g} /></li>)}
          {goes.length > 20 && <li className="hint">and {goes.length - 20} more</li>}
        </ul>
      )}
      {refusal && <Refusal title="The removal was refused. Nothing was changed." reasons={refusal.problems.length > 0 ? refusal.problems.map(problemText) : [refusal.error]} focusKey={tries} />}
      <div className="record-form-actions">
        <Button danger onClick={confirm} disabled={busy}>{busy ? 'Removing…' : `Remove ${id}`}</Button>
        <Button onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </section>
  );
}
