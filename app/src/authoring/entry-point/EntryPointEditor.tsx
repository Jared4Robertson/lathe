import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { EntryPointPage } from '../../../../lathe/src/authoring/entry-point/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, formFields, LONG, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type CommandInputs } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { ENTRY_POINT_FIELDS } from './fields.generated';
import { useNextEntryPointId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';

// The Entry point editor (LA-AUT-A20): the actions on an entry point, each sending one of the aggregate's own commands,
// POST /api/entry-point/<command>, and nothing else. Edit sends Change an entry point with only what changed; Remove
// says it goes with its packages and the meets links it starts and sends Remove an entry point. An entry point is added
// from its domain's page (AddEntryPointForm). The aggregate has no Move. A refusal shows every reason the command gave,
// keeps what was entered, and changes nothing.

/** The standard rules of the domain's product, as what an entry point may meet. */
function standardRules(index: RecordIndex, domain: string): Choice[] {
  const product = index.byId.get(domain)?.product;
  return [...index.byId.values()].filter((r) => r.kind === 'standard_rule' && r.product === product).map((r) => ({ id: r.id, title: r.title }));
}

/** The fields Add and Change take, from their inputs (Add's domain and Change's ID are sent by the form itself). */
function fieldsOf(index: RecordIndex, domain: string, adding: boolean): FieldSpec[] {
  const hints = { description: LONG, meets: { choices: standardRules(index, domain) } };
  return adding
    ? formFields(ENTRY_POINT_FIELDS['/api/entry-point/add-entry-point'], ['domain_id'], hints)
    : formFields(ENTRY_POINT_FIELDS['/api/entry-point/change-entry-point'], ['id'], hints);
}

type Mode = 'view' | 'change' | 'remove';

/** The entry point with its actions; the form or the remove question shows in place of its page. */
export function EntryPointEditor({ index, page, children }: { index: RecordIndex; page: EntryPointPage; children: ReactNode }) {
  const writer = useWriter();
  const [mode, setMode] = useState<Mode>('view');
  const toolbar = useRef<HTMLDivElement>(null);
  const announce = useAnnounce();
  const { entryPoint } = page;
  useEffect(() => { setMode('view'); }, [entryPoint.id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode('view');
    backToActions(`Change ${entryPoint.id}`, toolbar);
  };
  if (mode === 'change') {
    const specs = fieldsOf(index, entryPoint.domain_id, false);
    const current = { ...entryPoint, packages: page.packages, meets: page.meets } as Record<string, unknown>;
    const submit = async (draft: Draft) => {
      const input = changeInput(index, specs, draft, current, { id: entryPoint.id });
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await writer.command('/api/entry-point/change-entry-point', input as unknown as CommandInputs['/api/entry-point/change-entry-point']);
      if (answer.ok) { announce(`Saved ${entryPoint.id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} id={entryPoint.id} submit={submit} onDone={back} /></div>;
  }
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${entryPoint.id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode('change')}>Edit</Button>
        <Button icon="trash" danger onClick={() => setMode('remove')} aria-expanded={mode === 'remove'}>Remove</Button>
      </div>
      {mode === 'remove' && (
        <RemoveQuestion index={index} id={entryPoint.id} label="entry point" goes={[]} then={addressOf(entryPoint.domain_id)} onCancel={back}
          remove={() => writer.command('/api/entry-point/remove-entry-point', { id: entryPoint.id })} />
      )}
      {children}
    </>
  );
}

/** Edit: the entry point's Change, with only what changed. */
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
    <CommandForm eyebrow="Entry point" title={`Edit ${id}`} submit={() => submit(draft)} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add an entry point to a domain (from the domain's page): the aggregate's own Add, its ID the next free one. */
export function AddEntryPointForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextEntryPointId(parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, parent, true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { domain_id: parent });
    const answer = await writer.command('/api/entry-point/add-entry-point', input as unknown as CommandInputs['/api/entry-point/add-entry-point']);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New entry point under ${parent}`} title="Add an entry point" submit={submit} saveLabel="Add entry point" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
