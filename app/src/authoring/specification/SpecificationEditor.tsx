import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SpecificationKind } from '../../../../lathe/src/authoring/specification/model';
import type { SpecificationPage } from '../../../../lathe/src/authoring/specification/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type Writer } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { sendSpecification, type SpecificationCommands, type SpecificationRoute } from './commands';
import { useNextSpecificationId } from './reads';
import '../../edit/edit.css';

// The Specification editor (LA-AUT-A5): the actions on a record of a specification, each sending one of the
// aggregate's own commands, POST /api/specification/<command>, and nothing else. Edit sends its kind's Change with only
// what changed; Add opens an empty form for the predicate or the test the specification has not got yet, with its one
// ID read from the aggregate (next-id), and sends its Add; Remove says what goes with the record and sends its Remove.
// The aggregate has no Move. A specification is added from its domain's page (AddSpecificationForm). A refusal shows
// every reason the command gave, in its own words, keeps what was entered, and changes nothing.

type Inside = Exclude<SpecificationKind, 'specification'>;

/** A kind's label in a sentence. */
const LABEL: Record<SpecificationKind, string> = { specification: 'specification', predicate: 'predicate', specification_test: 'specification test' };

/** The records of the product of a kind, as choices. */
const choices = (index: RecordIndex, product: string, kind: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === kind && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields each kind's Add and Change take (Change leaves out the ID), in their input's order; packages are one per line. */
function fieldsOf(index: RecordIndex, product: string, kind: SpecificationKind, adding: boolean): FieldSpec[] {
  const id = (table: string): FieldSpec[] => (adding ? [{ field: 'id', column: 'id', table }] : []);
  switch (kind) {
    case 'specification':
      return [
        ...id('specification'),
        { field: 'title', column: 'title', table: 'specification' },
        { field: 'statement', column: 'statement', table: 'specification', long: true },
        { field: 'reads', label: 'Reads', description: 'The aggregates of its domain it judges.', many: choices(index, product, 'aggregate') },
      ];
    case 'predicate':
      return [
        ...id('predicate'),
        { field: 'title', column: 'title', table: 'predicate' },
        { field: 'file', column: 'file', table: 'predicate' },
        { field: 'meets', label: 'Meets', description: 'The standard rules it meets.', many: choices(index, product, 'standard_rule') },
        { field: 'packages', column: 'package', table: 'package_use', label: 'packages', long: true, required: false },
      ];
    case 'specification_test': {
      const table = 'specification_test';
      return [
        ...id(table),
        { field: 'title', column: 'title', table },
        { field: 'when', column: 'when', table, long: true },
        { field: 'then', column: 'then', table, long: true },
        { field: 'level', column: 'level', table },
        { field: 'state', column: 'state', table },
        { field: 'file', column: 'file', table },
        { field: 'manual_reason', column: 'manual_reason', table, long: true },
        { field: 'size', column: 'size', table },
        { field: 'smoke', column: 'smoke', table },
        { field: 'external', column: 'external', table },
        { field: 'notes', column: 'notes', table, long: true },
        { field: 'starts_from', label: 'Starts from', description: 'The test data sets it starts from.', many: choices(index, product, 'test_data_set') },
      ];
    }
  }
}

/** The packages field's text as its list: one package per line; a form without the field leaves it out. */
const packagesOf = (draft: Draft) => (draft.text.packages ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const withoutPackages = (specs: FieldSpec[]) => specs.filter((s) => s.field !== 'packages');
const hasPackages = (specs: FieldSpec[]) => specs.some((s) => s.field === 'packages');

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(page: SpecificationPage, kind: SpecificationKind): Record<string, unknown> {
  switch (kind) {
    case 'specification':
      return { ...page.specification, reads: page.reads };
    case 'predicate':
      return { ...page.predicate!.predicate, meets: page.predicate!.meets, packages: page.predicate!.packages };
    case 'specification_test':
      return { ...page.test!.test, starts_from: page.test!.startsFrom };
  }
}

/** Each kind's Change command, and the fields it may clear with null. */
const CHANGE: Record<SpecificationKind, { route: SpecificationRoute; clearable: readonly string[] }> = {
  specification: { route: '/api/specification/change-specification', clearable: [] },
  predicate: { route: '/api/specification/change-predicate', clearable: ['file'] },
  specification_test: { route: '/api/specification/change-specification-test', clearable: ['file', 'manual_reason', 'size', 'smoke', 'external', 'notes'] },
};

/** Each kind's Add command. */
const ADD: Record<SpecificationKind, SpecificationRoute> = {
  specification: '/api/specification/add-specification',
  predicate: '/api/specification/add-predicate',
  specification_test: '/api/specification/add-specification-test',
};

/** Each kind's Remove command. */
const REMOVE: Record<SpecificationKind, SpecificationRoute> = {
  specification: '/api/specification/remove-specification',
  predicate: '/api/specification/remove-predicate',
  specification_test: '/api/specification/remove-specification-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: SpecificationRoute, input: Record<string, unknown>): Promise<WriteAnswer> => sendSpecification(writer, route, input as unknown as SpecificationCommands[typeof route]);

/** A Change input with the packages list when the form has it and it changed. */
function changeWithPackages(index: RecordIndex, specs: FieldSpec[], draft: Draft, current: Record<string, unknown>, id: string, clearable: readonly string[]): Record<string, unknown> {
  const input = changeInput(index, withoutPackages(specs), draft, current, { id }, clearable);
  if (!hasPackages(specs)) return input;
  const packages = packagesOf(draft);
  if (JSON.stringify([...packages].sort()) !== JSON.stringify([...((current.packages ?? []) as string[])].sort())) input.packages = packages;
  return input;
}

/** An Add input with the packages list when the form has it and it holds any. */
function addWithPackages(index: RecordIndex, specs: FieldSpec[], draft: Draft, parent: Record<string, unknown>): Record<string, unknown> {
  const input = addInput(index, withoutPackages(specs), draft, parent);
  const packages = packagesOf(draft);
  if (hasPackages(specs) && packages.length > 0) input.packages = packages;
  return input;
}

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Inside } | { mode: 'remove' };

/** A record of the specification with its actions; a form or the remove question shows in place of its page. */
export function SpecificationEditor({ index, page, children }: { index: RecordIndex; page: SpecificationPage; children: ReactNode }) {
  const writer = useWriter();
  const announce = useAnnounce();
  const [mode, setMode] = useState<Mode>({ mode: 'view' });
  const toolbar = useRef<HTMLDivElement>(null);
  const { id, kind } = page.record;
  useEffect(() => { setMode({ mode: 'view' }); }, [id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode({ mode: 'view' });
    setTimeout(() => toolbar.current?.querySelector<HTMLElement>('button')?.focus(), 0);
  };
  const product = index.byId.get(page.specification.id)?.product ?? '';
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, product, kind, false);
    const current = currentOf(page, kind);
    const submit = async (draft: Draft) => {
      const input = changeWithPackages(index, specs, draft, current, id, CHANGE[kind].clearable);
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await send(writer, CHANGE[kind].route, input);
      if (answer.ok) { announce(`Saved ${id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} eyebrow={LABEL[kind]} id={id} submit={submit} onDone={back} /></div>;
  }
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} product={product} kind={mode.kind} parent={id} onDone={back} /></div>;
  // A specification has one predicate and one test: Add offers each it has not got yet.
  const adds: Inside[] = kind === 'specification' ? [...(page.predicate ? [] : ['predicate' as const]), ...(page.test ? [] : ['specification_test' as const])] : [];
  const goes = kind === 'specification' ? [...(page.predicate ? [page.predicate.predicate.id] : []), ...(page.test ? [page.test.test.id] : [])] : [];
  const then = kind === 'specification' ? (page.domain || index.byId.get(id)?.product || '') : page.specification.id;
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        {adds.map((k) => <Button key={k} icon="plus" onClick={() => setMode({ mode: 'add', kind: k })}>Add {LABEL[k]}</Button>)}
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={LABEL[kind]} goes={goes} then={addressOf(then)} onCancel={back}
          remove={() => sendSpecification(writer, REMOVE[kind], { id })} />
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

/** Add: an empty form for the predicate or the test under the specification, its ID the one it takes, sent as that kind's Add. */
function AddForm({ index, product, kind, parent, onDone }: { index: RecordIndex; product: string; kind: Inside; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextSpecificationId(kind, parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, product, kind, true);
  const submit = async () => {
    const input = addWithPackages(index, specs, draft, { specification_id: parent });
    const answer = await send(writer, ADD[kind], input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New ${LABEL[kind]} under ${parent}`} title={`Add a ${LABEL[kind]}`} submit={submit} saveLabel={`Add ${LABEL[kind]}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a specification to a domain (from the domain's page): the aggregate's own Add, its ID the next free one. */
export function AddSpecificationForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextSpecificationId('specification', parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, index.byId.get(parent)?.product ?? '', 'specification', true);
  const submit = async () => {
    // A specification has no parent column: its ID names its domain.
    const input = addInput(index, specs, draft, {});
    const answer = await send(writer, ADD.specification, input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New specification in ${parent}`} title="Add a specification" submit={submit} saveLabel="Add specification" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
