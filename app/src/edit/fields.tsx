import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import type { StoreProblem, Value } from '../../../lathe/src/server/contract';
import type { ColumnDescription } from '../../../lathe/src/platform/data/schema';
import { Button } from '../components/Button';

// The shared field inputs every editor builds its fields from (LA-PAT-FIELD-INPUTS): one input per column type (a
// line or long text, a whole number, a choice of an enum's values, true or false, a date, a list of texts) and one
// for a record's ID or a list of them, each labeled, described and marked when it has a problem. An input knows no
// kind: it takes its column (or its label and the records it may name) and its value, and the editor that uses it
// decides which inputs it shows, in what order, and what each may name. A draft holds every value as text;
// columnValue turns it into the column's value, and the command refuses a value that is not of its type.

/** A field: its label, whether it must be given, what it means, and its problem; the input is its child. */
export function FieldRow({ id, label, required, description, error, inline = false, children }: { id: string; label: string; required: boolean; description: string; error?: string; inline?: boolean; children: ReactNode }) {
  return (
    <div className={`form-field${inline ? ' is-inline' : ''}${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}{required && <span className="form-required" aria-hidden="true"> *</span>}</label>
      {children}
      {description && <p className="form-help" id={`${id}-help`}>{description}</p>}
      {error && <p className="form-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

/** The reasons a write was refused or cannot be sent, at the top of the form; it takes focus so a screen reader reads it. */
export function Refusal({ title, reasons, focusKey }: { title: string; reasons: string[]; focusKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, [focusKey]);
  return (
    <div className="write-refusal" role="alert" tabIndex={-1} ref={ref}>
      <p><strong>{title}</strong></p>
      {reasons.length > 0 && <ul>{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
    </div>
  );
}

/** A refusal's problem as one line, in the rule's own words, without the file and line a loaded row would have. */
export const problemText = (p: StoreProblem) => `${p.key ? `${p.key}: ` : ''}${p.message}`;

/** A column's value as the text its input holds: '' for none, one line per item of a list. */
export function columnText(value: Value | undefined): string {
  if (value === undefined) return '';
  if (Array.isArray(value)) return value.join('\n');
  return String(value);
}

/**
 * The text of a column's input as the column's value, or undefined when it is empty: a whole number when it reads as
 * one, true or false, a list of its non-empty lines, or the text. A text that is not of the column's type is sent as it
 * is, and the command refuses it with its reason.
 */
export function columnValue(column: ColumnDescription, text: string): Value | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  switch (column.kind) {
    case 'integer':
      return /^-?\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
    case 'boolean':
      return trimmed === 'true' ? true : trimmed === 'false' ? false : trimmed;
    case 'text_list':
      return text.split('\n').map((line) => line.trim()).filter(Boolean);
    default:
      return text;
  }
}

/** The attributes every input shares: its ID, whether it is invalid, what describes it, whether it is required. */
const common = (id: string, required: boolean, error: string | undefined, help: boolean) => ({
  id,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': [help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined,
  'aria-required': required || undefined,
});

/** One column's field, its input of the column's type: `long` makes a text a text area. */
export function ColumnField({ id, column, label, value, onChange, long = false, required = column.required, error, inputRef }: {
  id: string;
  column: ColumnDescription;
  label: string;
  value: string;
  onChange: (text: string) => void;
  long?: boolean;
  required?: boolean;
  error?: string;
  inputRef?: Ref<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>;
}) {
  const description = column.description ?? '';
  const attrs = { ...common(id, required, error, !!description), ref: inputRef };
  const input = (() => {
    switch (column.kind) {
      case 'enum':
        return (
          <select {...attrs} value={value} onChange={(e) => onChange(e.target.value)}>
            {(!required || value === '') && <option value="">{required ? 'Choose…' : 'None'}</option>}
            {(column.values ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        );
      case 'boolean':
        return required
          ? <input {...attrs} type="checkbox" checked={value === 'true'} onChange={(e) => onChange(e.target.checked ? 'true' : 'false')} />
          : (
            <select {...attrs} value={value} onChange={(e) => onChange(e.target.value)}>
              <option value="">None</option>
              <option value="true">yes</option>
              <option value="false">no</option>
            </select>
          );
      case 'integer':
        return <input {...attrs} type="number" step={1} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />;
      case 'date':
        return <input {...attrs} type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
      case 'text_list':
        return <textarea {...attrs} value={value} rows={4} onChange={(e) => onChange(e.target.value)} />;
      default:
        return long
          ? <textarea {...attrs} value={value} rows={4} onChange={(e) => onChange(e.target.value)} />
          : <input {...attrs} type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
    }
  })();
  return (
    <FieldRow id={id} label={label} required={required} description={description + (column.kind === 'text_list' ? ' One per line.' : '')} error={error} inline={column.kind === 'boolean' && required}>
      {input}
    </FieldRow>
  );
}

/** A record the field may name: its ID and title. */
export interface Choice {
  id: string;
  title: string;
}

/** A field naming one record, picked among those it may name; when it may be left out, None clears it. */
export function IdField({ id, label, description, value, choices, onChange, required = false, error, inputRef }: {
  id: string;
  label: string;
  description: string;
  value: string;
  choices: readonly Choice[];
  onChange: (id: string) => void;
  required?: boolean;
  error?: string;
  inputRef?: Ref<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>;
}) {
  return (
    <FieldRow id={id} label={label} required={required} description={description} error={error}>
      <select {...common(id, required, error, !!description)} ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)}>
        {(!required || value === '') && <option value="">{required ? 'Choose…' : 'None'}</option>}
        {value !== '' && !choices.some((c) => c.id === value) && <option value={value}>{value}</option>}
        {choices.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.title}</option>)}
      </select>
    </FieldRow>
  );
}

/**
 * A field naming a list of records: the ones it names, each with Remove, and an input to add another among those it
 * may name, by ID. `renderId` draws a named record (a link to it).
 */
export function IdsField({ id, label, description, ids, choices, onChange, renderId, refused = [] }: {
  id: string;
  label: string;
  description: string;
  ids: readonly string[];
  choices: readonly Choice[];
  onChange: (ids: string[]) => void;
  renderId: (id: string) => ReactNode;
  refused?: readonly string[];
}) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listId = `${id}-options`;
  const open = choices.filter((c) => !ids.includes(c.id));
  const add = () => {
    const picked = typed.trim().split(/\s/)[0] ?? '';
    if (!picked) return;
    if (!open.some((c) => c.id === picked)) {
      setError(ids.includes(picked) ? `It already names ${picked}.` : `${picked} is not one it can name.`);
      return;
    }
    setError(null);
    setTyped('');
    onChange([...ids, picked]);
  };
  return (
    <div className="form-link">
      <p className="form-link-name"><strong>{label}</strong> <span className="section-count">{ids.length}</span></p>
      {description && <p className="form-help" id={`${id}-help`}>{description}</p>}
      {ids.length > 0 && (
        <ul className="plain form-link-targets" aria-label={`${label}: current`}>
          {ids.map((t) => (
            <li key={t}>
              {renderId(t)}
              <Button danger onClick={() => onChange(ids.filter((x) => x !== t))} aria-label={`Remove ${t} from ${label}`}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
      <div className={`form-link-add${error ? ' has-error' : ''}`}>
        <label htmlFor={id} className="sr-only">Add to {label}</label>
        <input id={id} type="text" list={listId} value={typed} placeholder="An ID" spellCheck={false}
          aria-invalid={error ? true : undefined} aria-describedby={[description ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
          onChange={(e) => { setTyped(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <datalist id={listId}>{open.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</datalist>
        <Button onClick={add} aria-label={`Add to ${label}`}>Add</Button>
        {error && <p className="form-error" id={`${id}-error`}>{error}</p>}
      </div>
      {refused.length > 0 && <ul className="form-error form-refusals">{refused.map((r, i) => <li key={i}>{r}</li>)}</ul>}
    </div>
  );
}

/**
 * A field holding a list of a part table's rows, such as a product's roles: one group per row, each column its own
 * input of its type, with Remove; and Add for another row. The list as it stands replaces the record's parts.
 */
export function PartsField({ id, label, description, columns, rows, onChange }: {
  id: string;
  label: string;
  description: string;
  columns: readonly ColumnDescription[];
  rows: readonly Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
}) {
  // A new row: a required true-or-false column starts false, every other column empty.
  const blank = () => Object.fromEntries(columns.map((c) => [c.name, c.kind === 'boolean' && c.required ? 'false' : '']));
  const set = (at: number, name: string, text: string) => onChange(rows.map((r, i) => (i === at ? { ...r, [name]: text } : { ...r })));
  return (
    <fieldset className="form-parts" aria-describedby={description ? `${id}-help` : undefined}>
      <legend><strong>{label}</strong> <span className="section-count">{rows.length}</span></legend>
      {description && <p className="form-help" id={`${id}-help`}>{description}</p>}
      {rows.map((row, at) => (
        <div key={at} className="form-part" role="group" aria-label={`${label} ${at + 1}`}>
          {columns.map((column) => (
            <ColumnField key={column.name} id={`${id}-${at}-${column.name}`} column={column} label={`${column.name.replaceAll('_', ' ')} ${at + 1}`}
              value={row[column.name] ?? ''} onChange={(text) => set(at, column.name, text)} />
          ))}
          <Button danger onClick={() => onChange(rows.filter((_, i) => i !== at))} aria-label={`Remove ${label} ${at + 1}`}>Remove</Button>
        </div>
      ))}
      <Button icon="plus" onClick={() => onChange([...rows, blank()])} aria-label={`Add to ${label}`}>Add</Button>
    </fieldset>
  );
}
