import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DataStorePage } from '../../../../lathe/src/authoring/data-store/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { sendDataStore, type DataStoreCommands } from './commands';
import { useNextDataStoreId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';

// The Data store editor (LA-AUT-A23): the actions on a data store, each sending one of the aggregate's own commands,
// POST /api/data-store/<command>, and nothing else. Edit sends Change a data store with only what changed (the
// integration that reaches it cleared with null); Remove sends Remove a data store, refused while anything is stored in
// it. A data store is added from its product's or domain's page (AddDataStoreForm). The aggregate has no Move. A
// refusal shows every reason the command gave, keeps what was entered, and changes nothing.

/** The integrations of the product, as what may reach the data store. */
const integrations = (index: RecordIndex, product: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === 'integration' && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields Add and Change take (Change leaves out the ID), in their input's order. */
function fieldsOf(index: RecordIndex, product: string, adding: boolean): FieldSpec[] {
  return [
    ...(adding ? [{ field: 'id', column: 'id', table: 'data_store' }] : []),
    { field: 'title', column: 'title', table: 'data_store' },
    { field: 'kind', column: 'kind', table: 'data_store' },
    { field: 'description', column: 'description', table: 'data_store', long: true },
    { field: 'provided_by', label: 'Provided by', description: 'The integration that reaches it, when it is a service someone else runs that the user must provide.', one: integrations(index, product) },
  ];
}

type Mode = 'view' | 'change' | 'remove';

/** The data store with its actions; the form or the remove question shows in place of its page. */
export function DataStoreEditor({ index, page, children }: { index: RecordIndex; page: DataStorePage; children: ReactNode }) {
  const writer = useWriter();
  const announce = useAnnounce();
  const [mode, setMode] = useState<Mode>('view');
  const toolbar = useRef<HTMLDivElement>(null);
  const { store } = page;
  useEffect(() => { setMode('view'); }, [store.id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode('view');
    backToActions(`Change ${store.id}`, toolbar);
  };
  const product = index.byId.get(store.id)?.product ?? '';
  if (mode === 'change') {
    const specs = fieldsOf(index, product, false);
    const current = { ...store, provided_by: page.providedBy?.id } as Record<string, unknown>;
    const submit = async (draft: Draft) => {
      const input = changeInput(index, specs, draft, current, { id: store.id }, ['provided_by']);
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await sendDataStore(writer, '/api/data-store/change-data-store', input as unknown as DataStoreCommands['/api/data-store/change-data-store']);
      if (answer.ok) { announce(`Saved ${store.id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} id={store.id} submit={submit} onDone={back} /></div>;
  }
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${store.id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode('change')}>Edit</Button>
        <Button icon="trash" danger onClick={() => setMode('remove')} aria-expanded={mode === 'remove'}>Remove</Button>
      </div>
      {mode === 'remove' && (
        <RemoveQuestion index={index} id={store.id} label="data store" goes={[]} then={addressOf(page.parent.id)} onCancel={back}
          remove={() => sendDataStore(writer, '/api/data-store/remove-data-store', { id: store.id })} />
      )}
      {children}
    </>
  );
}

/** Edit: the data store's Change, with only what changed. */
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
    <CommandForm eyebrow="Data store" title={`Edit ${id}`} submit={() => submit(draft)} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a data store under a product or a domain (from its page): the aggregate's own Add, its ID the next free one. */
export function AddDataStoreForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextDataStoreId(parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const under = index.byId.get(parent);
  const product = under?.kind === 'product' ? parent : under?.product ?? '';
  const specs = fieldsOf(index, product, true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { [under?.kind === 'domain' ? 'domain_id' : 'product_id']: parent });
    const answer = await sendDataStore(writer, '/api/data-store/add-data-store', input as unknown as DataStoreCommands['/api/data-store/add-data-store']);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New data store under ${parent}`} title="Add a data store" submit={submit} saveLabel="Add data store" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
