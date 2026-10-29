import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { StoreProblem } from '../../../lathe/src/server/contract';
import { Button } from '../components/Button';
import { lowerLabel } from '../plural';
import { navigate } from '../router';
import { useAnnounce } from '../shell/commands';
import { kindLabel, type SpecIndex, type SpecRecord } from '../specs/data';
import { RecordLink } from '../specs/parts';
import { addressOf, HOME_PATH } from '../views/address';
import {
  addableKinds,
  commandsFor,
  draftOf,
  draftProblems,
  formFields,
  linkForms,
  linkTargets,
  newDraft,
  parentChoices,
  partForms,
  recordChoices,
  referrersOf,
  removedWith,
  type CommandPlace,
  type Draft,
  type FormField,
} from './form';
import { useWriter } from './write';
import { adderOf } from '../record/pages';
import { FieldRow, IdsField, Refusal, problemText } from './fields';
import './edit.css';

// Changing records in place (LA-EXP: edit, add, remove). A record's page carries Edit, Add and
// Remove. Edit and Add open the form generated from the schema in place of the page's content;
// Remove asks first, naming what still references the record. Every change is one write through the
// server's command layer, and a refusal shows inline with the store's reasons.

/** A kind's label with its article, inside a sentence: "an aggregate", "a use case", "a UC requirement", "an API requirement". */
const aKind = (label: string) => `${/^(?:[aeio]|u(?!c\b|se\b|s\b))/i.test(label) && !/^UC\b/.test(label) ? 'an' : 'a'} ${lowerLabel(label)}`;
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Mode ={ mode: 'view' } | { mode: 'edit' } | { mode: 'add'; kind: string } | { mode: 'remove' };

/** A record's page content with its Edit, Add and Remove actions; shows the form or the remove question in its place. */
export function Editable({ index, id, children }: { index: SpecIndex; id: string; children: ReactNode }) {
  const writer = useWriter();
  const record = index.byId.get(id);
  const [mode, setMode] = useState<Mode>({ mode: 'view' });
  const [adding, setAdding] = useState(false);
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => { setMode({ mode: 'view' }); setAdding(false); }, [id]);
  if (!writer || !record) return <>{children}</>;
  const kinds = addableKinds(index.workspace.schema, record.kind);
  const back = () => {
    setMode({ mode: 'view' });
    setTimeout(() => toolbar.current?.querySelector<HTMLElement>('button')?.focus(), 0);
  };
  // A kind whose aggregate has its own Add form is added through it, with its aggregate's own command.
  const Adder = mode.mode === 'add' ? adderOf(index.workspace.schema, mode.kind) : undefined;
  if (Adder) return <div className="spec-body"><Adder index={index} parent={record.id} onDone={back} /></div>;
  if (mode.mode === 'edit' || mode.mode === 'add') {
    return (
      <div className="spec-body">
        <RecordForm
          index={index}
          kind={mode.mode === 'add' ? mode.kind : record.kind}
          record={mode.mode === 'edit' ? record : null}
          parent={mode.mode === 'add' ? record.id : null}
          onDone={back}
        />
      </div>
    );
  }
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'edit' })}>Edit</Button>
        {kinds.length === 1 && <Button icon="plus" onClick={() => setMode({ mode: 'add', kind: kinds[0] })}>Add {lowerLabel(kindLabel(index, kinds[0]))}</Button>}
        {kinds.length > 1 && (
          <span className="record-add">
            <Button icon="plus" aria-expanded={adding} aria-controls={`add-kinds-${id}`} onClick={() => setAdding(!adding)}>Add…</Button>
            {adding && (
              <span id={`add-kinds-${id}`} className="record-add-kinds" role="group" aria-label={`Kinds to add under ${id}`}>
                {kinds.map((k) => <Button key={k} onClick={() => { setAdding(false); setMode({ mode: 'add', kind: k }); }}>{kindLabel(index, k)}</Button>)}
              </span>
            )}
          </span>
        )}
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && <RemovePanel index={index} record={record} onCancel={back} />}
      {children}
    </>
  );
}

/**
 * Adds a record of the kind under the parent from another aggregate's page (such as a view from its product's page):
 * through the kind's own aggregate's Add form when it has one, otherwise through the record form until it does.
 */
export function AddUnder({ index, parent, kind, onDone }: { index: SpecIndex; parent: string; kind: string; onDone: () => void }) {
  const Adder = adderOf(index.workspace.schema, kind);
  if (Adder) return <Adder index={index} parent={parent} onDone={onDone} />;
  return <RecordForm index={index} kind={kind} record={null} parent={parent} onDone={onDone} />;
}

// ---------- The form ----------

function RecordForm({ index, kind, record, parent, onDone }: { index: SpecIndex; kind: string; record: SpecRecord | null; parent: string | null; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const { schema } = index.workspace;
  const formId = useId();
  const [draft, setDraft] = useState<Draft>(() => (record ? draftOf(index, record) : newDraft(index, kind, parent)));
  const [shown, setShown] = useState<Map<string, string> | null>(null);
  const [refusal, setRefusal] = useState<{ error: string; problems: StoreProblem[]; places: CommandPlace[] } | null>(null);
  const [tries, setTries] = useState(0);
  const [saving, setSaving] = useState(false);
  const first = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  useEffect(() => { first.current?.focus(); }, []);

  const fields = formFields(schema, kind);
  const parts = partForms(schema, kind);
  const links = linkForms(index, kind);
  const product = record ? record.product : parent ? (index.byId.get(parent)?.kind === 'product' ? parent : index.byId.get(parent)?.product ?? null) : null;
  const parents = useMemo(() => parentChoices(index, kind, product, record?.id), [index, kind, product, record?.id]);
  const label = kindLabel(index, kind);
  const title = record ? `Edit ${record.id}` : `Add ${aKind(label)}`;
  // A kind with no owner sits under nothing: the page it is added from gives its ID's scope, and it has no parent picker.
  const owned = (schema.kinds[kind]?.parents.length ?? 0) > 0;
  const problems = shown ?? new Map<string, string>();
  const refusedAt = (place: string) => (refusal?.problems ?? []).filter((p) => p.command !== undefined && refusal!.places[p.command] === place);

  const set = (change: (d: Draft) => Draft) => setDraft((d) => change(structuredClone(d)));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = draftProblems(index, kind, draft, !record);
    setShown(found);
    setTries((t) => t + 1);
    if (found.size > 0) { setRefusal(null); return; }
    const { commands, places } = commandsFor(index, kind, draft, record);
    if (commands.length === 0) { announce('Nothing changed'); onDone(); return; }
    setSaving(true);
    const answer = await writer.write(commands);
    setSaving(false);
    if (!answer.ok) { setRefusal({ error: answer.error, problems: answer.problems, places }); return; }
    announce(record ? `Saved ${record.id}` : `Added ${draft.id.trim()}`);
    if (record) onDone();
    else navigate(addressOf(draft.id.trim()));
  };

  const fieldInput = (f: FormField, value: string, onChange: (v: string) => void, id: string, error: string | undefined, describedBy: string | undefined, ref?: typeof first) => {
    const common = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': [describedBy, error ? `${id}-error` : undefined].filter(Boolean).join(' ') || undefined, 'aria-required': f.required || undefined };
    switch (f.input) {
      case 'record': {
        // A record of one kind in this product, or none when the column may be left out.
        const choices = recordChoices(index, f, product);
        return (
          <select {...common} ref={ref} value={value} onChange={(e) => onChange(e.target.value)}>
            {(!f.required || value === '') && <option value="">{f.required ? 'Choose…' : 'None'}</option>}
            {value !== '' && !choices.some((r) => r.id === value) && <option value={value}>{value}</option>}
            {choices.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.title}</option>)}
          </select>
        );
      }
      case 'text':
      case 'list':
        return <textarea {...common} ref={ref} value={value} rows={f.input === 'list' ? 3 : 4} onChange={(e) => onChange(e.target.value)} />;
      case 'choice':
        return (
          <select {...common} ref={ref} value={value} onChange={(e) => onChange(e.target.value)}>
            {(!f.required || value === '') && <option value="">{f.required ? 'Choose…' : 'None'}</option>}
            {(f.values ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        );
      case 'boolean':
        return <input {...common} ref={ref} type="checkbox" checked={value === 'true'} onChange={(e) => onChange(e.target.checked ? 'true' : 'false')} />;
      case 'integer':
        return <input {...common} ref={ref} type="number" step={1} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />;
      case 'date':
        return <input {...common} ref={ref} type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
      default:
        return <input {...common} ref={ref} type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
    }
  };

  const reasons = [
    ...(refusal ? (refusal.problems.length > 0 ? refusal.problems.map(problemText) : [refusal.error]) : []),
    ...(!refusal ? [...problems.values()] : []),
  ];
  let firstRef = true;
  const takeFirst = () => { if (!firstRef) return undefined; firstRef = false; return first; };

  return (
    <form className="record-form" aria-labelledby={`${formId}-heading`} onSubmit={submit} noValidate>
      <header className="record-form-head">
        <p className="eyebrow">{record ? kindLabel(index, record.kind) : `New ${lowerLabel(label)}${parent ? ` ${owned ? 'under' : 'in'} ${parent}` : ''}`}</p>
        <h2 id={`${formId}-heading`}>{title}</h2>
      </header>
      {reasons.length > 0 && (
        <Refusal title={refusal ? `The store refused the change. Nothing was saved.` : `Fix ${reasons.length === 1 ? 'this' : 'these'} first:`} reasons={reasons} focusKey={tries} />
      )}
      <fieldset className="form-group">
        <legend>Fields</legend>
        {!record && (
          <FieldRow id={`${formId}-id`} label="ID" required description={schema.kinds[kind]?.idPattern ? `Written ${schema.kinds[kind]!.idPattern}, such as ${schema.kinds[kind]!.idExample ?? ''}.` : ''} error={problems.get('id')}>
            <input id={`${formId}-id`} ref={takeFirst()} type="text" value={draft.id} spellCheck={false} aria-required aria-invalid={problems.has('id') || undefined}
              aria-describedby={[`${formId}-id-help`, problems.has('id') ? `${formId}-id-error` : ''].filter(Boolean).join(' ')}
              onChange={(e) => set((d) => ({ ...d, id: e.target.value }))} />
          </FieldRow>
        )}
        {fields.map((f) => {
          const id = `${formId}-field-${f.name}`;
          const error = problems.get(`field:${f.name}`);
          return (
            <FieldRow key={f.name} id={id} label={f.label} required={f.required} description={f.description} error={error} inline={f.input === 'boolean'}>
              {fieldInput(f, draft.values[f.name] ?? '', (v) => set((d) => ({ ...d, values: { ...d.values, [f.name]: v } })), id, error, f.description ? `${id}-help` : undefined, takeFirst())}
            </FieldRow>
          );
        })}
        <PlaceRefusals problems={refusedAt('fields')} />
      </fieldset>
      {owned && (
        <fieldset className="form-group">
          <legend>Where it sits</legend>
          <FieldRow id={`${formId}-parent`} label="Parent" required description={`${upperFirst(aKind(label))} sits under ${(schema.kinds[kind]?.parents ?? []).map((p) => aKind(kindLabel(index, p.kind))).join(' or ')}.`} error={problems.get('parent')}>
            <select id={`${formId}-parent`} value={draft.parent} aria-required aria-invalid={problems.has('parent') || undefined}
              aria-describedby={[`${formId}-parent-help`, problems.has('parent') ? `${formId}-parent-error` : ''].filter(Boolean).join(' ')}
              onChange={(e) => set((d) => ({ ...d, parent: e.target.value }))}>
              {!draft.parent && <option value="">Choose…</option>}
              {parents.map((g) => (
                <optgroup key={g.kind} label={kindLabel(index, g.kind)}>
                  {g.records.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.title}</option>)}
                </optgroup>
              ))}
            </select>
          </FieldRow>
          <PlaceRefusals problems={refusedAt('parent')} />
        </fieldset>
      )}
      {parts.map((part) => (
        <PartRows key={part.table} formId={formId} part={part} rows={draft.parts[part.table] ?? []} problems={problems}
          refused={refusedAt(`parts:${part.table}`)}
          onChange={(rows) => set((d) => ({ ...d, parts: { ...d.parts, [part.table]: rows } }))}
          fieldInput={fieldInput} />
      ))}
      {links.length > 0 && (
        <fieldset className="form-group">
          <legend>Links</legend>
          {links.map((l) => (
            <LinkPicker key={l.relation} formId={formId} index={index} link={l} candidates={linkTargets(index, l, product, record?.id ?? null)}
              targets={draft.links[l.relation] ?? []} refused={refusedAt(`links:${l.relation}`)}
              onChange={(targets) => set((d) => ({ ...d, links: { ...d.links, [l.relation]: targets } }))} />
          ))}
        </fieldset>
      )}
      <div className="record-form-actions">
        <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : record ? 'Save' : `Add ${lowerLabel(label)}`}</Button>
        <Button onClick={onDone} disabled={saving}>Cancel</Button>
      </div>
    </form>
  );
}

function PlaceRefusals({ problems }: { problems: StoreProblem[] }) {
  if (problems.length === 0) return null;
  return <ul className="form-error form-refusals">{problems.map((p, i) => <li key={i}>{problemText(p)}</li>)}</ul>;
}

type FieldInput = (f: FormField, value: string, onChange: (v: string) => void, id: string, error: string | undefined, describedBy: string | undefined) => ReactNode;

function PartRows({ formId, part, rows, problems, refused, onChange, fieldInput }: {
  formId: string; part: ReturnType<typeof partForms>[number]; rows: Record<string, string>[]; problems: Map<string, string>; refused: StoreProblem[];
  onChange: (rows: Record<string, string>[]) => void; fieldInput: FieldInput;
}) {
  const name = part.label;
  const add = () => onChange([...rows, Object.fromEntries(part.fields.map((f) => [f.name, f.input === 'boolean' ? 'false' : '']))]);
  return (
    <fieldset className="form-group form-parts">
      <legend>{name[0].toUpperCase() + name.slice(1)}s <span className="section-count">{rows.length}</span></legend>
      {part.description && <p className="form-help">{part.description}</p>}
      {rows.length === 0 && <p className="hint">None.</p>}
      <ol className="form-part-rows">
        {rows.map((row, i) => (
          <li key={i} className="form-part-row">
            <div className="form-part-fields" role="group" aria-label={`${name} ${i + 1}`}>
              {part.fields.map((f) => {
                const id = `${formId}-part-${part.table}-${i}-${f.name}`;
                const error = problems.get(`part:${part.table}:${i}:${f.name}`);
                return (
                  <FieldRow key={f.name} id={id} label={`${f.label} (${name} ${i + 1})`} required={f.required} description="" error={error} inline={f.input === 'boolean'}>
                    {fieldInput(f, row[f.name] ?? '', (v) => onChange(rows.map((r, j) => (j === i ? { ...r, [f.name]: v } : r))), id, error, undefined)}
                  </FieldRow>
                );
              })}
            </div>
            <Button danger onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove ${name} ${i + 1}`}>Remove</Button>
          </li>
        ))}
      </ol>
      <Button icon="plus" onClick={add}>Add a {name}</Button>
      <PlaceRefusals problems={refused} />
    </fieldset>
  );
}

function LinkPicker({ formId, index, link, candidates, targets, refused, onChange }: {
  formId: string; index: SpecIndex; link: ReturnType<typeof linkForms>[number]; candidates: SpecRecord[]; targets: string[]; refused: StoreProblem[]; onChange: (targets: string[]) => void;
}) {
  return (
    <IdsField id={`${formId}-link-${link.relation}`} label={link.label} description="" ids={targets} choices={candidates} onChange={onChange}
      renderId={(id) => <RecordLink index={index} id={id} />} refused={refused.map(problemText)} />
  );
}

// ---------- Remove ----------

function RemovePanel({ index, record, onCancel }: { index: SpecIndex; record: SpecRecord; onCancel: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const [refusal, setRefusal] = useState<{ error: string; problems: StoreProblem[] } | null>(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const referrers = referrersOf(index, record.id);
  const goes = removedWith(index, record.id);
  const label = lowerLabel(kindLabel(index, record.kind));
  const shown = referrers.slice(0, 20);
  const remove = async () => {
    setBusy(true);
    const answer = await writer.write([{ op: 'remove', table: record.kind, key: record.id }]);
    setBusy(false);
    setTries((t) => t + 1);
    if (!answer.ok) { setRefusal({ error: answer.error, problems: answer.problems }); return; }
    announce(`Removed ${record.id}`);
    navigate(record.parent ? addressOf(record.parent) : HOME_PATH);
  };
  return (
    <section className="remove-panel" aria-labelledby={`remove-${record.id}`}>
      <h2 id={`remove-${record.id}`} tabIndex={-1} ref={heading}>Remove {record.id}?</h2>
      <p>
        This removes the {label} <strong>{record.title}</strong>
        {goes.parts + goes.links > 0 ? `, with ${[goes.parts > 0 ? `its ${goes.parts} part ${goes.parts === 1 ? 'row' : 'rows'}` : '', goes.links > 0 ? `the ${goes.links} ${goes.links === 1 ? 'link' : 'links'} it starts` : ''].filter(Boolean).join(' and ')}` : ''}.
      </p>
      {referrers.length > 0 ? (
        <>
          <p>{referrers.length === 1 ? 'This still references it' : `These ${referrers.length} still reference it`}, so the store will refuse until each is moved, unlinked or removed:</p>
          <ul className="plain remove-referrers">
            {shown.map((r, i) => <li key={`${r.id} ${i}`}><RecordLink index={index} id={r.id} /> <small className="meta">{r.how}</small></li>)}
            {referrers.length > shown.length && <li className="hint">and {referrers.length - shown.length} more</li>}
          </ul>
        </>
      ) : <p>Nothing else references it.</p>}
      {refusal && <Refusal title="The store refused to remove it. Nothing was changed." reasons={refusal.problems.length > 0 ? refusal.problems.map(problemText) : [refusal.error]} focusKey={tries} />}
      <div className="record-form-actions">
        <Button danger onClick={remove} disabled={busy}>{busy ? 'Removing…' : `Remove ${record.id}`}</Button>
        <Button onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </section>
  );
}
