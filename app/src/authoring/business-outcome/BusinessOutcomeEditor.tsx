import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { BusinessOutcomePage } from '../../../../lathe/src/authoring/business-outcome/read-model';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { sendBusinessOutcome, type BusinessOutcomeCommands } from './commands';
import { useNextBusinessOutcomeId } from './reads';
import '../../edit/edit.css';

// The Business outcome editor (LA-AUT-A16): the actions on an outcome, each sending one of the aggregate's own
// commands, POST /api/business-outcome/<command>, and nothing else. Edit sends Change a business outcome with only what
// changed; Remove says it goes with the measured_by links it starts and sends Remove a business outcome. An outcome is
// added from its product's page (AddBusinessOutcomeForm). The aggregate has no Move. A refusal shows every reason the
// command gave, keeps what was entered, and changes nothing.

/** The tests and records of the outcome's product, as what may measure it. */
function measures(index: RecordIndex, product: string): Choice[] {
  return [...index.byId.values()]
    .filter((r) => r.product === product && (index.meta.kinds.get(r.kind)?.stage === 'test-plan' || index.meta.kinds.get(r.kind)?.declared_by === product))
    .map((r) => ({ id: r.id, title: r.title }));
}

/** The fields Add and Change take (Change leaves out the ID), in their input's order. */
function fieldsOf(index: RecordIndex, product: string, adding: boolean): FieldSpec[] {
  return [
    ...(adding ? [{ field: 'id', column: 'id', table: 'business_outcome' }] : []),
    { field: 'title', column: 'title', table: 'business_outcome' },
    { field: 'statement', column: 'statement', table: 'business_outcome', long: true },
    { field: 'measure', column: 'measure', table: 'business_outcome', long: true },
    { field: 'target', column: 'target', table: 'business_outcome', long: true },
    { field: 'measured_outside', column: 'measured_outside', table: 'business_outcome', long: true },
    { field: 'notes', column: 'notes', table: 'business_outcome', long: true },
    { field: 'measured_by', label: 'Measured by', description: 'The tests, or records of the product\'s own kinds, that measure it.', many: measures(index, product) },
  ];
}

type Mode = 'view' | 'change' | 'remove';

/** The outcome with its actions; the form or the remove question shows in place of its page. */
export function BusinessOutcomeEditor({ index, page, children }: { index: RecordIndex; page: BusinessOutcomePage; children: ReactNode }) {
  const writer = useWriter();
  const [mode, setMode] = useState<Mode>('view');
  const toolbar = useRef<HTMLDivElement>(null);
  const announce = useAnnounce();
  const { outcome } = page;
  useEffect(() => { setMode('view'); }, [outcome.id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode('view');
    setTimeout(() => toolbar.current?.querySelector<HTMLElement>('button')?.focus(), 0);
  };
  if (mode === 'change') {
    const specs = fieldsOf(index, outcome.product_id, false);
    const current = { ...outcome, measured_by: page.measuredBy } as Record<string, unknown>;
    return (
      <div className="spec-body">
        <ChangeForm index={index} specs={specs} current={current} id={outcome.id} onDone={back} submit={async (draft) => {
          const input = changeInput(index, specs, draft, current, { id: outcome.id }, ['measured_outside', 'notes']);
          if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
          const answer = await sendBusinessOutcome(writer, '/api/business-outcome/change-business-outcome', input as unknown as BusinessOutcomeCommands['/api/business-outcome/change-business-outcome']);
          if (answer.ok) { announce(`Saved ${outcome.id}`); back(); }
          return answer;
        }} />
      </div>
    );
  }
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${outcome.id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode('change')}>Edit</Button>
        <Button icon="trash" danger onClick={() => setMode('remove')} aria-expanded={mode === 'remove'}>Remove</Button>
      </div>
      {mode === 'remove' && (
        <RemoveQuestion index={index} id={outcome.id} label="business outcome" goes={[]} then={addressOf(outcome.product_id)} onCancel={back}
          remove={() => sendBusinessOutcome(writer, '/api/business-outcome/remove-business-outcome', { id: outcome.id })} />
      )}
      {children}
    </>
  );
}

/** Edit: the outcome's Change, with only what changed. */
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
    <CommandForm eyebrow="Business outcome" title={`Edit ${id}`} submit={() => submit(draft)} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a business outcome to a product (from the product's page): the aggregate's own Add, its ID the next free one. */
export function AddBusinessOutcomeForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextBusinessOutcomeId(parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, parent, true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { product_id: parent });
    const answer = await sendBusinessOutcome(writer, '/api/business-outcome/add-business-outcome', input as unknown as BusinessOutcomeCommands['/api/business-outcome/add-business-outcome']);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New business outcome under ${parent}`} title="Add a business outcome" submit={submit} saveLabel="Add business outcome" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
