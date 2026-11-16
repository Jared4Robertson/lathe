import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LibraryPage } from '../../../../lathe/src/domain-modeling/library/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, addOrChangeFields, changeInput, CommandForm, draftOf, emptyDraft, Fields, LONG, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { AddMenu } from '../../edit/AddMenu';
import { useWriter, type CommandInputs } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { AddGuaranteeForm } from '../guarantee/GuaranteeEditor';
import { LIBRARY_FIELDS } from './fields.generated';
import { useNextLibraryId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';

// The Library editor (LA-MOD-A26): the actions on a library, each sending one of the aggregate's own commands,
// POST /api/library/<command>, and nothing else. Edit sends Change a library with only what changed; Add opens the Guarantee
// aggregate's Add form for a guarantee it makes; Remove says what goes with it and sends Remove a library. A library is
// added from its business domain's page (AddLibraryForm). The aggregate has no Move. A refusal shows every reason
// the command gave, keeps what was entered, and changes nothing.

/** The business outcomes of the domain's product, as what a library may serve. */
function outcomes(index: RecordIndex, domain: string): Choice[] {
  const product = index.byId.get(domain)?.product;
  return [...index.byId.values()].filter((r) => r.kind === 'business_outcome' && r.product === product).map((r) => ({ id: r.id, title: r.title }));
}

/** The fields Add and Change take, from their inputs (Change leaves out the ID, Add the domain). */
const fieldsOf = (index: RecordIndex, domain: string, adding: boolean): FieldSpec[] =>
  addOrChangeFields(adding, LIBRARY_FIELDS['/api/library/add-library'], 'domain_id', LIBRARY_FIELDS['/api/library/change-library'], { description: LONG, serves: { label: 'Serves', choices: outcomes(index, domain) } });

type Mode = 'view' | 'change' | 'add' | 'remove';

/** A library with its actions; the form or the remove question shows in place of its page. */
export function LibraryEditor({ index, page, children }: { index: RecordIndex; page: LibraryPage; children: ReactNode }) {
  const writer = useWriter();
  const [mode, setMode] = useState<Mode>('view');
  const toolbar = useRef<HTMLDivElement>(null);
  const announce = useAnnounce();
  const record = page.library;
  useEffect(() => { setMode('view'); }, [record.id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode('view');
    backToActions(`Change ${record.id}`, toolbar);
  };
  if (mode === 'change') {
    const specs = fieldsOf(index, record.domain_id, false);
    const current = { ...record, serves: page.serves } as Record<string, unknown>;
    const submit = async (draft: Draft) => {
      const input = changeInput(index, specs, draft, current, { id: record.id });
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await writer.command('/api/library/change-library', input as unknown as CommandInputs['/api/library/change-library']);
      if (answer.ok) { announce(`Saved ${record.id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} id={record.id} submit={submit} onDone={back} /></div>;
  }
  if (mode === 'add') return <div className="spec-body"><AddGuaranteeForm index={index} parent={record.id} onDone={back} /></div>;
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${record.id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode('change')}>Edit</Button>
        <AddMenu id={record.id} choices={[{ key: 'guarantee', label: kindLabel(index, 'guarantee') }]} onPick={() => setMode('add')} />
        <Button icon="trash" danger onClick={() => setMode('remove')} aria-expanded={mode === 'remove'}>Remove</Button>
      </div>
      {mode === 'remove' && (
        <RemoveQuestion index={index} id={record.id} label="library" goes={[]} then={addressOf(record.domain_id)} onCancel={back}
          remove={() => writer.command('/api/library/remove-library', { id: record.id })} />
      )}
      {children}
    </>
  );
}

/** Edit: the library's Change, with only what changed. */
function ChangeForm({ index, specs, current, id, submit, onDone }: {
  index: RecordIndex;
  specs: FieldSpec[];
  current: Record<string, unknown>;
  id: string;
  submit: (draft: Draft) => Promise<WriteAnswer | null>;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(specs, current));
  return (
    <CommandForm eyebrow="Library" title={`Edit ${id}`} submit={() => submit(draft)} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a library to a business domain (from the domain's page): the aggregate's own Add, its ID the next free one. */
export function AddLibraryForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextLibraryId(parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, parent, true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { domain_id: parent });
    const answer = await writer.command('/api/library/add-library', input as unknown as CommandInputs['/api/library/add-library']);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New library in ${parent}`} title="Add a library" submit={submit} saveLabel="Add library" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
