import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TestDataSetPage } from '../../../../lathe/src/authoring/test-data-set/read-model';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import { useWriter } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { sendTestDataSet, type TestDataSetCommands } from './commands';
import { useNextTestDataSetId } from './reads';
import '../../edit/edit.css';

// The Test data set editor (LA-AUT-A17): the actions on a test data set, each sending one of the aggregate's own
// commands, POST /api/test-data-set/<command>, and nothing else. Edit sends Change a test data set with only what
// changed; Remove sends Remove a test data set, refused while a test still starts from it. A test data set is added
// from its domain's page (AddTestDataSetForm). The aggregate has no Move and nothing sits under a test data set. A
// refusal shows every reason the command gave, keeps what was entered, and changes nothing.

/** The fields Add and Change take (Change leaves out the ID), in their input's order. */
function fieldsOf(adding: boolean): FieldSpec[] {
  const table = 'test_data_set';
  return [
    ...(adding ? [{ field: 'id', column: 'id', table }] : []),
    { field: 'title', column: 'title', table },
    { field: 'environment', column: 'environment', table, long: true },
    { field: 'accounts', column: 'accounts', table, long: true },
    { field: 'records', column: 'records', table, long: true },
    { field: 'prepare', column: 'prepare', table, long: true },
    { field: 'reset', column: 'reset', table, long: true },
    { field: 'file', column: 'file', table },
    { field: 'description', column: 'description', table, long: true },
  ];
}

type Mode = 'view' | 'change' | 'remove';

/** The test data set with its actions; the form or the remove question shows in place of its page. */
export function TestDataSetEditor({ index, page, children }: { index: RecordIndex; page: TestDataSetPage; children: ReactNode }) {
  const writer = useWriter();
  const announce = useAnnounce();
  const [mode, setMode] = useState<Mode>('view');
  const toolbar = useRef<HTMLDivElement>(null);
  const set = page.testDataSet;
  useEffect(() => { setMode('view'); }, [set.id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode('view');
    setTimeout(() => toolbar.current?.querySelector<HTMLElement>('button')?.focus(), 0);
  };
  if (mode === 'change') {
    const specs = fieldsOf(false);
    const current = { ...set } as Record<string, unknown>;
    const submit = async (draft: Draft) => {
      const input = changeInput(index, specs, draft, current, { id: set.id }, ['accounts', 'file']);
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await sendTestDataSet(writer, '/api/test-data-set/change-test-data-set', input as unknown as TestDataSetCommands['/api/test-data-set/change-test-data-set']);
      if (answer.ok) { announce(`Saved ${set.id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} id={set.id} submit={submit} onDone={back} /></div>;
  }
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${set.id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode('change')}>Edit</Button>
        <Button icon="trash" danger onClick={() => setMode('remove')} aria-expanded={mode === 'remove'}>Remove</Button>
      </div>
      {mode === 'remove' && (
        <RemoveQuestion index={index} id={set.id} label="test data set" goes={[]} then={addressOf(set.domain_id)} onCancel={back}
          remove={() => sendTestDataSet(writer, '/api/test-data-set/remove-test-data-set', { id: set.id })} />
      )}
      {children}
    </>
  );
}

/** Edit: the test data set's Change, with only what changed. */
function ChangeForm({ index, specs, current, id, submit, onDone }: {
  index: RecordIndex;
  specs: FieldSpec[];
  current: Record<string, unknown>;
  id: string;
  submit: (draft: Draft) => ReturnType<Parameters<typeof CommandForm>[0]['submit']>;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(specs, current));
  return (
    <CommandForm eyebrow="Test data set" title={`Edit ${id}`} submit={() => submit(draft)} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a test data set to a domain (from the domain's page): the aggregate's own Add, its ID the next free one. */
export function AddTestDataSetForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextTestDataSetId(parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { domain_id: parent });
    const answer = await sendTestDataSet(writer, '/api/test-data-set/add-test-data-set', input as unknown as TestDataSetCommands['/api/test-data-set/add-test-data-set']);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New test data set under ${parent}`} title="Add a test data set" submit={submit} saveLabel="Add test data set" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
