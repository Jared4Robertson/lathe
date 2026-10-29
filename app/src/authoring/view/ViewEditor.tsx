import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ViewKind } from '../../../../lathe/src/authoring/view/model';
import type { ViewPage } from '../../../../lathe/src/authoring/view/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type Writer } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import type { SpecIndex } from '../../specs/data';
import { addressOf } from '../../views/address';
import { sendView, type ViewCommands, type ViewRoute } from './commands';
import { useNextViewId } from './reads';
import '../../edit/edit.css';

// The View editor (LA-AUT-A12): the actions on a record of a view, each sending one of the aggregate's own commands,
// POST /api/view/<command>, and nothing else. Edit sends its kind's Change with only what changed; Add opens an empty
// form for the kind that sits under the record (a requirement under the view, a test under a requirement), with the
// next free ID read from the aggregate (next-id), and sends its Add; Remove says what goes with the record and sends
// its Remove. The aggregate has no Move. A view is added from its product's page (AddViewForm). A refusal shows every
// reason the command gave, in its own words, keeps what was entered, and changes nothing.

/** A kind's label in a sentence. */
const LABEL: Record<ViewKind, string> = { view: 'view', view_requirement: 'view requirement', view_test: 'view test' };

/** The kind added under a record of each kind, inside the view. */
const ADDED_UNDER: Record<ViewKind, Exclude<ViewKind, 'view'> | null> = { view: 'view_requirement', view_requirement: 'view_test', view_test: null };

/** The test data sets of the product, as what a test may start from. */
const dataSets = (index: SpecIndex, product: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === 'test_data_set' && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields each kind's Add and Change take (Change leaves out the ID), in their input's order. */
function fieldsOf(index: SpecIndex, product: string, kind: ViewKind, adding: boolean): FieldSpec[] {
  const id = (table: string): FieldSpec[] => (adding ? [{ field: 'id', column: 'id', table }] : []);
  switch (kind) {
    case 'view':
      return [
        ...id('view'),
        { field: 'title', column: 'title', table: 'view' },
        { field: 'route', column: 'route', table: 'view' },
        { field: 'description', column: 'description', table: 'view', long: true },
        { field: 'notes', column: 'notes', table: 'view', long: true },
      ];
    case 'view_requirement':
      return [
        ...id('view_requirement'),
        { field: 'title', column: 'title', table: 'view_requirement' },
        { field: 'statement', column: 'statement', table: 'view_requirement', long: true },
        { field: 'group_name', column: 'group_name', table: 'view_requirement' },
      ];
    case 'view_test': {
      const table = 'view_test';
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
function currentOf(page: ViewPage, kind: ViewKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'view':
      return { ...page.view };
    case 'view_requirement':
      return { ...page.requirements.find((r) => r.requirement.id === id)!.requirement };
    case 'view_test': {
      const test = page.requirements.flatMap((r) => r.tests).find((t) => t.test.id === id)!;
      return { ...test.test, starts_from: test.startsFrom };
    }
  }
}

/** Each kind's Change command, and the fields it may clear with null. */
const CHANGE: Record<ViewKind, { route: ViewRoute; clearable: readonly string[] }> = {
  view: { route: '/api/view/change-view', clearable: ['route', 'notes'] },
  view_requirement: { route: '/api/view/change-view-requirement', clearable: ['group_name'] },
  view_test: { route: '/api/view/change-view-test', clearable: ['file', 'manual_reason', 'size', 'smoke', 'external', 'notes'] },
};

/** Each kind's Add command, and the field that names its parent (a view has none: its product follows from its ID). */
const ADD: Record<ViewKind, { route: ViewRoute; parent: string | null }> = {
  view: { route: '/api/view/add-view', parent: null },
  view_requirement: { route: '/api/view/add-view-requirement', parent: 'view_id' },
  view_test: { route: '/api/view/add-view-test', parent: 'view_requirement_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<ViewKind, ViewRoute> = {
  view: '/api/view/remove-view',
  view_requirement: '/api/view/remove-view-requirement',
  view_test: '/api/view/remove-view-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: ViewRoute, input: Record<string, unknown>): Promise<WriteAnswer> => sendView(writer, route, input as unknown as ViewCommands[typeof route]);

/** What goes with a record when it is removed, inside the view: what sits under it. */
function goesWith(page: ViewPage, kind: ViewKind, id: string): string[] {
  if (kind === 'view') return page.requirements.flatMap((r) => [r.requirement.id, ...r.tests.map((t) => t.test.id)]);
  if (kind === 'view_requirement') return page.requirements.find((r) => r.requirement.id === id)!.tests.map((t) => t.test.id);
  return [];
}

/** The record a removed one's page gives way to: what it sits under (a view's product). */
function parentOf(index: SpecIndex, page: ViewPage, kind: ViewKind, id: string): string {
  if (kind === 'view') return index.byId.get(id)?.product ?? '';
  if (kind === 'view_requirement') return page.view.id;
  return page.requirements.find((r) => r.tests.some((t) => t.test.id === id))!.requirement.id;
}

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Exclude<ViewKind, 'view'> } | { mode: 'remove' };

/** A record of the view with its actions; a form or the remove question shows in place of its page. */
export function ViewEditor({ index, page, children }: { index: SpecIndex; page: ViewPage; children: ReactNode }) {
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
  const product = index.byId.get(page.view.id)?.product ?? '';
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
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} eyebrow={LABEL[kind]} id={id} submit={submit} onDone={back} /></div>;
  }
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} product={product} kind={mode.kind} parent={id} onDone={back} /></div>;
  const adds = ADDED_UNDER[kind];
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        {adds && <Button icon="plus" onClick={() => setMode({ mode: 'add', kind: adds })}>Add {LABEL[adds]}</Button>}
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={LABEL[kind]} goes={goesWith(page, kind, id)} then={addressOf(parentOf(index, page, kind, id))} onCancel={back}
          remove={() => sendView(writer, REMOVE[kind], { id })} />
      )}
      {children}
    </>
  );
}

/** Edit: the record's Change, with only what changed. */
function ChangeForm({ index, specs, current, eyebrow, id, submit, onDone }: {
  index: SpecIndex;
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

/** Add: an empty form for a record of the kind under its parent, its ID the next free one, sent as that kind's Add. */
function AddForm({ index, product, kind, parent, onDone }: { index: SpecIndex; product: string; kind: ViewKind; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextViewId(kind, parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, product, kind, true);
  const { route, parent: field } = ADD[kind];
  const submit = async () => {
    const input = addInput(index, specs, draft, field ? { [field]: parent } : {});
    const answer = await send(writer, route, input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New ${LABEL[kind]} under ${parent}`} title={`Add a ${LABEL[kind]}`} submit={submit} saveLabel={`Add ${LABEL[kind]}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a view to a product (from the product's page): the aggregate's own Add, its ID the next free one. */
export function AddViewForm({ index, parent, onDone }: { index: SpecIndex; parent: string; onDone: () => void }) {
  return <AddForm index={index} product={parent} kind="view" parent={parent} onDone={onDone} />;
}
