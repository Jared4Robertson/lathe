import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ReadModelKind } from '../../../../lathe/src/domain-modeling/read-model/model';
import type { ReadModelPage } from '../../../../lathe/src/domain-modeling/read-model/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, addOrChangeFields, changeInput, CommandForm, draftOf, emptyDraft, Fields, formFields, LONG, RemoveQuestion, type Draft, type FieldSpec, type InputFields } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { AddMenu } from '../../edit/AddMenu';
import { useWriter, type Writer, type CommandInputs, type CommandRoute } from '../../edit/write';
import { adderOf, othersAddedUnder } from '../../record/pages';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { READ_MODEL_FIELDS } from './fields.generated';
import { useNextReadModelId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { kindWord } from '../../platform/meta-model/reads';

// The Read model editor (LA-MOD-A10): the actions on a record of a read model, each sending one of the aggregate's own
// commands, POST /api/read-model/<command>, and nothing else. Edit sends its kind's Change with only what changed (a
// read model's fields as the whole list); Add opens an empty form for a kind under the record (a query, or the
// projection or reader it has not got yet, under the read model; the handler a query has not got yet), with its ID
// read from the aggregate (next-id), and sends its Add; Remove says what goes with the record and sends its Remove.
// The aggregate has no Move. The table that stores a read model is the Table aggregate's, added from here through its
// own Add form (adderOf). A read model is added from its domain's page (AddReadModelForm). A refusal shows every reason
// the command gave, in its own words, keeps what was entered, and changes nothing.

type Inside = Exclude<ReadModelKind, 'read_model'>;
type Code = 'projection' | 'reader' | 'query_handler';

/** The records of the domain of a kind, as choices. */
const choices = (index: RecordIndex, domain: string, kind: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === kind && r.domain === domain).map((r) => ({ id: r.id, title: r.title }));

/** The fields each kind's Add and Change take, from their inputs; the hints add long text and the choices. */
function fieldsOf(index: RecordIndex, domain: string, kind: ReadModelKind, adding: boolean): FieldSpec[] {
  const F = READ_MODEL_FIELDS;
  const product = index.byId.get(domain)?.product;
  const ofProduct = (k: string): Choice[] => [...index.byId.values()].filter((r) => r.kind === k && r.product === product).map((r) => ({ id: r.id, title: r.title }));
  // A piece of code: the field that names its parent and the fields its form leaves out go in `without`.
  const code = (add: InputFields, parent: string, change: InputFields, leftOut: readonly string[] = []): FieldSpec[] => {
    const hints = { description: LONG, meets: { choices: ofProduct('standard_rule') } };
    return adding ? formFields(add, [parent, ...leftOut], hints) : formFields(change, ['id', ...leftOut], hints);
  };
  switch (kind) {
    case 'read_model':
      return addOrChangeFields(adding, F['/api/read-model/add-read-model'], 'domain_id', F['/api/read-model/change-read-model'], {
        description: LONG, reads: { choices: choices(index, domain, 'aggregate') }, calls: { choices: choices(index, domain, 'domain_service') }, fed_by: { choices: ofProduct('domain_event') },
      });
    case 'query':
      return addOrChangeFields(adding, F['/api/read-model/add-query'], 'read_model_id', F['/api/read-model/change-query'], {
        description: LONG, selects_by: { choices: choices(index, domain, 'specification') }, calls: { choices: choices(index, domain, 'domain_service') },
      });
    case 'projection':
      return code(F['/api/read-model/add-projection'], 'read_model_id', F['/api/read-model/change-projection']);
    case 'reader':
      // The data store a reader reads in is not set from this form.
      return code(F['/api/read-model/add-reader'], 'read_model_id', F['/api/read-model/change-reader'], ['stored_in']);
    case 'query_handler':
      return code(F['/api/read-model/add-query-handler'], 'query_id', F['/api/read-model/change-query-handler']);
  }
}


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
      return { ...c.code, meets: c.meets, packages: c.packages, helpers: c.helpers };
    }
  }
}

/** Each kind's Change command. */
const CHANGE: Record<ReadModelKind, CommandRoute> = {
  read_model: '/api/read-model/change-read-model',
  query: '/api/read-model/change-query',
  projection: '/api/read-model/change-projection',
  reader: '/api/read-model/change-reader',
  query_handler: '/api/read-model/change-query-handler',
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<Inside, { route: CommandRoute; parent: string }> = {
  query: { route: '/api/read-model/add-query', parent: 'read_model_id' },
  projection: { route: '/api/read-model/add-projection', parent: 'read_model_id' },
  reader: { route: '/api/read-model/add-reader', parent: 'read_model_id' },
  query_handler: { route: '/api/read-model/add-query-handler', parent: 'query_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<ReadModelKind, CommandRoute> = {
  read_model: '/api/read-model/remove-read-model',
  query: '/api/read-model/remove-query',
  projection: '/api/read-model/remove-projection',
  reader: '/api/read-model/remove-reader',
  query_handler: '/api/read-model/remove-query-handler',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: CommandRoute, input: Record<string, unknown>): Promise<WriteAnswer> => writer.command(route, input as unknown as CommandInputs[typeof route]);

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

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Inside } | { mode: 'adopt'; kind: string } | { mode: 'remove' };

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
    backToActions(`Change ${id}`, toolbar);
  };
  const domain = page.readModel.domain_id;
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, domain, kind, false);
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
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} domain={domain} kind={mode.kind} parent={id} onDone={back} /></div>;
  // What other aggregates add under it (its table, its storage requirements) goes through their own Add forms.
  if (mode.mode === 'adopt') {
    const Adder = adderOf(index.meta, mode.kind)!;
    return <div className="spec-body"><Adder index={index} parent={id} onDone={back} /></div>;
  }
  const own = addedUnder(page, kind, id);
  const others = othersAddedUnder(index.meta, kind);
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        <AddMenu id={id} choices={[...own, ...others].map((k) => ({ key: k, label: kindLabel(index, k) }))}
          onPick={(k) => setMode((own as readonly string[]).includes(k) ? { mode: 'add', kind: k as Inside } : { mode: 'adopt', kind: k })} />
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
