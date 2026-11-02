import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StorageRequirementKind } from '../../../../lathe/src/domain-modeling/storage-requirement/model';
import type { StorageRequirementPage } from '../../../../lathe/src/domain-modeling/storage-requirement/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, addOrChangeFields, changeInput, CommandForm, draftOf, emptyDraft, Fields, formFields, LONG, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { AddMenu } from '../../edit/AddMenu';
import { useWriter, type Writer, type CommandInputs, type CommandRoute } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { STORAGE_REQUIREMENT_FIELDS } from './fields.generated';
import { useNextStorageRequirementId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { kindWord } from '../../platform/meta-model/reads';

// The Storage requirement editor (LA-MOD-A22): the actions on a record of a storage requirement, each sending one of
// the aggregate's own commands, POST /api/storage-requirement/<command>, and nothing else. Edit sends its kind's Change
// with only what changed; Add (on a requirement) opens an empty test form with its ID read from the aggregate
// (next-id); Remove says what goes with the record and sends its Remove. The aggregate has no Move: what a requirement
// is about never changes. A storage requirement is added from its aggregate's or read model's page
// (AddStorageRequirementForm). A refusal shows every reason the command gave, keeps what was entered, and changes nothing.

/** The test data sets of the product, as what a test may start from. */
const dataSets = (index: RecordIndex, product: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === 'test_data_set' && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields each kind's Add and Change take, from their inputs; the hints add long text and the choices. */
function fieldsOf(index: RecordIndex, product: string, kind: StorageRequirementKind, adding: boolean): FieldSpec[] {
  const F = STORAGE_REQUIREMENT_FIELDS;
  if (kind === 'storage_requirement') {
    // Add names its one parent, an aggregate or a read model, in the column the form picks from the record it is about.
    return adding
      ? formFields(F['/api/storage-requirement/add-storage-requirement'], ['aggregate_id', 'read_model_id'], { statement: LONG })
      : formFields(F['/api/storage-requirement/change-storage-requirement'], ['id'], { statement: LONG });
  }
  return addOrChangeFields(adding, F['/api/storage-requirement/add-storage-requirement-test'], 'storage_requirement_id', F['/api/storage-requirement/change-storage-requirement-test'], {
    when: LONG, then: LONG, manual_reason: LONG, notes: LONG, starts_from: { choices: dataSets(index, product) },
  });
}

/** The record's current values, by its input's field names. */
function currentOf(page: StorageRequirementPage): Record<string, unknown> {
  if (page.record.kind === 'storage_requirement') return { ...page.requirement };
  const { test, startsFrom } = page.tests.find((t) => t.test.id === page.record.id)!;
  return { ...test, starts_from: startsFrom };
}

/** Each kind's Change command. */
const CHANGE: Record<StorageRequirementKind, CommandRoute> = {
  storage_requirement: '/api/storage-requirement/change-storage-requirement',
  storage_requirement_test: '/api/storage-requirement/change-storage-requirement-test',
};

/** Each kind's Remove command. */
const REMOVE: Record<StorageRequirementKind, CommandRoute> = {
  storage_requirement: '/api/storage-requirement/remove-storage-requirement',
  storage_requirement_test: '/api/storage-requirement/remove-storage-requirement-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: CommandRoute, input: Record<string, unknown>): Promise<WriteAnswer> =>
  writer.command(route, input as unknown as CommandInputs[typeof route]);

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add' } | { mode: 'remove' };

/** A record of the storage requirement with its actions; a form or the remove question shows in place of its page. */
export function StorageRequirementEditor({ index, page, children }: { index: RecordIndex; page: StorageRequirementPage; children: ReactNode }) {
  const writer = useWriter();
  const announce = useAnnounce();
  const [mode, setMode] = useState<Mode>({ mode: 'view' });
  const toolbar = useRef<HTMLDivElement>(null);
  const { id, kind } = page.record;
  useEffect(() => { setMode({ mode: 'view' }); }, [id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode({ mode: 'view' });
    backToActions(`Change ${id}`, toolbar);
  };
  const product = index.byId.get(page.requirement.id)?.product ?? '';
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, product, kind, false);
    const current = currentOf(page);
    const submit = async (draft: Draft) => {
      const input = changeInput(index, specs, draft, current, { id });
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await send(writer, CHANGE[kind], input);
      if (answer.ok) { announce(`Saved ${id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} eyebrow={kindWord(index.meta, kind)} id={id} submit={submit} onDone={back} /></div>;
  }
  if (mode.mode === 'add') return <div className="spec-body"><AddTestForm index={index} product={product} parent={id} onDone={back} /></div>;
  const isRequirement = kind === 'storage_requirement';
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        <AddMenu id={id} choices={isRequirement ? [{ key: 'storage_requirement_test', label: kindLabel(index, 'storage_requirement_test') }] : []} onPick={() => setMode({ mode: 'add' })} />
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={kindWord(index.meta, kind)} goes={isRequirement ? page.tests.map((t) => t.test.id) : []}
          then={addressOf(isRequirement ? page.parent.id : page.requirement.id)} onCancel={back}
          remove={() => writer.command(REMOVE[kind], { id })} />
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
    <CommandForm eyebrow={eyebrow.charAt(0).toUpperCase() + eyebrow.slice(1)} title={`Edit ${id}`} submit={() => submit(draft)} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add: a test under the requirement, its ID the next free one, sent as Add a storage requirement test. */
function AddTestForm({ index, product, parent, onDone }: { index: RecordIndex; product: string; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextStorageRequirementId('storage_requirement_test', parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, product, 'storage_requirement_test', true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { storage_requirement_id: parent });
    const answer = await send(writer, '/api/storage-requirement/add-storage-requirement-test', input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New storage requirement test under ${parent}`} title="Add a storage requirement test" submit={submit} saveLabel="Add storage requirement test" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a storage requirement under an aggregate or a read model (from its page): the aggregate's own Add, its ID the next free one. */
export function AddStorageRequirementForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextStorageRequirementId('storage_requirement', parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, index.byId.get(parent)?.product ?? '', 'storage_requirement', true);
  const submit = async () => {
    // The record it is about names the one parent column the command takes.
    const column = index.byId.get(parent)?.kind === 'read_model' ? 'read_model_id' : 'aggregate_id';
    const input = addInput(index, specs, draft, { [column]: parent });
    const answer = await send(writer, '/api/storage-requirement/add-storage-requirement', input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New storage requirement under ${parent}`} title="Add a storage requirement" submit={submit} saveLabel="Add storage requirement" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
