import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CheckPage } from '../../../../lathe/src/checking/check/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import { useWriter } from '../../edit/write';
import { checkPagePath, formatPath } from '../../format/reference';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { useSpaces } from '../../shell/spaces';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { sendCheck, type CheckCommands } from './commands';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';

// The Check editor (LA-CHK-A1): the actions on a product's own check, each sending one of the aggregate's own commands,
// POST /api/check/<command>, and nothing else. Edit sends Change a check with only what changed; Remove asks first and
// sends Remove a check. Lathe's own checks are read-only, so they show no actions; the command refuses them anyway. A
// check is added where the product's checks are listed, the format page's Checks (AddCheck). The aggregate has no
// Move. A refusal shows every reason the command gave, in its own words, keeps what was entered, and changes nothing.

/** The columns of a check its Add and Change take (Change leaves out the name), in their input's order. */
function fieldsOf(adding: boolean): FieldSpec[] {
  const table = 'check';
  return [
    ...(adding ? [{ field: 'name', column: 'name', table }] : []),
    { field: 'position', column: 'position', table },
    { field: 'severity', column: 'severity', table },
    { field: 'summary', column: 'summary', table },
    { field: 'explanation', column: 'explanation', table, long: true },
    { field: 'query', column: 'query', table, long: true },
    { field: 'kinds', column: 'kinds', table },
  ];
}

/** The check's current values, by its Change's field names. */
const currentOf = (page: CheckPage): Record<string, unknown> => ({
  position: page.position, severity: page.severity, summary: page.summary, explanation: page.explanation, query: page.query, kinds: page.kinds.length ? page.kinds : undefined,
});

/** The fields Change a check may clear with null. */
const CLEARABLE = ['kinds'] as const;

type Mode = 'view' | 'change' | 'remove';

/** A product's own check with its actions; the form or the remove question shows in place of its page. Lathe's show none. */
export function CheckEditor({ index, page, children }: { index: RecordIndex; page: CheckPage; children: ReactNode }) {
  const writer = useWriter();
  const announce = useAnnounce();
  const [mode, setMode] = useState<Mode>('view');
  const toolbar = useRef<HTMLDivElement>(null);
  const { name } = page;
  useEffect(() => { setMode('view'); }, [name]);
  if (!writer || page.product === null) return <>{children}</>;
  const back = () => {
    setMode('view');
    backToActions(`Change ${name}`, toolbar);
  };
  if (mode === 'change') {
    const specs = fieldsOf(false);
    const current = currentOf(page);
    const submit = async (draft: Draft) => {
      const input = changeInput(index, specs, draft, current, { name }, CLEARABLE);
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await sendCheck(writer, '/api/check/change-check', input as unknown as CheckCommands['/api/check/change-check']);
      if (answer.ok) { announce(`Saved ${name}`); back(); }
      return answer;
    };
    return <ChangeForm index={index} specs={specs} current={current} name={name} submit={submit} onDone={back} />;
  }
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${name}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode('change')}>Edit</Button>
        <Button icon="trash" danger onClick={() => setMode('remove')} aria-expanded={mode === 'remove'}>Remove</Button>
      </div>
      {mode === 'remove' && (
        <RemoveQuestion index={index} id={name} label="check" goes={[]} then={formatPath} onCancel={back}
          remove={() => sendCheck(writer, '/api/check/remove-check', { name })} />
      )}
      {children}
    </>
  );
}

/** Edit: Change a check, with only what changed. */
function ChangeForm({ index, specs, current, name, submit, onDone }: {
  index: RecordIndex;
  specs: FieldSpec[];
  current: Record<string, unknown>;
  name: string;
  submit: (draft: Draft) => Promise<WriteAnswer | null>;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(specs, current));
  return (
    <CommandForm eyebrow="Check" title={`Edit ${name}`} submit={() => submit(draft)} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a check to the product: an empty form for its own check, sent as Add a check with the product's ID. */
function AddCheckForm({ index, product, onDone }: { index: RecordIndex; product: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const specs = fieldsOf(true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { product_id: product });
    const answer = await sendCheck(writer, '/api/check/add-check', input as unknown as CheckCommands['/api/check/add-check']);
    if (answer.ok) { announce(`Added ${String(input.name)}`); navigate(checkPagePath(String(input.name))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New check of ${product}`} title="Add a check" submit={submit} saveLabel="Add check" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a check, where the product's checks are listed: the button, and the form in its place while it is open. */
export function AddCheck({ index }: { index: RecordIndex }) {
  const writer = useWriter();
  const product = useSpaces()?.current?.id;
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLDivElement>(null);
  if (!writer || !product) return null;
  const done = () => {
    setOpen(false);
    setTimeout(() => button.current?.querySelector<HTMLElement>('button')?.focus(), 0);
  };
  if (open) return <AddCheckForm index={index} product={product} onDone={done} />;
  return (
    <div className="record-actions" role="toolbar" aria-label={`Change the checks of ${product}`} ref={button}>
      <Button icon="plus" onClick={() => setOpen(true)}>Add check</Button>
    </div>
  );
}
