import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PatternKind } from '../../../../lathe/src/use-cases/pattern/model';
import type { PatternPage } from '../../../../lathe/src/use-cases/pattern/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, addOrChangeFields, changeInput, CommandForm, draftOf, emptyDraft, Fields, LONG, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type Writer, type CommandInputs, type CommandRoute } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { PATTERN_FIELDS } from './fields.generated';
import { useNextPatternId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { FillSlotForm } from '../../traceability/slot-filling/FillSlotForm';
import { kindWord, addedUnder } from '../../platform/meta-model/reads';

// The Pattern editor (LA-UCS-A2): the actions on a record of a pattern, each sending one of the aggregate's own
// commands, POST /api/pattern/<command>, and nothing else. Edit sends its kind's Change with only what changed; Add
// opens an empty form for the kind that sits under the record (a rule or slot under the pattern, a test under a rule), with
// the next free ID read from the aggregate (next-id), and sends its Add; Remove says what goes with the record and
// sends its Remove; a slot's Fill slot sends the Slot filling aggregate's Fill a slot (FillSlotForm). The aggregate has
// no Move. A pattern is added from its product's page (AddPatternForm). A
// refusal shows every reason the command gave, in its own words, keeps what was entered, and changes nothing.


/** The test data sets of the product, as what a test may start from. */
const dataSets = (index: RecordIndex, product: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === 'test_data_set' && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The domains of the product, by position, as where a rule test proves its rule. */
const domains = (index: RecordIndex, product: string): Choice[] =>
  index.domains.filter((r) => r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields each kind's Add and Change take, from their inputs; the hints add long text and the choices. */
function fieldsOf(index: RecordIndex, product: string, kind: PatternKind, adding: boolean): FieldSpec[] {
  const F = PATTERN_FIELDS;
  switch (kind) {
    case 'pattern':
      return addOrChangeFields(adding, F['/api/pattern/add-pattern'], 'product_id', F['/api/pattern/change-pattern'], { description: LONG, notes: LONG });
    case 'pattern_rule':
      return addOrChangeFields(adding, F['/api/pattern/add-pattern-rule'], 'pattern_id', F['/api/pattern/change-pattern-rule'], { statement: LONG, notes: LONG });
    case 'pattern_rule_test': {
      return addOrChangeFields(adding, F['/api/pattern/add-pattern-rule-test'], 'pattern_rule_id', F['/api/pattern/change-pattern-rule-test'], {
        domain_id: { label: 'Domain', choices: domains(index, product) }, when: LONG, then: LONG, manual_reason: LONG, notes: LONG, starts_from: { choices: dataSets(index, product) },
      });
    }
    case 'slot':
      return addOrChangeFields(adding, F['/api/pattern/add-slot'], 'pattern_id', F['/api/pattern/change-slot'], { statement: LONG, fills_vary_by_design: LONG });
  }
}

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(page: PatternPage, kind: PatternKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'pattern':
      return { ...page.pattern, settings: page.settings };
    case 'pattern_rule':
      return { ...page.rules.find((r) => r.rule.id === id)!.rule };
    case 'pattern_rule_test': {
      const test = page.rules.flatMap((r) => r.tests).find((t) => t.test.id === id)!;
      return { ...test.test, starts_from: test.startsFrom };
    }
    case 'slot':
      return { ...page.slots.find((s) => s.id === id)! };
  }
}

/** Each kind's Change command. */
const CHANGE: Record<PatternKind, CommandRoute> = {
  pattern: '/api/pattern/change-pattern',
  pattern_rule: '/api/pattern/change-pattern-rule',
  pattern_rule_test: '/api/pattern/change-pattern-rule-test',
  slot: '/api/pattern/change-slot',
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<PatternKind, { route: CommandRoute; parent: string }> = {
  pattern: { route: '/api/pattern/add-pattern', parent: 'product_id' },
  pattern_rule: { route: '/api/pattern/add-pattern-rule', parent: 'pattern_id' },
  pattern_rule_test: { route: '/api/pattern/add-pattern-rule-test', parent: 'pattern_rule_id' },
  slot: { route: '/api/pattern/add-slot', parent: 'pattern_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<PatternKind, CommandRoute> = {
  pattern: '/api/pattern/remove-pattern',
  pattern_rule: '/api/pattern/remove-pattern-rule',
  pattern_rule_test: '/api/pattern/remove-pattern-rule-test',
  slot: '/api/pattern/remove-slot',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: CommandRoute, input: Record<string, unknown>): Promise<WriteAnswer> => writer.command(route, input as unknown as CommandInputs[typeof route]);

/** What goes with a record when it is removed, inside the pattern: what sits under it. */
function goesWith(page: PatternPage, kind: PatternKind, id: string): string[] {
  if (kind === 'pattern') return [...page.rules.flatMap((r) => [r.rule.id, ...r.tests.map((t) => t.test.id)]), ...page.slots.map((s) => s.id)];
  if (kind === 'pattern_rule') return page.rules.find((r) => r.rule.id === id)!.tests.map((t) => t.test.id);
  return [];
}

/** The record a removed one's page gives way to: what it sits under. */
function parentOf(page: PatternPage, kind: PatternKind, id: string): string {
  if (kind === 'pattern') return page.pattern.product_id;
  if (kind === 'pattern_rule' || kind === 'slot') return page.pattern.id;
  return page.rules.find((r) => r.tests.some((t) => t.test.id === id))!.rule.id;
}

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'fill' } | { mode: 'add'; kind: Exclude<PatternKind, 'pattern'> } | { mode: 'remove' };

/** A record of the pattern with its actions; a form or the remove question shows in place of its page. */
export function PatternEditor({ index, page, children }: { index: RecordIndex; page: PatternPage; children: ReactNode }) {
  const writer = useWriter();
  const announce = useAnnounce();
  const [mode, setMode] = useState<Mode>({ mode: 'view' });
  const toolbar = useRef<HTMLDivElement>(null);
  const { id, kind } = page.record;
  useEffect(() => { setMode({ mode: 'view' }); }, [id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode({ mode: 'view' });
    backToActions(`Change ${id}`, toolbar);
  };
  const product = page.pattern.product_id;
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
  if (mode.mode === 'fill') return <div className="spec-body"><FillSlotForm index={index} slot={id} onDone={back} /></div>;
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} product={product} kind={mode.kind} parent={id} onDone={back} /></div>;
  const adds = addedUnder(index.meta, kind, ['pattern_rule', 'pattern_rule_test', 'slot'] as const);
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        {kind === 'slot' && <Button icon="plus" onClick={() => setMode({ mode: 'fill' })}>Fill slot</Button>}
        {adds.map((add) => <Button key={add} icon="plus" onClick={() => setMode({ mode: 'add', kind: add })}>Add {kindWord(index.meta, add)}</Button>)}
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={kindWord(index.meta, kind)} goes={goesWith(page, kind, id)} then={addressOf(parentOf(page, kind, id))} onCancel={back}
          remove={() => writer.command(REMOVE[kind], { id })} />
      )}
      {children}
    </>
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

/** Add: an empty form for a rule, slot or rule test under the record, its ID the next free one, sent as that kind's Add. */
function AddForm({ index, product, kind, parent, onDone }: { index: RecordIndex; product: string; kind: Exclude<PatternKind, 'pattern'>; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextPatternId(kind, parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, product, kind, true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { [ADD[kind].parent]: parent });
    const answer = await send(writer, ADD[kind].route, input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New ${kindWord(index.meta, kind)} under ${parent}`} title={`Add a ${kindWord(index.meta, kind)}`} submit={submit} saveLabel={`Add ${kindWord(index.meta, kind)}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/**
 * Add a pattern to a product (from the product's page): the aggregate's own Add. A pattern's ID is its product's,
 * PAT and a name chosen for it, so the form starts it with the product's prefix and leaves the name to the person.
 */
export function AddPatternForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), text: { id: `${parent}-PAT-` } }));
  const specs = fieldsOf(index, parent, 'pattern', true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { product_id: parent });
    const answer = await send(writer, ADD.pattern.route, input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New pattern under ${parent}`} title="Add a pattern" submit={submit} saveLabel="Add pattern" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
