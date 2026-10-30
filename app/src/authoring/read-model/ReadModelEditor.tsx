import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ReadModelKind } from '../../../../lathe/src/authoring/read-model/model';
import type { ReadModelPage } from '../../../../lathe/src/authoring/read-model/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type Writer } from '../../edit/write';
import { adderOf } from '../../record/pages';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { sendReadModel, type ReadModelCommands, type ReadModelRoute } from './commands';
import { useNextReadModelId } from './reads';
import '../../edit/edit.css';

// The Read model editor (LA-AUT-A10): the actions on a record of a read model, each sending one of the aggregate's own
// commands, POST /api/read-model/<command>, and nothing else. Edit sends its kind's Change with only what changed (a
// read model's fields as the whole list); Add opens an empty form for a kind under the record (a query, or the
// projection or reader it has not got yet, under the read model; the handler a query has not got yet), with its ID
// read from the aggregate (next-id), and sends its Add; Remove says what goes with the record and sends its Remove.
// The aggregate has no Move. The table that stores a read model is the Table aggregate's, added from here through its
// own Add form (adderOf). A read model is added from its domain's page (AddReadModelForm). A refusal shows every reason
// the command gave, in its own words, keeps what was entered, and changes nothing.

type Inside = Exclude<ReadModelKind, 'read_model'>;
type Code = 'projection' | 'reader' | 'query_handler';

/** A kind's label in a sentence. */
const LABEL: Record<ReadModelKind, string> = { read_model: 'read model', query: 'query', projection: 'projection', reader: 'reader', query_handler: 'query handler' };

/** The columns of a field the form takes, in the command's order. */
const FIELD_COLUMNS = ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'];

/** The records of the domain of a kind, as choices. */
const choices = (index: RecordIndex, domain: string, kind: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === kind && r.domain === domain).map((r) => ({ id: r.id, title: r.title }));

/** The fields each kind's Add and Change take (Change leaves out the ID), in their input's order; packages are one per line. */
function fieldsOf(index: RecordIndex, domain: string, kind: ReadModelKind, adding: boolean): FieldSpec[] {
  const id = (table: string): FieldSpec[] => (adding ? [{ field: 'id', column: 'id', table }] : []);
  const code = (table: Code): FieldSpec[] => [
    ...id(table),
    { field: 'title', column: 'title', table },
    { field: 'file', column: 'file', table },
    { field: 'description', column: 'description', table, long: true },
    { field: 'meets', label: 'Meets', description: 'The standard rules it meets.', many: [...index.byId.values()].filter((r) => r.kind === 'standard_rule' && r.product === index.byId.get(domain)?.product).map((r) => ({ id: r.id, title: r.title })) },
    { field: 'packages', column: 'package', table: 'package_use', label: 'packages', long: true, required: false },
  ];
  switch (kind) {
    case 'read_model':
      return [
        ...id('read_model'),
        { field: 'title', column: 'title', table: 'read_model' },
        { field: 'description', column: 'description', table: 'read_model', long: true },
        { field: 'fields', label: 'Fields', description: 'Its fields, in order. The list replaces its fields.', table: 'read_model_field', columns: FIELD_COLUMNS },
        { field: 'reads', label: 'Reads', description: 'The aggregates of its domain it reads.', many: choices(index, domain, 'aggregate') },
        { field: 'calls', label: 'Calls', description: 'The domain services its projection calls.', many: choices(index, domain, 'domain_service') },
        { field: 'fed_by', label: 'Fed by', description: 'The events that keep it current.', many: [...index.byId.values()].filter((r) => r.kind === 'domain_event' && r.product === index.byId.get(domain)?.product).map((r) => ({ id: r.id, title: r.title })) },
      ];
    case 'query':
      return [
        ...id('query'),
        { field: 'title', column: 'title', table: 'query' },
        { field: 'description', column: 'description', table: 'query', long: true },
        { field: 'selects_by', label: 'Selects by', description: 'The specifications of its domain it selects by.', many: choices(index, domain, 'specification') },
        { field: 'calls', label: 'Calls', description: 'The domain services of its domain it calls.', many: choices(index, domain, 'domain_service') },
      ];
    default:
      return code(kind);
  }
}

/** The packages field's text as its list: one package per line; a form without the field leaves it out. */
const packagesOf = (draft: Draft) => (draft.text.packages ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const withoutPackages = (specs: FieldSpec[]) => specs.filter((s) => s.field !== 'packages');
const hasPackages = (specs: FieldSpec[]) => specs.some((s) => s.field === 'packages');

const queryOf = (page: ReadModelPage, id: string) => page.queries.find((q) => q.query.id === id)!;
const holdingHandler = (page: ReadModelPage, id: string) => page.queries.find((q) => q.handler?.code.id === id)!;

/** The piece of code of the kind with this ID. */
function codeOf(page: ReadModelPage, kind: Code, id: string) {
  if (kind === 'projection') return page.projection!;
  if (kind === 'reader') return page.reader!;
  return holdingHandler(page, id).handler!;
}

/** The record's current values, by its input's field names: its row's columns, its parts and the links it starts. */
function currentOf(page: ReadModelPage, kind: ReadModelKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'read_model':
      return { ...page.readModel, fields: page.fields, reads: page.reads, calls: page.calls, fed_by: page.fedBy };
    case 'query': {
      const q = queryOf(page, id);
      return { ...q.query, selects_by: q.selectsBy, calls: q.calls };
    }
    default: {
      const c = codeOf(page, kind, id);
      return { ...c.code, meets: c.meets, packages: c.packages };
    }
  }
}

/** Each kind's Change command, and the fields it may clear with null. */
const CHANGE: Record<ReadModelKind, { route: ReadModelRoute; clearable: readonly string[] }> = {
  read_model: { route: '/api/read-model/change-read-model', clearable: [] },
  query: { route: '/api/read-model/change-query', clearable: [] },
  projection: { route: '/api/read-model/change-projection', clearable: ['file'] },
  reader: { route: '/api/read-model/change-reader', clearable: ['file'] },
  query_handler: { route: '/api/read-model/change-query-handler', clearable: ['file'] },
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<Inside, { route: ReadModelRoute; parent: string }> = {
  query: { route: '/api/read-model/add-query', parent: 'read_model_id' },
  projection: { route: '/api/read-model/add-projection', parent: 'read_model_id' },
  reader: { route: '/api/read-model/add-reader', parent: 'read_model_id' },
  query_handler: { route: '/api/read-model/add-query-handler', parent: 'query_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<ReadModelKind, ReadModelRoute> = {
  read_model: '/api/read-model/remove-read-model',
  query: '/api/read-model/remove-query',
  projection: '/api/read-model/remove-projection',
  reader: '/api/read-model/remove-reader',
  query_handler: '/api/read-model/remove-query-handler',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: ReadModelRoute, input: Record<string, unknown>): Promise<WriteAnswer> => sendReadModel(writer, route, input as unknown as ReadModelCommands[typeof route]);

/** The kinds added under a record of each kind, inside the read model: one of a kind it holds one of only while it has none. */
function addedUnder(page: ReadModelPage, kind: ReadModelKind, id: string): Inside[] {
  if (kind === 'read_model') return ['query', ...(page.projection ? [] : ['projection' as const]), ...(page.reader ? [] : ['reader' as const])];
  if (kind === 'query') return queryOf(page, id).handler ? [] : ['query_handler'];
  return [];
}

/** What goes with a record when it is removed, inside the read model: what sits under it. */
function goesWith(page: ReadModelPage, kind: ReadModelKind, id: string): string[] {
  const handlerOf = (q: ReadModelPage['queries'][number]) => (q.handler ? [q.handler.code.id] : []);
  if (kind === 'read_model') return [...page.queries.flatMap((q) => [q.query.id, ...handlerOf(q)]), ...(page.projection ? [page.projection.code.id] : []), ...(page.reader ? [page.reader.code.id] : [])];
  if (kind === 'query') return handlerOf(queryOf(page, id));
  return [];
}

/** The record a removed one's page gives way to: what it sits under. */
function parentOf(page: ReadModelPage, kind: ReadModelKind, id: string): string {
  if (kind === 'read_model') return page.readModel.domain_id;
  if (kind === 'query_handler') return holdingHandler(page, id).query.id;
  return page.readModel.id;
}

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Inside } | { mode: 'table' } | { mode: 'remove' };

/** A record of the read model with its actions; a form or the remove question shows in place of its page. */
export function ReadModelEditor({ index, page, children }: { index: RecordIndex; page: ReadModelPage; children: ReactNode }) {
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
  const domain = page.readModel.domain_id;
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, domain, kind, false);
    const current = currentOf(page, kind, id);
    const submit = async (draft: Draft) => {
      const input = changeInput(index, withoutPackages(specs), draft, current, { id }, CHANGE[kind].clearable);
      if (hasPackages(specs)) {
        const packages = packagesOf(draft);
        if (JSON.stringify([...packages].sort()) !== JSON.stringify([...((current.packages ?? []) as string[])].sort())) input.packages = packages;
      }
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await send(writer, CHANGE[kind].route, input);
      if (answer.ok) { announce(`Saved ${id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} eyebrow={LABEL[kind]} id={id} submit={submit} onDone={back} /></div>;
  }
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} domain={domain} kind={mode.kind} parent={id} onDone={back} /></div>;
  // The table that stores the read model is the Table aggregate's, added through its own Add form.
  const AddTable = kind === 'read_model' ? adderOf(index.meta, 'table') : undefined;
  if (mode.mode === 'table' && AddTable) return <div className="spec-body"><AddTable index={index} parent={id} onDone={back} /></div>;
  const stored = [...index.byId.values()].some((r) => r.kind === 'table' && r.parent === id);
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        {addedUnder(page, kind, id).map((k) => <Button key={k} icon="plus" onClick={() => setMode({ mode: 'add', kind: k })}>Add {LABEL[k]}</Button>)}
        {AddTable && !stored && <Button icon="plus" onClick={() => setMode({ mode: 'table' })}>Add table</Button>}
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={LABEL[kind]} goes={goesWith(page, kind, id)} then={addressOf(parentOf(page, kind, id))} onCancel={back}
          remove={() => sendReadModel(writer, REMOVE[kind], { id })} />
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
function AddForm({ index, domain, kind, parent, onDone }: { index: RecordIndex; domain: string; kind: Inside; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextReadModelId(kind, parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, domain, kind, true);
  const submit = async () => {
    const input = addInput(index, withoutPackages(specs), draft, { [ADD[kind].parent]: parent });
    const packages = packagesOf(draft);
    if (hasPackages(specs) && packages.length > 0) input.packages = packages;
    const answer = await send(writer, ADD[kind].route, input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New ${LABEL[kind]} under ${parent}`} title={`Add a ${LABEL[kind]}`} submit={submit} saveLabel={`Add ${LABEL[kind]}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a read model to a domain (from the domain's page): the aggregate's own Add, its ID the next free one. */
export function AddReadModelForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextReadModelId('read_model', parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, parent, 'read_model', true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { domain_id: parent });
    const answer = await send(writer, '/api/read-model/add-read-model', input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New read model under ${parent}`} title="Add a read model" submit={submit} saveLabel="Add read model" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
