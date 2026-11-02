import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { JourneyKind } from '../../../../lathe/src/product/journey/model';
import type { JourneyPage, StepOnPage } from '../../../../lathe/src/product/journey/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, addOrChangeFields, changeInput, CommandForm, draftOf, emptyDraft, Fields, formFields, LONG, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import { IdField, type Choice } from '../../edit/fields';
import { AddMenu } from '../../edit/AddMenu';
import { useWriter, type Writer, type CommandInputs, type CommandRoute } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { compareIds, kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { AddUseCaseForm } from '../../use-cases/use-case/UseCaseEditor';
import { JOURNEY_FIELDS } from './fields.generated';
import { useNextJourneyId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { kindWord, addedUnder } from '../../platform/meta-model/reads';

// The Journey editor (LA-PRD-A25): the actions on a record of a journey, each sending one of the aggregate's own
// commands, POST /api/journey/<command>, and nothing else. Edit sends its kind's Change with only what changed; Add
// opens an empty form for a kind that sits under the record (a step or the journey test under the journey), with the
// next free ID read from the aggregate (next-id), a new step on the main path after the last, and sends its Add; Remove
// says what goes with the record and sends its Remove. A step moves up and down from the page's list (StepMoves,
// Move a journey step); a step that carries out nothing yet offers Add use case, which asks for the capability, opens
// the use case's Add with the step's words as its title and then links the step to it (Add a use case, then Change a
// journey step). The aggregate has no Move for a journey. A journey is added from its product's page (AddJourneyForm).
// What a step may carry out is the product's use cases and policies, grouped by domain; what a journey may serve is the
// product's business outcomes. A refusal shows every reason the command gave, keeps what was entered, and changes nothing.

/** The kinds a record of another kind has under it inside the journey; the meta model says which sit under which. */
const INSIDE: readonly JourneyKind[] = ['journey_step', 'journey_test'];

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: JourneyKind } | { mode: 'remove' } | { mode: 'write'; step: string; title: string };

/** What the page's step rows ask of the editor: to write the use case a step lacks. Nothing where the records are only read. */
const WriteUseCase = createContext<((step: string, title: string) => void) | null>(null);
export const useWriteUseCase = () => useContext(WriteUseCase);

/** The records of the product of these kinds, as choices. */
function productChoices(index: RecordIndex, product: string, kinds: readonly string[], titled: (r: { id: string; title: string; domain?: string | null }) => string = (r) => r.title): Choice[] {
  return [...index.byId.values()].filter((r) => kinds.includes(r.kind) && r.product === product).map((r) => ({ id: r.id, title: titled(r) }));
}

/** The use cases and policies of the product that a step may carry out, each with its domain: the choices stand in domain order. */
function carryOutChoices(index: RecordIndex, product: string): Choice[] {
  const domainOf = (r: { domain?: string | null }) => index.byId.get(r.domain ?? '')?.title ?? '';
  return productChoices(index, product, ['use_case', 'policy'], (r) => `${r.title} (${domainOf(r)})`).sort((a, b) => (index.byId.get(a.id)?.domain ?? '').localeCompare(index.byId.get(b.id)?.domain ?? '') || compareIds(a.id, b.id));
}

/** The fields each kind's Add and Change take, from their inputs (Change leaves out the ID, Add the parent). */
function fieldsOf(index: RecordIndex, product: string, kind: JourneyKind, adding: boolean): FieldSpec[] {
  const F = JOURNEY_FIELDS;
  switch (kind) {
    case 'journey':
      return addOrChangeFields(adding, F['/api/journey/add-journey'], 'product_id', F['/api/journey/change-journey'], { notes: LONG, serves: { choices: productChoices(index, product, ['business_outcome']) } });
    case 'journey_step':
      return addOrChangeFields(adding, F['/api/journey/add-journey-step'], 'journey_id', F['/api/journey/change-journey-step'], { carries_out: { choices: carryOutChoices(index, product) } });
    case 'journey_test':
      return addOrChangeFields(adding, F['/api/journey/add-journey-test'], 'journey_id', F['/api/journey/change-journey-test'], { manual_reason: LONG, expected_result: LONG, notes: LONG, starts_from: { choices: productChoices(index, product, ['test_data_set']) } });
  }
}

const stepsOf = (page: JourneyPage): StepOnPage[] => page.paths.flatMap((p) => p.steps);

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(page: JourneyPage, kind: JourneyKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'journey':
      return { ...page.journey, serves: page.serves };
    case 'journey_step': {
      const step = stepsOf(page).find((s) => s.step.id === id)!;
      return { ...step.step, carries_out: step.carriesOut?.id };
    }
    case 'journey_test':
      return { ...page.test!.test, starts_from: page.test!.startsFrom };
  }
}

/** Each kind's Change command. */
const CHANGE: Record<JourneyKind, CommandRoute> = {
  journey: '/api/journey/change-journey',
  journey_step: '/api/journey/change-journey-step',
  journey_test: '/api/journey/change-journey-test',
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<JourneyKind, { route: CommandRoute; parent: string }> = {
  journey: { route: '/api/journey/add-journey', parent: 'product_id' },
  journey_step: { route: '/api/journey/add-journey-step', parent: 'journey_id' },
  journey_test: { route: '/api/journey/add-journey-test', parent: 'journey_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<JourneyKind, CommandRoute> = {
  journey: '/api/journey/remove-journey',
  journey_step: '/api/journey/remove-journey-step',
  journey_test: '/api/journey/remove-journey-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: CommandRoute, input: Record<string, unknown>): Promise<WriteAnswer> => writer.command(route, input as unknown as CommandInputs[typeof route]);

/** What goes with a record when it is removed, inside the journey: what sits under it. */
function goesWith(page: JourneyPage, kind: JourneyKind): string[] {
  return kind === 'journey' ? [...stepsOf(page).map((s) => s.step.id), ...(page.test ? [page.test.test.id] : [])] : [];
}

/** The record a removed one's page gives way to: what it sits under. */
const parentOf = (page: JourneyPage, kind: JourneyKind): string => (kind === 'journey' ? page.journey.product_id : page.journey.id);

/** One past the highest position on the main path, for a new step. */
const nextPosition = (page: JourneyPage) => Math.max(0, ...(page.paths.find((p) => p.name === 'main')?.steps ?? []).map((s) => s.step.position)) + 1;

/** A record of the journey with its actions; a form or the remove question shows in place of its page. */
export function JourneyEditor({ index, page, children }: { index: RecordIndex; page: JourneyPage; children: ReactNode }) {
  const writer = useWriter();
  const announce = useAnnounce();
  const [mode, setMode] = useState<Mode>({ mode: 'view' });
  const toolbar = useRef<HTMLDivElement>(null);
  const { id, kind } = page.record;
  const product = page.journey.product_id;
  useEffect(() => { setMode({ mode: 'view' }); }, [id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode({ mode: 'view' });
    backToActions(`Change ${id}`, toolbar);
  };
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, product, kind, false);
    const current = currentOf(page, kind, id);
    const submit = async (draft: Draft) => {
      const input = changeInput(index, specs, draft, current, { id });
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await send(writer, CHANGE[kind], input);
      if (answer.ok) { announce(`Saved ${id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} eyebrow={kindWord(index.meta, kind)} id={id} submit={submit} onDone={back} /></div>;
  }
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} page={page} kind={mode.kind} parent={page.journey.id} onDone={back} /></div>;
  if (mode.mode === 'write') return <div className="spec-body"><WriteUseCaseForm index={index} step={mode.step} title={mode.title} onDone={back} /></div>;
  // A journey has one journey test: once it has it, there is nothing more to add of that kind.
  const adds = addedUnder(index.meta, kind, INSIDE).filter((k) => k !== 'journey_test' || !page.test);
  return (
    <WriteUseCase.Provider value={(step, title) => setMode({ mode: 'write', step, title })}>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        <AddMenu id={id} choices={adds.map((k) => ({ key: k, label: kindLabel(index, k) }))} onPick={(k) => setMode({ mode: 'add', kind: k as JourneyKind })} />
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={kindWord(index.meta, kind)} goes={goesWith(page, kind)} then={addressOf(parentOf(page, kind))} onCancel={back}
          remove={() => writer.command(REMOVE[kind], { id })} />
      )}
      {children}
    </WriteUseCase.Provider>
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

/** The next free ID fills the form's ID field once it is read, unless something was typed there first. */
function useSuggestedId(kind: JourneyKind, parent: string, index: RecordIndex, setDraft: (update: (d: Draft) => Draft) => void) {
  const next = useNextJourneyId(kind, parent, index);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next, setDraft]);
}

/** Add: an empty form for a kind under the record, its ID the next free one, sent as that kind's Add. */
function AddForm({ index, page, kind, parent, onDone }: { index: RecordIndex; page: JourneyPage; kind: JourneyKind; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const specs = fieldsOf(index, page.journey.product_id, kind, true);
  // A new step is on the main path, after the last.
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), text: kind === 'journey_step' ? { path: 'main', position: String(nextPosition(page)) } as Record<string, string> : {} }));
  useSuggestedId(kind, parent, index, setDraft);
  const submit = async () => {
    const input = addInput(index, specs, draft, { [ADD[kind].parent]: parent });
    const answer = await send(writer, ADD[kind].route, input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  const article = /^[aeiou]/.test(kindWord(index.meta, kind)) ? 'an' : 'a';
  return (
    <CommandForm eyebrow={`New ${kindWord(index.meta, kind)} under ${parent}`} title={`Add ${article} ${kindWord(index.meta, kind)}`} submit={submit} saveLabel={`Add ${kindWord(index.meta, kind)}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a journey to a product (from the product's page): the aggregate's own Add, its ID the next free one. */
export function AddJourneyForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const specs = formFields(JOURNEY_FIELDS['/api/journey/add-journey'], ['product_id'], { notes: LONG, serves: { choices: productChoices(index, parent, ['business_outcome']) } });
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useSuggestedId('journey', parent, index, setDraft);
  const submit = async () => {
    const input = addInput(index, specs, draft, { product_id: parent });
    const answer = await send(writer, '/api/journey/add-journey', input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New journey under ${parent}`} title="Add a journey" submit={submit} saveLabel="Add journey" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/**
 * Add use case on a step that carries out nothing yet, in one gesture: choose the capability, then the use case's own
 * Add opens with the step's words as its title; once it is added the step is linked to it (Change a journey step).
 */
function WriteUseCaseForm({ index, step, title, onDone }: { index: RecordIndex; step: string; title: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const formId = useId();
  const product = index.byId.get(step)?.product ?? index.product;
  const choices = productChoices(index, product, ['capability'], (r) => `${r.title} (${index.byId.get(r.domain ?? '')?.title ?? ''})`);
  const [capability, setCapability] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  if (chosen !== null) {
    const link = async (useCase: string) => {
      const answer = await send(writer, '/api/journey/change-journey-step', { id: step, carries_out: useCase });
      if (!answer.ok) announce(`Added ${useCase}, but linking ${step} to it was refused: ${answer.problems[0]?.message ?? answer.error}`);
    };
    return <AddUseCaseForm index={index} parent={chosen} onDone={onDone} title={title} afterAdd={link} />;
  }
  return (
    <CommandForm eyebrow={`Step ${step}`} title={`Add a use case for ${step}`} saveLabel="Continue" onCancel={onDone}
      submit={async () => {
        if (capability === '') { announce('Choose a capability'); return null; }
        setChosen(capability);
        return null;
      }}>
      {(first) => (
        <IdField id={`${formId}-capability`} label="Capability" required inputRef={first} choices={choices} value={capability} onChange={setCapability}
          description={`The capability of the product the new use case belongs to. The use case starts with the step's words as its title, and ${step} then carries it out.`} />
      )}
    </CommandForm>
  );
}
