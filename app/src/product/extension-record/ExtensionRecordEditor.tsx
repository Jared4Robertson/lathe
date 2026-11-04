import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ExtensionRecordPage } from '../../../../lathe/src/product/extension-record/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, formFields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type CommandInputs } from '../../edit/write';
import { lowerLabel } from '../../plural';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { EXTENSION_RECORD_FIELDS } from './fields.generated';
import { useNextExtensionRecordId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';

// The Extension record editor (LA-PRD-A19): the actions on a record of a product's own kind, each sending one of the
// aggregate's own commands, POST /api/extension-record/<command>, and nothing else. Its fields are its kind's
// declaration, read from the schema it builds: the title and declared fields as values, a list of links for each
// relation the kind may start, the packages it uses and its helper files. Edit sends Change an extension record with only what changed
// (null clears an optional field); Remove sends Remove an extension record. A record is added from its parent's page
// (AddExtensionRecordForm), with its kind. The aggregate has no Move. A refusal shows every reason the command gave,
// keeps what was entered, and changes nothing.

/** The kind's value columns (its title and declared fields, not its ID or parent), and the relations it may start with the kinds each reaches, from the meta model. */
function declarationOf(index: RecordIndex, kind: string) {
  const parent = index.meta.kinds.get(kind)?.parent_columns[0];
  const columns = (index.meta.columns[kind] ?? []).filter((c) => c.name !== 'id' && c.name !== parent);
  const relations = new Map<string, { name: string; forwardLabel: string; description: string; targets: string[] }>();
  for (const r of index.meta.relations.filter((m) => m.source_kind === kind)) {
    const known = relations.get(r.relation) ?? { name: r.relation, forwardLabel: r.forward_label, description: r.description, targets: [] };
    known.targets.push(r.target_kind);
    relations.set(r.relation, known);
  }
  return { columns, relations: [...relations.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

const LINK = 'link:';

/** The fields Add and Change take (Change leaves out the ID): values, then each relation's links, then packages and helper files. */
function fieldsOf(index: RecordIndex, kind: string, product: string | null, adding: boolean): FieldSpec[] {
  const F = EXTENSION_RECORD_FIELDS;
  const { columns, relations } = declarationOf(index, kind);
  const records = [...index.byId.values()].filter((r) => r.product === product);
  const choices = (relation: string): Choice[] => {
    const targets = relations.find((r) => r.name === relation)!.targets;
    return records.filter((r) => targets.includes('*') || targets.includes(r.kind)).map((r) => ({ id: r.id, title: r.title }));
  };
  return [
    ...(adding ? [{ field: 'id', column: 'id', table: kind }] : []),
    ...columns.map((c): FieldSpec => ({ field: c.name, column: c.name, table: kind, long: c.kind === 'text' && c.name !== 'title', clearable: !c.required })),
    ...relations.map((r): FieldSpec => ({ field: `${LINK}${r.name}`, label: r.forwardLabel.charAt(0).toUpperCase() + r.forwardLabel.slice(1), description: r.description || `The records it ${r.forwardLabel}.`, many: choices(r.name) })),
    // The declared values and links are the product's own; only the packages and helper files come from the command's input.
    ...(adding
      ? formFields(F['/api/extension-record/add-extension-record'], ['kind', 'id', 'parent_id', 'values', 'links'])
      : formFields(F['/api/extension-record/change-extension-record'], ['id', 'values', 'links'])),
  ];
}

const isValue = (s: FieldSpec) => !s.field.startsWith(LINK) && !isListed(s);
const isLink = (s: FieldSpec) => s.field.startsWith(LINK);
const isListed = (s: FieldSpec) => s.field === 'packages' || s.field === 'helpers';
const sortedSame = (a: readonly string[], b: readonly string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

type Mode = 'view' | 'change' | 'remove';

/** The record with its actions; the form or the remove question shows in place of its page. */
export function ExtensionRecordEditor({ index, page, children }: { index: RecordIndex; page: ExtensionRecordPage; children: ReactNode }) {
  const writer = useWriter();
  const [mode, setMode] = useState<Mode>('view');
  const toolbar = useRef<HTMLDivElement>(null);
  const announce = useAnnounce();
  useEffect(() => { setMode('view'); }, [page.id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode('view');
    backToActions(`Change ${page.id}`, toolbar);
  };
  if (mode === 'change') {
    const specs = fieldsOf(index, page.kind, index.byId.get(page.id)?.product ?? null, false);
    const current: Record<string, unknown> = { ...page.values, packages: page.packages, helpers: page.helpers };
    for (const s of specs.filter(isLink)) current[s.field] = page.links[s.field.slice(LINK.length)] ?? [];
    const submit = async (draft: Draft) => {
      const values = changeInput(index, specs.filter(isValue), draft, current, {});
      const links: Record<string, string[]> = {};
      for (const s of specs.filter(isLink)) {
        const now = draft.ids[s.field] ?? [];
        if (!sortedSame(now, current[s.field] as string[])) links[s.field.slice(LINK.length)] = now;
      }
      const input: Record<string, unknown> = { id: page.id, ...changeInput(index, specs.filter(isListed), draft, current, {}) };
      if (Object.keys(values).length > 0) input.values = values;
      if (Object.keys(links).length > 0) input.links = links;
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await writer.command('/api/extension-record/change-extension-record', input as unknown as CommandInputs['/api/extension-record/change-extension-record']);
      if (answer.ok) { announce(`Saved ${page.id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} eyebrow={page.label} id={page.id} submit={submit} onDone={back} /></div>;
  }
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${page.id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode('change')}>Edit</Button>
        <Button icon="trash" danger onClick={() => setMode('remove')} aria-expanded={mode === 'remove'}>Remove</Button>
      </div>
      {mode === 'remove' && (
        <RemoveQuestion index={index} id={page.id} label={lowerLabel(page.label)} goes={[]} then={addressOf(page.parent)} onCancel={back}
          remove={() => writer.command('/api/extension-record/remove-extension-record', { id: page.id })} />
      )}
      {children}
    </>
  );
}

/** Edit: the record's Change, with only what changed. */
function ChangeForm({ index, specs, current, eyebrow, id, submit, onDone }: {
  index: RecordIndex;
  specs: FieldSpec[];
  current: Record<string, unknown>;
  eyebrow: string;
  id: string;
  submit: (draft: Draft) => Promise<WriteAnswer | null>;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(specs, current));
  return (
    <CommandForm eyebrow={eyebrow} title={`Edit ${id}`} submit={() => submit(draft)} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a record of a product kind under its parent (from the parent's page): the aggregate's own Add, its ID the next free one. */
export function AddExtensionRecordForm({ index, parent, kind, onDone }: { index: RecordIndex; parent: string; kind: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextExtensionRecordId(kind, parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const parentRecord = index.byId.get(parent);
  const product = parentRecord?.kind === 'product' ? parent : parentRecord?.product ?? null;
  const specs = fieldsOf(index, kind, product, true);
  const label = lowerLabel(index.meta.kinds.get(kind)?.label ?? kind);
  const submit = async () => {
    const { id, ...values } = addInput(index, specs.filter(isValue), draft, {});
    const links: Record<string, string[]> = {};
    for (const s of specs.filter(isLink)) if ((draft.ids[s.field] ?? []).length > 0) links[s.field.slice(LINK.length)] = draft.ids[s.field];
    const input: Record<string, unknown> = { kind, id, parent_id: parent, values, ...addInput(index, specs.filter(isListed), draft, {}) };
    if (Object.keys(links).length > 0) input.links = links;
    const answer = await writer.command('/api/extension-record/add-extension-record', input as unknown as CommandInputs['/api/extension-record/add-extension-record']);
    if (answer.ok) { announce(`Added ${String(id)}`); navigate(addressOf(String(id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New ${label} under ${parent}`} title={`Add ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`} submit={submit} saveLabel={`Add ${label}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
