import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { UseCaseKind } from '../../../../lathe/src/authoring/use-case/model';
import type { StepOnPage, TestOnPage, UseCasePage } from '../../../../lathe/src/authoring/use-case/read-model';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import { IdField, type Choice } from '../../edit/fields';
import { AddMenu } from '../../edit/AddMenu';
import { useWriter, type Writer } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { sendUseCase, type UseCaseCommands, type UseCaseRoute } from './commands';
import { stepsOf, useNextId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';

// The Use case editor (LA-AUT-A11): the actions on a record of a use case, each sending one of the aggregate's own
// commands, POST /api/use-case/<command>, and nothing else. Edit sends its kind's Change with only what changed; Add
// opens an empty form for a kind that sits under the record in the use case, with the next free ID read from the
// aggregate (next-id), and sends its Add; Move, offered only for a kind the aggregate has a Move command for (a use
// case: Move a use case, to another capability), sends that command; Remove
// says what goes with the record and sends its Remove. Each form is the shared command form (edit/command-form.tsx),
// its fields those of its command's input. A refusal shows every reason the command gave, in its own words, keeps what was
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
export function UseCaseEditor({ index, useCase, id, kind, children }: { index: RecordIndex; useCase: UseCasePage; id: string; kind: UseCaseKind; children: ReactNode }) {
  const writer = useWriter();
  const [mode, setMode] = useState<Mode>({ mode: 'view' });
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => { setMode({ mode: 'view' }); }, [id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode({ mode: 'view' });
    backToActions(toolbar, `Change ${id}`);
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
        <AddMenu id={id} choices={addable.map((k) => ({ key: k, label: kindLabel(index, k) }))} onPick={(k) => setMode({ mode: 'add', kind: k as UseCaseKind })} />
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={LABEL[kind]} goes={goesWith(useCase, kind, id)} then={addressOf(parentOf(useCase, kind, id))} onCancel={back}
          remove={() => sendUseCase(writer, REMOVE[kind], { id })} />
      )}
      {children}
    </>
  );
}

// ---------- Forms ----------

interface FormContext {
  index: RecordIndex;
  useCase: UseCasePage;
  writer: Writer;
  onDone: () => void;
}

/** The records of the use case's product of one kind, as choices: what a field of the use case may name. */
function productChoices(index: RecordIndex, useCase: UseCasePage, kinds: readonly string[]): Choice[] {
  const product = index.byId.get(useCase.useCase.id)?.product;
  return [...index.byId.values()].filter((r) => kinds.includes(r.kind) && r.product === product).map((r) => ({ id: r.id, title: r.title }));
}

/** A use case's actors: the roles that take part, one per line. */
const ACTORS: FieldSpec = { field: 'actors', label: 'Actors', description: 'The roles that take part in it.', texts: true };

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
        ACTORS,
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

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(useCase: UseCasePage, kind: UseCaseKind, id: string): Record<string, unknown> {
  const tested = (t: TestOnPage<object>) => ({ ...t.test, starts_from: t.startsFrom });
  switch (kind) {
    case 'use_case':
      return { ...useCase.useCase, actors: useCase.actors };
    case 'uc_requirement':
      return { ...useCase.requirements.find((r) => r.requirement.id === id)!.requirement };
    case 'flow':
      return { ...useCase.flows.find((f) => f.flow.id === id)!.flow };
    case 'flow_step': {
      const step: StepOnPage = stepsOfUseCase(useCase).find((s) => s.step.id === id)!;
      return { ...step.step, invokes: step.invokes ?? undefined, happens_in: step.happensIn ?? undefined, fulfills: step.fulfills, exchanges_with: step.exchangesWith };
    }
    case 'use_case_test':
      return tested(useCase.requirements.flatMap((r) => r.tests).find((t) => t.test.id === id)!);
    case 'flow_test':
      return tested(useCase.flows.find((f) => f.test?.test.id === id)!.test!);
  }
}

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
  const [draft, setDraft] = useState<Draft>(() => draftOf(specs, current));
  const submit = async () => {
    const input = changeInput(index, specs, draft, current, { id }, CHANGE[kind].clearable);
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
    ...emptyDraft(),
    text: { path: kind === 'flow_step' ? 'main' : '', ...(kind === 'flow_step' ? { position: String(nextPosition(stepsOfUseCase(useCase).filter((s) => s.step.flow_id === parent))) } : {}) },
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
    const input = addInput(index, specs, draft, { [ADD[kind].parent]: parent });
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

/** Add a use case to a capability (from the capability's page): the aggregate's own Add, its ID the next free one. */
export function AddUseCaseForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextId('use_case', parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs: FieldSpec[] = [
    { field: 'id', column: 'id', table: 'use_case' },
    { field: 'title', column: 'title', table: 'use_case' },
    { field: 'goal', column: 'goal', table: 'use_case', long: true },
    { field: 'notes', column: 'notes', table: 'use_case', long: true },
    ACTORS,
  ];
  const submit = async () => {
    const input = addInput(index, specs, draft, { capability_id: parent });
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
