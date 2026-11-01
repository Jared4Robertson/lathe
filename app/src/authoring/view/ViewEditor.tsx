import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ViewKind } from '../../../../lathe/src/authoring/view/model';
import type { ViewPage } from '../../../../lathe/src/authoring/view/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, addOrChangeFields, changeInput, CommandForm, draftOf, emptyDraft, Fields, formFields, LONG, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type Writer, type CommandInputs, type CommandRoute } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { VIEW_FIELDS } from './fields.generated';
import { useNextViewId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { kindWord, addedUnder } from '../../platform/meta-model/reads';

// The View editor (LA-AUT-A12): the actions on a record of a view, each sending one of the aggregate's own commands,
// POST /api/view/<command>, and nothing else. Edit sends its kind's Change with only what changed; Add opens an empty
// form for the kind that sits under the record (a requirement under the view, a test under a requirement), with the
// next free ID read from the aggregate (next-id), and sends its Add; Remove says what goes with the record and sends
// its Remove. The aggregate has no Move. A view is added from its product's page (AddViewForm). A refusal shows every
// reason the command gave, in its own words, keeps what was entered, and changes nothing.



/** The product's records of some kinds, as choices. */
const productRecords = (index: RecordIndex, product: string, kinds: readonly string[]): Choice[] =>
  [...index.byId.values()].filter((r) => kinds.includes(r.kind) && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields each kind's Add and Change take, from their inputs; the hints add long text and the choices. */
function fieldsOf(index: RecordIndex, product: string, kind: ViewKind, adding: boolean): FieldSpec[] {
  const F = VIEW_FIELDS;
  switch (kind) {
    case 'view': {
      // A view has no parent column: its product follows from its ID. It presents the product's commands and queries,
      // and may belong to one of its interfaces.
      const hints = {
        description: LONG,
        notes: LONG,
        interface_id: { label: 'Interface', choices: productRecords(index, product, ['interface']), description: 'Empty when every web app and desktop interface of the product shows it; else the one interface it belongs to.' },
        presents: { choices: productRecords(index, product, ['command', 'query']) },
      };
      return adding ? formFields(F['/api/view/add-view'], [], hints) : formFields(F['/api/view/change-view'], ['id'], hints);
    }
    case 'view_requirement':
      return addOrChangeFields(adding, F['/api/view/add-view-requirement'], 'view_id', F['/api/view/change-view-requirement'], { statement: LONG });
    case 'view_test':
      return addOrChangeFields(adding, F['/api/view/add-view-test'], 'view_requirement_id', F['/api/view/change-view-test'], {
        when: LONG, then: LONG, manual_reason: LONG, notes: LONG, starts_from: { choices: productRecords(index, product, ['test_data_set']) },
      });
  }
}

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(index: RecordIndex, page: ViewPage, kind: ViewKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'view':
      // What it presents comes from the space's links until the View read model gives it.
      return { ...page.view, presents: (index.outgoing.get(id) ?? []).filter((l) => l.relation === 'presents').map((l) => l.target) };
    case 'view_requirement':
      return { ...page.requirements.find((r) => r.requirement.id === id)!.requirement };
    case 'view_test': {
      const test = page.requirements.flatMap((r) => r.tests).find((t) => t.test.id === id)!;
      return { ...test.test, starts_from: test.startsFrom };
    }
  }
}

/** Each kind's Change command. */
const CHANGE: Record<ViewKind, CommandRoute> = {
  view: '/api/view/change-view',
  view_requirement: '/api/view/change-view-requirement',
  view_test: '/api/view/change-view-test',
};

/** Each kind's Add command, and the field that names its parent (a view has none: its product follows from its ID). */
const ADD: Record<ViewKind, { route: CommandRoute; parent: string | null }> = {
  view: { route: '/api/view/add-view', parent: null },
  view_requirement: { route: '/api/view/add-view-requirement', parent: 'view_id' },
  view_test: { route: '/api/view/add-view-test', parent: 'view_requirement_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<ViewKind, CommandRoute> = {
  view: '/api/view/remove-view',
  view_requirement: '/api/view/remove-view-requirement',
  view_test: '/api/view/remove-view-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: CommandRoute, input: Record<string, unknown>): Promise<WriteAnswer> => writer.command(route, input as unknown as CommandInputs[typeof route]);

/** What goes with a record when it is removed, inside the view: what sits under it. */
function goesWith(page: ViewPage, kind: ViewKind, id: string): string[] {
  if (kind === 'view') return page.requirements.flatMap((r) => [r.requirement.id, ...r.tests.map((t) => t.test.id)]);
  if (kind === 'view_requirement') return page.requirements.find((r) => r.requirement.id === id)!.tests.map((t) => t.test.id);
  return [];
}

/** The record a removed one's page gives way to: what it sits under (a view's product). */
function parentOf(index: RecordIndex, page: ViewPage, kind: ViewKind, id: string): string {
  if (kind === 'view') return index.byId.get(id)?.product ?? '';
  if (kind === 'view_requirement') return page.view.id;
  return page.requirements.find((r) => r.tests.some((t) => t.test.id === id))!.requirement.id;
}

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Exclude<ViewKind, 'view'> } | { mode: 'remove' };

/** A record of the view with its actions; a form or the remove question shows in place of its page. */
export function ViewEditor({ index, page, children }: { index: RecordIndex; page: ViewPage; children: ReactNode }) {
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
  const product = index.byId.get(page.view.id)?.product ?? '';
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, product, kind, false);
    const current = currentOf(index, page, kind, id);
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
  const adds = addedUnder(index.meta, kind, ['view_requirement', 'view_test'] as const)[0] ?? null;
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        {adds && <Button icon="plus" onClick={() => setMode({ mode: 'add', kind: adds })}>Add {kindWord(index.meta, adds)}</Button>}
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

/** Add: an empty form for a record of the kind under its parent, its ID the next free one, sent as that kind's Add. */
function AddForm({ index, product, kind, parent, onDone }: { index: RecordIndex; product: string; kind: ViewKind; parent: string; onDone: () => void }) {
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
    <CommandForm eyebrow={`New ${kindWord(index.meta, kind)} under ${parent}`} title={`Add a ${kindWord(index.meta, kind)}`} submit={submit} saveLabel={`Add ${kindWord(index.meta, kind)}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a view to a product (from the product's page): the aggregate's own Add, its ID the next free one. */
export function AddViewForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  return <AddForm index={index} product={parent} kind="view" parent={parent} onDone={onDone} />;
}
