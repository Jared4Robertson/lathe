import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ToolingPage } from '../../../../lathe/src/authoring/tooling/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { sendTooling, type ToolingCommands } from './commands';
import { useNextToolingId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';

// The Tooling editor (LA-AUT-A21): the actions on a tooling record, each sending one of the aggregate's own commands,
// POST /api/tooling/<command>, and nothing else. Edit sends Change a tooling record with only what changed; Remove
// says it goes with its packages and the meets links it starts and sends Remove a tooling record. A tooling record is added
// from its domain's page (AddToolingForm). The aggregate has no Move. A refusal shows every reason the command gave,
// keeps what was entered, and changes nothing.

/** The standard rules of the domain's product, as what a tooling record may meet. */
function standardRules(index: RecordIndex, domain: string): Choice[] {
  const product = index.byId.get(domain)?.product;
  return [...index.byId.values()].filter((r) => r.kind === 'standard_rule' && r.product === product).map((r) => ({ id: r.id, title: r.title }));
}

/** The fields Add and Change take (Change leaves out the ID), in their input's order. */
function fieldsOf(index: RecordIndex, domain: string, adding: boolean): FieldSpec[] {
  return [
    ...(adding ? [{ field: 'id', column: 'id', table: 'tooling' }] : []),
    { field: 'title', column: 'title', table: 'tooling' },
    { field: 'file', column: 'file', table: 'tooling' },
    { field: 'packages', label: 'Packages', description: 'The packages it uses.', texts: true },
    { field: 'meets', label: 'Meets', description: 'The standard rules it meets.', many: standardRules(index, domain) },
  ];
}

type Mode = 'view' | 'change' | 'remove';

/** The tooling record with its actions; the form or the remove question shows in place of its page. */
export function ToolingEditor({ index, page, children }: { index: RecordIndex; page: ToolingPage; children: ReactNode }) {
  const writer = useWriter();
  const [mode, setMode] = useState<Mode>('view');
  const toolbar = useRef<HTMLDivElement>(null);
  const announce = useAnnounce();
  const { tooling } = page;
  useEffect(() => { setMode('view'); }, [tooling.id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode('view');
    backToActions(toolbar, `Change ${tooling.id}`);
  };
  if (mode === 'change') {
    const specs = fieldsOf(index, tooling.domain_id, false);
    const current = { ...tooling, packages: page.packages, meets: page.meets } as Record<string, unknown>;
    const submit = async (draft: Draft) => {
      const input = changeInput(index, specs, draft, current, { id: tooling.id }, ['file']);
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await sendTooling(writer, '/api/tooling/change-tooling', input as unknown as ToolingCommands['/api/tooling/change-tooling']);
      if (answer.ok) { announce(`Saved ${tooling.id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} id={tooling.id} submit={submit} onDone={back} /></div>;
  }
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${tooling.id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode('change')}>Edit</Button>
        <Button icon="trash" danger onClick={() => setMode('remove')} aria-expanded={mode === 'remove'}>Remove</Button>
      </div>
      {mode === 'remove' && (
        <RemoveQuestion index={index} id={tooling.id} label="tooling record" goes={[]} then={addressOf(tooling.domain_id)} onCancel={back}
          remove={() => sendTooling(writer, '/api/tooling/remove-tooling', { id: tooling.id })} />
      )}
      {children}
    </>
  );
}

/** Edit: the tooling record's Change, with only what changed. */
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
    <CommandForm eyebrow="Tooling" title={`Edit ${id}`} submit={() => submit(draft)} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a tooling record to a domain (from the domain's page): the aggregate's own Add, its ID the next free one. */
export function AddToolingForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextToolingId(parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, parent, true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { domain_id: parent });
    const answer = await sendTooling(writer, '/api/tooling/add-tooling', input as unknown as ToolingCommands['/api/tooling/add-tooling']);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New tooling record under ${parent}`} title="Add a tooling record" submit={submit} saveLabel="Add tooling record" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
