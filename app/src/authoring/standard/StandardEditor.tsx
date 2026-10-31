import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StandardKind } from '../../../../lathe/src/authoring/standard/model';
import type { StandardPage } from '../../../../lathe/src/authoring/standard/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type Writer } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { sendStandard, type StandardCommands, type StandardRoute } from './commands';
import { useNextStandardId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { kindWord, addedUnder } from '../../platform/meta-model/reads';

// The Standard editor (LA-AUT-A3): the actions on a record of a standard, each sending one of the aggregate's own
// commands, POST /api/standard/<command>, and nothing else. Edit sends its kind's Change with only what changed; Add
// opens an empty form for the kind that sits under the record (a rule under the standard, a test under a rule), with
// the next free ID read from the aggregate (next-id), and sends its Add; Remove says what goes with the record and
// sends its Remove. The aggregate has no Move. A standard is added from its product's page (AddStandardForm). A
// refusal shows every reason the command gave, in its own words, keeps what was entered, and changes nothing.


/** The test data sets of the product, as what a test may start from. */
const dataSets = (index: RecordIndex, product: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === 'test_data_set' && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields each kind's Add and Change take (Change leaves out the ID), in their input's order. */
function fieldsOf(index: RecordIndex, product: string, kind: StandardKind, adding: boolean): FieldSpec[] {
  const id = (table: string): FieldSpec[] => (adding ? [{ field: 'id', column: 'id', table }] : []);
  switch (kind) {
    case 'standard':
      return [...id('standard'), { field: 'title', column: 'title', table: 'standard' }, { field: 'description', column: 'description', table: 'standard', long: true }];
    case 'standard_rule':
      return [
        ...id('standard_rule'),
        { field: 'title', column: 'title', table: 'standard_rule' },
        { field: 'statement', column: 'statement', table: 'standard_rule', long: true },
        { field: 'group_name', column: 'group_name', table: 'standard_rule' },
      ];
    case 'standard_rule_test': {
      const table = 'standard_rule_test';
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
        { field: 'starts_from', label: 'Starts from', description: 'The test data sets it starts from.', many: dataSets(index, product) },
      ];
    }
  }
}

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(page: StandardPage, kind: StandardKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'standard':
      return { ...page.standard };
    case 'standard_rule':
      return { ...page.rules.find((r) => r.rule.id === id)!.rule };
    case 'standard_rule_test': {
      const test = page.rules.flatMap((r) => r.tests).find((t) => t.test.id === id)!;
      return { ...test.test, starts_from: test.startsFrom };
    }
  }
}

/** Each kind's Change command, and the fields it may clear with null. */
const CHANGE: Record<StandardKind, { route: StandardRoute; clearable: readonly string[] }> = {
  standard: { route: '/api/standard/change-standard', clearable: [] },
  standard_rule: { route: '/api/standard/change-standard-rule', clearable: ['group_name'] },
  standard_rule_test: { route: '/api/standard/change-standard-rule-test', clearable: ['file', 'manual_reason', 'size', 'smoke', 'external', 'notes'] },
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<StandardKind, { route: StandardRoute; parent: string }> = {
  standard: { route: '/api/standard/add-standard', parent: 'product_id' },
  standard_rule: { route: '/api/standard/add-standard-rule', parent: 'standard_id' },
  standard_rule_test: { route: '/api/standard/add-standard-rule-test', parent: 'standard_rule_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<StandardKind, StandardRoute> = {
  standard: '/api/standard/remove-standard',
  standard_rule: '/api/standard/remove-standard-rule',
  standard_rule_test: '/api/standard/remove-standard-rule-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: StandardRoute, input: Record<string, unknown>): Promise<WriteAnswer> => sendStandard(writer, route, input as unknown as StandardCommands[typeof route]);

/** What goes with a record when it is removed, inside the standard: what sits under it. */
function goesWith(page: StandardPage, kind: StandardKind, id: string): string[] {
  if (kind === 'standard') return page.rules.flatMap((r) => [r.rule.id, ...r.tests.map((t) => t.test.id)]);
  if (kind === 'standard_rule') return page.rules.find((r) => r.rule.id === id)!.tests.map((t) => t.test.id);
  return [];
}

/** The record a removed one's page gives way to: what it sits under. */
function parentOf(page: StandardPage, kind: StandardKind, id: string): string {
  if (kind === 'standard') return page.standard.product_id;
  if (kind === 'standard_rule') return page.standard.id;
  return page.rules.find((r) => r.tests.some((t) => t.test.id === id))!.rule.id;
}

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Exclude<StandardKind, 'standard'> } | { mode: 'remove' };

/** A record of the standard with its actions; a form or the remove question shows in place of its page. */
export function StandardEditor({ index, page, children }: { index: RecordIndex; page: StandardPage; children: ReactNode }) {
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
  const product = page.standard.product_id;
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, product, kind, false);
    const current = currentOf(page, kind, id);
    const submit = async (draft: Draft) => {
      const input = changeInput(index, specs, draft, current, { id }, CHANGE[kind].clearable);
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await send(writer, CHANGE[kind].route, input);
      if (answer.ok) { announce(`Saved ${id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} eyebrow={kindWord(index.meta, kind)} id={id} submit={submit} onDone={back} /></div>;
  }
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} product={product} kind={mode.kind} parent={id} onDone={back} /></div>;
  const adds = addedUnder(index.meta, kind, ['standard_rule', 'standard_rule_test'] as const)[0] ?? null;
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        {adds && <Button icon="plus" onClick={() => setMode({ mode: 'add', kind: adds })}>Add {kindWord(index.meta, adds)}</Button>}
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={kindWord(index.meta, kind)} goes={goesWith(page, kind, id)} then={addressOf(parentOf(page, kind, id))} onCancel={back}
          remove={() => sendStandard(writer, REMOVE[kind], { id })} />
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

/** Add: an empty form for a rule or rule test under the record, its ID the next free one, sent as that kind's Add. */
function AddForm({ index, product, kind, parent, onDone }: { index: RecordIndex; product: string; kind: Exclude<StandardKind, 'standard'>; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextStandardId(kind, parent, index);
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
 * Add a standard to a product (from the product's page): the aggregate's own Add. A standard's ID is its product's,
 * STD and a name chosen for it, so the form starts it with the product's prefix and leaves the name to the person.
 */
export function AddStandardForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), text: { id: `${parent}-STD-` } }));
  const specs = fieldsOf(index, parent, 'standard', true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { product_id: parent });
    const answer = await send(writer, ADD.standard.route, input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New standard under ${parent}`} title="Add a standard" submit={submit} saveLabel="Add standard" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
