import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ValueObjectKind } from '../../../../lathe/src/domain-modeling/value-object/model';
import type { ValueObjectPage } from '../../../../lathe/src/domain-modeling/value-object/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, addOrChangeFields, changeInput, CommandForm, draftOf, emptyDraft, Fields, formFields, LONG, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { AddMenu } from '../../edit/AddMenu';
import { useWriter, type Writer, type CommandInputs, type CommandRoute } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { VALUE_OBJECT_FIELDS } from './fields.generated';
import { useNextValueObjectId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { kindWord } from '../../platform/meta-model/reads';

// The Value object editor (LA-MOD-A9): the actions on a record of a value object, each sending one of the aggregate's
// own commands, POST /api/value-object/<command>, and nothing else. Edit sends its kind's Change with only what changed
// (a value object's fields as the whole list); Add opens an empty form for a kind under the record (a constraint, or
// the value type it has not got yet, under the value object; the test a constraint has not got yet), with its ID read
// from the aggregate (next-id), and sends its Add; Remove says what goes with the record and sends its Remove. The
// aggregate has no Move. A value object is added from its product's page (AddValueObjectForm). A refusal shows every
// reason the command gave, in its own words, keeps what was entered, and changes nothing.

type Inside = Exclude<ValueObjectKind, 'value_object'>;

/** The records of the product of a kind, as choices. */
const choices = (index: RecordIndex, product: string, kind: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === kind && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields each kind's Add and Change take, from their inputs; the hints add long text and the choices. */
function fieldsOf(index: RecordIndex, product: string, kind: ValueObjectKind, adding: boolean): FieldSpec[] {
  const F = VALUE_OBJECT_FIELDS;
  switch (kind) {
    case 'value_object':
      // A value object has no parent column to leave out: its ID names its product.
      return adding ? formFields(F['/api/value-object/add-value-object'], [], { description: LONG }) : formFields(F['/api/value-object/change-value-object'], ['id'], { description: LONG });
    case 'constraint':
      return addOrChangeFields(adding, F['/api/value-object/add-constraint'], 'value_object_id', F['/api/value-object/change-constraint'], { statement: LONG });
    case 'value_type':
      return addOrChangeFields(adding, F['/api/value-object/add-value-type'], 'value_object_id', F['/api/value-object/change-value-type'], { meets: { choices: choices(index, product, 'standard_rule') } });
    case 'constraint_test':
      return addOrChangeFields(adding, F['/api/value-object/add-constraint-test'], 'constraint_id', F['/api/value-object/change-constraint-test'], {
        accepts: LONG, refuses: LONG, manual_reason: LONG, notes: LONG, starts_from: { choices: choices(index, product, 'test_data_set') },
      });
  }
}


const constraintOf = (page: ValueObjectPage, id: string) => page.constraints.find((c) => c.constraint.id === id)!;
const holdingTest = (page: ValueObjectPage, id: string) => page.constraints.find((c) => c.test?.test.id === id)!;

/** The record's current values, by its input's field names: its row's columns, its parts and the links it starts. */
function currentOf(page: ValueObjectPage, kind: ValueObjectKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'value_object':
      return { ...page.valueObject, fields: page.fields };
    case 'constraint':
      return { ...constraintOf(page, id).constraint };
    case 'value_type':
      return { ...page.valueType!.valueType, meets: page.valueType!.meets, packages: page.valueType!.packages, helpers: page.valueType!.helpers };
    case 'constraint_test': {
      const { test } = holdingTest(page, id);
      return { ...test!.test, starts_from: test!.startsFrom };
    }
  }
}

/** Each kind's Change command. */
const CHANGE: Record<ValueObjectKind, CommandRoute> = {
  value_object: '/api/value-object/change-value-object',
  constraint: '/api/value-object/change-constraint',
  value_type: '/api/value-object/change-value-type',
  constraint_test: '/api/value-object/change-constraint-test',
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<Inside, { route: CommandRoute; parent: string }> = {
  constraint: { route: '/api/value-object/add-constraint', parent: 'value_object_id' },
  value_type: { route: '/api/value-object/add-value-type', parent: 'value_object_id' },
  constraint_test: { route: '/api/value-object/add-constraint-test', parent: 'constraint_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<ValueObjectKind, CommandRoute> = {
  value_object: '/api/value-object/remove-value-object',
  constraint: '/api/value-object/remove-constraint',
  value_type: '/api/value-object/remove-value-type',
  constraint_test: '/api/value-object/remove-constraint-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: CommandRoute, input: Record<string, unknown>): Promise<WriteAnswer> => writer.command(route, input as unknown as CommandInputs[typeof route]);

/** The kinds added under a record of each kind, inside the value object: one of a kind it holds one of only while it has none. */
function addedUnder(page: ValueObjectPage, kind: ValueObjectKind, id: string): Inside[] {
  if (kind === 'value_object') return ['constraint', ...(page.valueType ? [] : ['value_type' as const])];
  if (kind === 'constraint') return constraintOf(page, id).test ? [] : ['constraint_test'];
  return [];
}

/** What goes with a record when it is removed, inside the value object: what sits under it. */
function goesWith(page: ValueObjectPage, kind: ValueObjectKind, id: string): string[] {
  const testOf = (c: ValueObjectPage['constraints'][number]) => (c.test ? [c.test.test.id] : []);
  if (kind === 'value_object') return [...page.constraints.flatMap((c) => [c.constraint.id, ...testOf(c)]), ...(page.valueType ? [page.valueType.valueType.id] : [])];
  if (kind === 'constraint') return testOf(constraintOf(page, id));
  return [];
}

/** The record a removed one's page gives way to: what it sits under (a value object, its product). */
function parentOf(index: RecordIndex, page: ValueObjectPage, kind: ValueObjectKind, id: string): string {
  if (kind === 'value_object') return page.product || (index.byId.get(id)?.product ?? '');
  if (kind === 'constraint_test') return holdingTest(page, id).constraint.id;
  return page.valueObject.id;
}

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Inside } | { mode: 'remove' };

/** A record of the value object with its actions; a form or the remove question shows in place of its page. */
export function ValueObjectEditor({ index, page, children }: { index: RecordIndex; page: ValueObjectPage; children: ReactNode }) {
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
  const product = page.product;
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
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} product={product} kind={mode.kind} parent={id} onDone={back} /></div>;
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        <AddMenu id={id} choices={addedUnder(page, kind, id).map((k) => ({ key: k, label: kindLabel(index, k) }))} onPick={(k) => setMode({ mode: 'add', kind: k as Inside })} />
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={kindWord(index.meta, kind)} goes={goesWith(page, kind, id)} then={addressOf(parentOf(index, page, kind, id))} onCancel={back}
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

/** Add: an empty form for a kind under the record, its ID the next free one (or the one it takes), sent as that kind's Add. */
function AddForm({ index, product, kind, parent, onDone }: { index: RecordIndex; product: string; kind: Inside; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextValueObjectId(kind, parent, index);
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

/** Add a value object to a product (from the product's page): the aggregate's own Add, its ID the next free one. */
export function AddValueObjectForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextValueObjectId('value_object', parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, parent, 'value_object', true);
  const submit = async () => {
    // A value object has no parent column: its ID names its product.
    const input = addInput(index, specs, draft, {});
    const answer = await send(writer, '/api/value-object/add-value-object', input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New value object in ${parent}`} title="Add a value object" submit={submit} saveLabel="Add value object" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
