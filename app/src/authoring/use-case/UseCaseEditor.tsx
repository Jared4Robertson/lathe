import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { UseCaseKind } from '../../../../lathe/src/authoring/use-case/model';
import { stepsOf, type StepOnPage, type TestOnPage, type UseCasePage } from '../../../../lathe/src/authoring/use-case/read-model';
import type { ColumnDescription } from '../../../../lathe/src/platform/data/schema';
import type { StoreProblem, Value, WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { ColumnField, IdField, IdsField, Refusal, columnText, columnValue, problemText, type Choice } from '../../edit/fields';
import { useWriter, type Writer } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import type { SpecIndex } from '../../specs/data';
import { RecordLink } from '../../specs/parts';
import { addressOf } from '../../views/address';
import { sendUseCase, type UseCaseCommands, type UseCaseRoute } from './commands';
import { useNextId } from './reads';
import '../../edit/edit.css';

// The Use case editor (LA-AUT-A11): the actions on a record of a use case, each sending one of the aggregate's own
// commands, POST /api/use-case/<command>, and nothing else. Edit sends its kind's Change with only what changed; Add
// opens an empty form for a kind that sits under the record in the use case, with the next free ID read from the
// aggregate (next-id), and sends its Add; Move, offered only for a kind the aggregate has a Move command for (a use
// case: Move a use case, to another capability), sends that command; Remove
// says what goes with the record and sends its Remove. Each form is built from the shared field inputs, its fields
// those of its command's input. A refusal shows every reason the command gave, in its own words, keeps what was
// entered, and changes nothing.

/** A kind's label in a sentence. */
const LABEL: Record<UseCaseKind, string> = {
  use_case: 'use case',
  uc_requirement: 'UC requirement',
  use_case_test: 'use case test',
  flow: 'flow',
  flow_step: 'flow step',
  flow_test: 'flow test',
};
const withArticle = (kind: UseCaseKind) => `${kind === 'uc_requirement' ? 'a' : /^[aeiou]/.test(LABEL[kind]) ? 'an' : 'a'} ${LABEL[kind]}`;

/** The kinds added under a record of each kind, inside the use case. */
const ADDED_UNDER: Record<UseCaseKind, UseCaseKind[]> = {
  use_case: ['uc_requirement', 'flow'],
  uc_requirement: ['use_case_test'],
  flow: ['flow_step', 'flow_test'],
  flow_step: [],
  use_case_test: [],
  flow_test: [],
};

/** The kinds the aggregate has a Move command for, each with it: a record of another kind is never moved. */
const MOVE: Partial<Record<UseCaseKind, '/api/use-case/move-use-case'>> = { use_case: '/api/use-case/move-use-case' };

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: UseCaseKind } | { mode: 'move' } | { mode: 'remove' };

/** Every step of the use case, flow by flow. */
const stepsOfUseCase = (useCase: UseCasePage): StepOnPage[] => useCase.flows.flatMap(stepsOf);

/** A record of the use case with its actions; a form or the remove question shows in place of its page. */
export function UseCaseEditor({ index, useCase, id, kind, children }: { index: SpecIndex; useCase: UseCasePage; id: string; kind: UseCaseKind; children: ReactNode }) {
  const writer = useWriter();
  const [mode, setMode] = useState<Mode>({ mode: 'view' });
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => { setMode({ mode: 'view' }); }, [id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode({ mode: 'view' });
    setTimeout(() => toolbar.current?.querySelector<HTMLElement>('button')?.focus(), 0);
  };
  const context: FormContext = { index, useCase, writer, onDone: back };
  if (mode.mode === 'change') return <div className="spec-body"><ChangeForm context={context} id={id} kind={kind} /></div>;
  if (mode.mode === 'add') return <div className="spec-body"><AddForm context={context} parent={id} kind={mode.kind} /></div>;
  if (mode.mode === 'move') return <div className="spec-body"><MoveForm context={context} /></div>;
  // A flow has one flow test: once it has it, there is nothing more to add of that kind.
  const addable = ADDED_UNDER[kind].filter((k) => k !== 'flow_test' || !useCase.flows.some((f) => f.flow.id === id && f.test));
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        {MOVE[kind] && <Button onClick={() => setMode({ mode: 'move' })}>Move</Button>}
        {addable.map((k) => <Button key={k} icon="plus" onClick={() => setMode({ mode: 'add', kind: k })}>Add {LABEL[k]}</Button>)}
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && <RemovePanel context={context} id={id} kind={kind} />}
      {children}
    </>
  );
}

// ---------- Forms ----------

interface FormContext {
  index: SpecIndex;
  useCase: UseCasePage;
  writer: Writer;
  onDone: () => void;
}

/** A form's draft: each field's text (a list's items one per line), and each list of IDs. */
interface Draft {
  text: Record<string, string>;
  ids: Record<string, string[]>;
}

/** The column of one of the aggregate's tables, as the schema describes it. */
function columnOf(index: SpecIndex, table: string, name: string): ColumnDescription {
  const found = index.workspace.schema.tables[table]?.columns.find((c) => c.name === name);
  return found ?? { name, sqlType: 'VARCHAR', kind: 'text', required: false, description: null };
}

/** The records of the use case's product of one kind, as choices: what a field of the use case may name. */
function productChoices(index: SpecIndex, useCase: UseCasePage, kinds: readonly string[]): Choice[] {
  const product = index.byId.get(useCase.useCase.id)?.product;
  return [...index.byId.values()].filter((r) => kinds.includes(r.kind) && r.product === product).map((r) => ({ id: r.id, title: r.title }));
}

/** A form that sends one command: its heading, its fields, Save and Cancel, and the refusal when it is refused. */
function CommandForm({ eyebrow, title, submit, saveLabel, onCancel, children }: {
  eyebrow: string;
  title: string;
  submit: () => Promise<WriteAnswer | null>;
  saveLabel: string;
  onCancel: () => void;
  children: (first: React.RefObject<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement | null>) => ReactNode;
}) {
  const formId = useId();
  const first = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  const [refusal, setRefusal] = useState<{ error: string; problems: StoreProblem[] } | null>(null);
  const [tries, setTries] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => { first.current?.focus(); }, []);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const answer = await submit();
    setSaving(false);
    setTries((t) => t + 1);
    if (answer && !answer.ok) setRefusal({ error: answer.error, problems: answer.problems });
  };
  return (
    <form className="record-form" aria-labelledby={`${formId}-heading`} onSubmit={onSubmit} noValidate>
      <header className="record-form-head">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={`${formId}-heading`}>{title}</h2>
      </header>
      {refusal && (
        <Refusal title="The change was refused. Nothing was saved." reasons={refusal.problems.length > 0 ? refusal.problems.map(problemText) : [refusal.error]} focusKey={tries} />
      )}
      <fieldset className="form-group">
        <legend>Fields</legend>
        {children(first)}
      </fieldset>
      <div className="record-form-actions">
        <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : saveLabel}</Button>
        <Button onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </form>
  );
}

/** One field of a form, by what it is: a column of a table, a record the field names, or a list of them. */
type FieldSpec =
  | { field: string; column: string; table: string; long?: boolean; required?: boolean }
  | { field: string; label: string; description: string; one: Choice[]; required?: boolean }
  | { field: string; label: string; description: string; many: Choice[] };

/** The fields of a form, drawn from the shared inputs in the order given; the first takes focus. */
function Fields({ index, specs, draft, setDraft, first }: {
  index: SpecIndex;
  specs: FieldSpec[];
  draft: Draft;
  setDraft: (change: (d: Draft) => Draft) => void;
  first: React.RefObject<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement | null>;
}) {
  const formId = useId();
  return (
    <>
      {specs.map((spec, at) => {
        const id = `${formId}-field-${spec.field}`;
        const ref = at === 0 ? first : undefined;
        if ('column' in spec) {
          const column = columnOf(index, spec.table, spec.column);
          return (
            <ColumnField key={spec.field} id={id} column={column} label={spec.field === 'id' ? 'ID' : spec.column.replaceAll('_', ' ')} long={spec.long}
              required={spec.required ?? column.required} value={draft.text[spec.field] ?? ''} inputRef={ref}
              onChange={(text) => setDraft((d) => ({ ...d, text: { ...d.text, [spec.field]: text } }))} />
          );
        }
        if ('one' in spec) {
          return (
            <IdField key={spec.field} id={id} label={spec.label} description={spec.description} choices={spec.one} required={spec.required} inputRef={ref}
              value={draft.text[spec.field] ?? ''} onChange={(value) => setDraft((d) => ({ ...d, text: { ...d.text, [spec.field]: value } }))} />
          );
        }
        return (
          <IdsField key={spec.field} id={id} label={spec.label} description={spec.description} choices={spec.many} ids={draft.ids[spec.field] ?? []}
            renderId={(target) => <RecordLink index={index} id={target} />}
            onChange={(ids) => setDraft((d) => ({ ...d, ids: { ...d.ids, [spec.field]: ids } }))} />
        );
      })}
    </>
  );
}

/** The fields each kind's Add and Change take (Change leaves out the ID and the parent), in their input's order. */
function fieldsOf(context: FormContext, kind: UseCaseKind, adding: boolean, parent: string): FieldSpec[] {
  const { index, useCase } = context;
  const id = (table: string): FieldSpec[] => (adding ? [{ field: 'id', column: 'id', table }] : []);
  const test = (table: string): FieldSpec[] => [
    { field: 'level', column: 'level', table },
    { field: 'state', column: 'state', table },
    { field: 'file', column: 'file', table },
    { field: 'manual_reason', column: 'manual_reason', table, long: true },
    { field: 'size', column: 'size', table },
    { field: 'smoke', column: 'smoke', table },
    { field: 'external', column: 'external', table },
  ];
  const startsFrom: FieldSpec = { field: 'starts_from', label: 'Starts from', description: 'The test data sets it starts from.', many: productChoices(index, useCase, ['test_data_set']) };
  switch (kind) {
    case 'use_case':
      return [
        { field: 'title', column: 'title', table: 'use_case' },
        { field: 'goal', column: 'goal', table: 'use_case', long: true },
        { field: 'notes', column: 'notes', table: 'use_case', long: true },
        { field: 'actors', column: 'role_name', table: 'use_case_actor', required: false },
      ];
    case 'uc_requirement':
      return [
        ...id('uc_requirement'),
        { field: 'title', column: 'title', table: 'uc_requirement' },
        { field: 'statement', column: 'statement', table: 'uc_requirement', long: true },
        { field: 'group_name', column: 'group_name', table: 'uc_requirement' },
      ];
    case 'flow': {
      const through = new Set(useCase.flows.map((f) => f.flow.interface_id));
      return [
        ...id('flow'),
        { field: 'title', column: 'title', table: 'flow' },
        ...(adding ? [{ field: 'interface_id', label: 'Interface', description: 'The interface it goes through: one its use case has no flow through yet. The flow\'s ID ends in its number.', one: productChoices(index, useCase, ['interface']).filter((c) => !through.has(c.id)), required: true }] : []),
      ];
    }
    case 'flow_step': {
      const flowId = adding ? parent : stepsOfUseCase(useCase).find((s) => s.step.id === parent)!.step.flow_id;
      return [
        ...id('flow_step'),
        { field: 'title', column: 'title', table: 'flow_step' },
        { field: 'path', column: 'path', table: 'flow_step' },
        { field: 'position', column: 'position', table: 'flow_step' },
        { field: 'fulfills', label: 'Fulfills', description: `The UC requirements of ${useCase.useCase.id} it fulfills.`, many: useCase.requirements.map(({ requirement: r }) => ({ id: r.id, title: r.title })) },
        { field: 'invokes', label: 'Invokes', description: 'The command or query it invokes, if any.', one: productChoices(index, useCase, ['command', 'query']) },
        { field: 'happens_in', label: 'Happens in', description: `The view it happens in, if any: only on a web app, desktop or other interface (${flowId} goes through ${useCase.flows.find((f) => f.flow.id === flowId)?.flow.interface_id ?? 'its interface'}).`, one: productChoices(index, useCase, ['view']) },
        { field: 'exchanges_with', label: 'Exchanges with', description: 'The integrations it exchanges with.', many: productChoices(index, useCase, ['integration']) },
      ];
    }
    case 'use_case_test':
      return [
        ...id('use_case_test'),
        { field: 'title', column: 'title', table: 'use_case_test' },
        { field: 'when', column: 'when', table: 'use_case_test', long: true },
        { field: 'then', column: 'then', table: 'use_case_test', long: true },
        ...test('use_case_test'),
        { field: 'notes', column: 'notes', table: 'use_case_test', long: true },
        startsFrom,
      ];
    case 'flow_test':
      return [
        ...id('flow_test'),
        { field: 'title', column: 'title', table: 'flow_test' },
        { field: 'steps', column: 'steps', table: 'flow_test' },
        { field: 'expected_result', column: 'expected_result', table: 'flow_test', long: true },
        ...test('flow_test'),
        { field: 'notes', column: 'notes', table: 'flow_test', long: true },
        startsFrom,
      ];
  }
}

/** The record's current values, by its input's field names, as a draft: its row's columns and the links it starts. */
function currentOf(useCase: UseCasePage, kind: UseCaseKind, id: string): { values: Record<string, Value | undefined>; ids: Record<string, string[]> } {
  const row = <T extends object>(r: T) => r as unknown as Record<string, Value | undefined>;
  const tested = (t: TestOnPage<object>) => ({ values: row(t.test), ids: { starts_from: t.startsFrom } });
  switch (kind) {
    case 'use_case':
      return { values: { ...row(useCase.useCase), actors: useCase.actors }, ids: {} };
    case 'uc_requirement':
      return { values: row(useCase.requirements.find((r) => r.requirement.id === id)!.requirement), ids: {} };
    case 'flow':
      return { values: row(useCase.flows.find((f) => f.flow.id === id)!.flow), ids: {} };
    case 'flow_step': {
      const step: StepOnPage = stepsOfUseCase(useCase).find((s) => s.step.id === id)!;
      return { values: { ...row(step.step), invokes: step.invokes ?? undefined, happens_in: step.happensIn ?? undefined }, ids: { fulfills: step.fulfills, exchanges_with: step.exchangesWith } };
    }
    case 'use_case_test':
      return tested(useCase.requirements.flatMap((r) => r.tests).find((t) => t.test.id === id)!);
    case 'flow_test':
      return tested(useCase.flows.find((f) => f.test?.test.id === id)!.test!);
  }
}

/** The column a field's text becomes the value of; a field naming a record is its ID, as text. */
const columnFor = (index: SpecIndex, spec: FieldSpec): ColumnDescription | null => ('column' in spec ? columnOf(index, spec.table, spec.column) : null);

/** A field's value from its text: the column's value, a list of lines for the actors, or the ID it names. */
function valueOf(index: SpecIndex, spec: FieldSpec, text: string): Value | undefined {
  const column = columnFor(index, spec);
  if (spec.field === 'actors') return text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!column) return text.trim() || undefined;
  return columnValue(column, text);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Each kind's Change command, and the fields it may clear with null. */
const CHANGE: Record<UseCaseKind, { route: UseCaseRoute; clearable: readonly string[] }> = {
  use_case: { route: '/api/use-case/change-use-case', clearable: ['notes'] },
  uc_requirement: { route: '/api/use-case/change-uc-requirement', clearable: ['group_name'] },
  flow: { route: '/api/use-case/change-flow', clearable: [] },
  flow_step: { route: '/api/use-case/change-flow-step', clearable: ['invokes', 'happens_in'] },
  use_case_test: { route: '/api/use-case/change-use-case-test', clearable: ['file', 'manual_reason', 'size', 'smoke', 'external', 'notes'] },
  flow_test: { route: '/api/use-case/change-flow-test', clearable: ['file', 'manual_reason', 'size', 'smoke', 'external', 'notes'] },
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<UseCaseKind, { route: UseCaseRoute; parent: string }> = {
  use_case: { route: '/api/use-case/add-use-case', parent: 'capability_id' },
  uc_requirement: { route: '/api/use-case/add-uc-requirement', parent: 'use_case_id' },
  flow: { route: '/api/use-case/add-flow', parent: 'use_case_id' },
  flow_step: { route: '/api/use-case/add-flow-step', parent: 'flow_id' },
  use_case_test: { route: '/api/use-case/add-use-case-test', parent: 'uc_requirement_id' },
  flow_test: { route: '/api/use-case/add-flow-test', parent: 'flow_id' },
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: UseCaseRoute, input: Record<string, unknown>) => sendUseCase(writer, route, input as unknown as UseCaseCommands[typeof route]);

/** Edit: the record's Change, with only what changed (a field emptied is cleared where it may be). */
function ChangeForm({ context, id, kind }: { context: FormContext; id: string; kind: UseCaseKind }) {
  const { index, useCase, writer, onDone } = context;
  const announce = useAnnounce();
  const specs = fieldsOf(context, kind, false, id);
  const current = currentOf(useCase, kind, id);
  const [draft, setDraft] = useState<Draft>(() => ({
    text: Object.fromEntries(specs.filter((s) => !('many' in s)).map((s) => [s.field, columnText(current.values[s.field])])),
    ids: Object.fromEntries(specs.filter((s) => 'many' in s).map((s) => [s.field, current.ids[s.field] ?? []])),
  }));
  const submit = async () => {
    const input: Record<string, unknown> = { id };
    for (const spec of specs) {
      if ('many' in spec) {
        if (!same([...(current.ids[spec.field] ?? [])].sort(), [...(draft.ids[spec.field] ?? [])].sort())) input[spec.field] = draft.ids[spec.field] ?? [];
        continue;
      }
      const value = valueOf(index, spec, draft.text[spec.field] ?? '');
      if (same(value, current.values[spec.field])) continue;
      // Emptied: cleared where the command may clear it; otherwise sent empty, and the command says why it is needed.
      input[spec.field] = value ?? (CHANGE[kind].clearable.includes(spec.field) ? null : '');
    }
    if (Object.keys(input).length === 1) { announce('Nothing changed'); onDone(); return null; }
    const answer = await send(writer, CHANGE[kind].route, input);
    if (answer.ok) { announce(`Saved ${id}`); onDone(); }
    return answer;
  };
  return (
    <CommandForm eyebrow={LABEL[kind].charAt(0).toUpperCase() + LABEL[kind].slice(1)} title={`Edit ${id}`} submit={submit} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add: an empty form for a kind under the record, its ID the next free one, sent as that kind's Add. */
function AddForm({ context, parent, kind }: { context: FormContext; parent: string; kind: UseCaseKind }) {
  const { index, useCase, writer, onDone } = context;
  const announce = useAnnounce();
  const specs = fieldsOf(context, kind, true, parent);
  const next = useNextId(kind, parent, index);
  const [draft, setDraft] = useState<Draft>(() => ({
    text: { path: kind === 'flow_step' ? 'main' : '', ...(kind === 'flow_step' ? { position: String(nextPosition(stepsOfUseCase(useCase).filter((s) => s.step.flow_id === parent))) } : {}) },
    ids: {},
  }));
  // The suggested ID fills the field once it is read, unless something was typed there first.
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  // A flow's ID ends in its interface's number: picking the interface names it.
  const update = (change: (d: Draft) => Draft) => setDraft((d) => {
    const after = change(d);
    if (kind === 'flow' && after.text.interface_id !== d.text.interface_id) {
      const number = /-IF(\d+)$/.exec(after.text.interface_id ?? '')?.[1];
      if (number) after.text = { ...after.text, id: `${useCase.useCase.id}-FL${number}` };
    }
    return after;
  });
  const submit = async () => {
    const input: Record<string, unknown> = { [ADD[kind].parent]: parent };
    for (const spec of specs) {
      if ('many' in spec) {
        if ((draft.ids[spec.field] ?? []).length > 0) input[spec.field] = draft.ids[spec.field];
        continue;
      }
      const value = valueOf(index, spec, draft.text[spec.field] ?? '');
      if (value !== undefined && !(Array.isArray(value) && value.length === 0 && spec.field === 'actors')) input[spec.field] = value;
    }
    const answer = await send(writer, ADD[kind].route, input);
    if (answer.ok) {
      announce(`Added ${String(input.id)}`);
      navigate(addressOf(String(input.id)));
    }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New ${LABEL[kind]} under ${parent}`} title={`Add ${withArticle(kind)}`} submit={submit} saveLabel={`Add ${LABEL[kind]}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={update} first={first} />}
    </CommandForm>
  );
}

/** One past the highest position on the main path, for a new step. */
const nextPosition = (steps: readonly StepOnPage[]) => Math.max(0, ...steps.filter((s) => (s.step.path || 'main') === 'main').map((s) => s.step.position)) + 1;

/** Move: the use case to another capability of its product, as its own command. */
function MoveForm({ context }: { context: FormContext }) {
  const { index, useCase, writer, onDone } = context;
  const announce = useAnnounce();
  const [capability, setCapability] = useState(useCase.useCase.capability_id);
  const formId = useId();
  const choices = productChoices(index, useCase, ['capability']);
  const submit = async () => {
    if (capability === useCase.useCase.capability_id) { announce('Nothing changed'); onDone(); return null; }
    const answer = await sendUseCase(writer, MOVE.use_case!, { id: useCase.useCase.id, capability_id: capability });
    if (answer.ok) { announce(`Moved ${useCase.useCase.id}`); onDone(); }
    return answer;
  };
  return (
    <CommandForm eyebrow="Use case" title={`Move ${useCase.useCase.id}`} submit={submit} saveLabel="Move" onCancel={onDone}>
      {(first) => (
        <IdField id={`${formId}-capability`} label="Capability" required inputRef={first} choices={choices} value={capability} onChange={setCapability}
          description="The capability of its product it moves to; everything in the use case moves with it." />
      )}
    </CommandForm>
  );
}

/** What goes with a record when it is removed, inside the use case: what sits under it. */
function goesWith(useCase: UseCasePage, kind: UseCaseKind, id: string): string[] {
  const testsOf = (requirement: string) => (useCase.requirements.find((r) => r.requirement.id === requirement)?.tests ?? []).map((t) => t.test.id);
  const ofFlow = (flow: string) => {
    const found = useCase.flows.find((f) => f.flow.id === flow);
    return found ? [...stepsOf(found).map((s) => s.step.id), ...(found.test ? [found.test.test.id] : [])] : [];
  };
  switch (kind) {
    case 'use_case':
      return [...useCase.requirements.flatMap((r) => [r.requirement.id, ...testsOf(r.requirement.id)]), ...useCase.flows.flatMap((f) => [f.flow.id, ...ofFlow(f.flow.id)])];
    case 'uc_requirement':
      return testsOf(id);
    case 'flow':
      return ofFlow(id);
    default:
      return [];
  }
}

/** Each kind's Remove command. */
const REMOVE: Record<UseCaseKind, UseCaseRoute> = {
  use_case: '/api/use-case/remove-use-case',
  uc_requirement: '/api/use-case/remove-uc-requirement',
  flow: '/api/use-case/remove-flow',
  flow_step: '/api/use-case/remove-flow-step',
  use_case_test: '/api/use-case/remove-use-case-test',
  flow_test: '/api/use-case/remove-flow-test',
};

/** The record a removed one's page gives way to: what it sits under. */
function parentOf(useCase: UseCasePage, kind: UseCaseKind, id: string): string {
  switch (kind) {
    case 'use_case': return useCase.useCase.capability_id;
    case 'uc_requirement':
    case 'flow': return useCase.useCase.id;
    case 'flow_step': return stepsOfUseCase(useCase).find((s) => s.step.id === id)!.step.flow_id;
    case 'use_case_test': return useCase.requirements.find((r) => r.tests.some((t) => t.test.id === id))!.requirement.id;
    case 'flow_test': return useCase.flows.find((f) => f.test?.test.id === id)!.flow.id;
  }
}

/** Remove: says what goes with the record, sends its Remove, and shows the refusal (what still references it). */
function RemovePanel({ context, id, kind }: { context: FormContext; id: string; kind: UseCaseKind }) {
  const { index, useCase, writer, onDone } = context;
  const announce = useAnnounce();
  const [refusal, setRefusal] = useState<{ error: string; problems: StoreProblem[] } | null>(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const goes = goesWith(useCase, kind, id);
  const remove = async () => {
    setBusy(true);
    const answer = await sendUseCase(writer, REMOVE[kind], { id });
    setBusy(false);
    setTries((t) => t + 1);
    if (!answer.ok) { setRefusal({ error: answer.error, problems: answer.problems }); return; }
    announce(`Removed ${id}`);
    navigate(addressOf(parentOf(useCase, kind, id)));
  };
  return (
    <section className="remove-panel" aria-labelledby={`remove-${id}`}>
      <h2 id={`remove-${id}`} tabIndex={-1} ref={heading}>Remove {id}?</h2>
      <p>This removes the {LABEL[kind]} <strong>{index.byId.get(id)?.title ?? id}</strong> and the links it starts{goes.length > 0 ? `, with the ${goes.length} ${goes.length === 1 ? 'record' : 'records'} under it` : ''}. It is refused while anything else still references them.</p>
      {goes.length > 0 && (
        <ul className="plain remove-referrers" aria-label={`What goes with ${id}`}>
          {goes.slice(0, 20).map((g) => <li key={g}><RecordLink index={index} id={g} /></li>)}
          {goes.length > 20 && <li className="hint">and {goes.length - 20} more</li>}
        </ul>
      )}
      {refusal && <Refusal title="The removal was refused. Nothing was changed." reasons={refusal.problems.length > 0 ? refusal.problems.map(problemText) : [refusal.error]} focusKey={tries} />}
      <div className="record-form-actions">
        <Button danger onClick={remove} disabled={busy}>{busy ? 'Removing…' : `Remove ${id}`}</Button>
        <Button onClick={onDone} disabled={busy}>Cancel</Button>
      </div>
    </section>
  );
}

/** Add a use case to a capability (from the capability's page): the aggregate's own Add, its ID the next free one. */
export function AddUseCaseForm({ index, parent, onDone }: { index: SpecIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextId('use_case', parent, index);
  const [draft, setDraft] = useState<Draft>({ text: {}, ids: {} });
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs: FieldSpec[] = [
    { field: 'id', column: 'id', table: 'use_case' },
    { field: 'title', column: 'title', table: 'use_case' },
    { field: 'goal', column: 'goal', table: 'use_case', long: true },
    { field: 'notes', column: 'notes', table: 'use_case', long: true },
    { field: 'actors', column: 'role_name', table: 'use_case_actor', required: false },
  ];
  const submit = async () => {
    const input: Record<string, unknown> = { capability_id: parent };
    for (const spec of specs) {
      const value = valueOf(index, spec, draft.text[spec.field] ?? '');
      if (value !== undefined && !(Array.isArray(value) && value.length === 0)) input[spec.field] = value;
    }
    const answer = await send(writer, '/api/use-case/add-use-case', input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New use case under ${parent}`} title="Add a use case" submit={submit} saveLabel="Add use case" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
