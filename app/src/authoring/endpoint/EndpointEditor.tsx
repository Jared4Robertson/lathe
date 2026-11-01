import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { EndpointKind } from '../../../../lathe/src/authoring/endpoint/model';
import type { EndpointPage } from '../../../../lathe/src/authoring/endpoint/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, addOrChangeFields, changeInput, CommandForm, draftOf, emptyDraft, Fields, formFields, LONG, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import { IdField, type Choice } from '../../edit/fields';
import { AddMenu } from '../../edit/AddMenu';
import { useWriter, type Writer, type CommandInputs, type CommandRoute } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { ENDPOINT_FIELDS } from './fields.generated';
import { useNextEndpointId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { kindWord } from '../../platform/meta-model/reads';

// The Endpoint editor (LA-AUT-A13): the actions on a record of an endpoint, each sending one of the aggregate's own
// commands, POST /api/endpoint/<command>, and nothing else. Edit sends its kind's Change with only what changed; Add
// opens an empty form for a kind that sits under the record (an API requirement or, while it has none, the handler
// under the endpoint; a test under an API requirement), with the next free ID read from the aggregate (next-id), and
// sends its Add; Move, offered only for the endpoint (MOVE), sends Move an endpoint to another command or query of its
// domain; Remove says what goes with the record and sends its Remove. An endpoint is added from its command's or
// query's page (AddEndpointForm). A refusal shows every reason the command gave, in its own words, keeps what was
// entered, and changes nothing.

/** The kinds that sit under a record of the endpoint and are added from its page; an endpoint has one handler. */
function addsUnder(page: EndpointPage): Exclude<EndpointKind, 'endpoint'>[] {
  switch (page.record.kind) {
    case 'endpoint':
      return page.handler ? ['api_requirement'] : ['api_requirement', 'endpoint_handler'];
    case 'api_requirement':
      return ['endpoint_test'];
    default:
      return [];
  }
}

/** The kinds the aggregate has a Move command for, each with it: a record of another kind is never moved. */
const MOVE: Partial<Record<EndpointKind, '/api/endpoint/move-endpoint'>> = { endpoint: '/api/endpoint/move-endpoint' };

/** The product's records of the kinds, as choices. */
const choicesOf = (index: RecordIndex, product: string | undefined, kinds: readonly string[]): Choice[] =>
  [...index.byId.values()].filter((r) => kinds.includes(r.kind) && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields each kind's Add and Change take, from their inputs (Change leaves out the ID, Add the parent). */
function fieldsOf(index: RecordIndex, product: string | undefined, kind: EndpointKind, adding: boolean): FieldSpec[] {
  const F = ENDPOINT_FIELDS;
  switch (kind) {
    case 'endpoint': {
      // The command or query it exposes is the parent: the form sends whichever it is.
      const hints = { description: LONG, notes: LONG };
      return adding ? formFields(F['/api/endpoint/add-endpoint'], ['command_id', 'query_id'], hints) : formFields(F['/api/endpoint/change-endpoint'], ['id'], hints);
    }
    case 'api_requirement':
      return addOrChangeFields(adding, F['/api/endpoint/add-api-requirement'], 'endpoint_id', F['/api/endpoint/change-api-requirement'], { statement: LONG });
    case 'endpoint_handler':
      return addOrChangeFields(adding, F['/api/endpoint/add-endpoint-handler'], 'endpoint_id', F['/api/endpoint/change-endpoint-handler'], { description: LONG, meets: { choices: choicesOf(index, product, ['standard_rule']) } });
    case 'endpoint_test':
      return addOrChangeFields(adding, F['/api/endpoint/add-endpoint-test'], 'api_requirement_id', F['/api/endpoint/change-endpoint-test'], { when: LONG, then: LONG, manual_reason: LONG, notes: LONG, starts_from: { choices: choicesOf(index, product, ['test_data_set']) } });
  }
}

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(page: EndpointPage, kind: EndpointKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'endpoint':
      return { ...page.endpoint };
    case 'api_requirement':
      return { ...page.requirements.find((r) => r.requirement.id === id)!.requirement };
    case 'endpoint_handler':
      return { ...page.handler!.handler, meets: page.handler!.meets, packages: page.handler!.packages };
    case 'endpoint_test': {
      const test = page.requirements.flatMap((r) => r.tests).find((t) => t.test.id === id)!;
      return { ...test.test, starts_from: test.startsFrom };
    }
  }
}

/** Each kind's Change command. */
const CHANGE: Record<EndpointKind, CommandRoute> = {
  endpoint: '/api/endpoint/change-endpoint',
  api_requirement: '/api/endpoint/change-api-requirement',
  endpoint_handler: '/api/endpoint/change-endpoint-handler',
  endpoint_test: '/api/endpoint/change-endpoint-test',
};

/** Each kind's Add command (an endpoint's names its parent by the parent's kind, in AddEndpointForm), and the field that names its parent. */
const ADD: Record<Exclude<EndpointKind, 'endpoint'>, { route: CommandRoute; parent: string }> = {
  api_requirement: { route: '/api/endpoint/add-api-requirement', parent: 'endpoint_id' },
  endpoint_handler: { route: '/api/endpoint/add-endpoint-handler', parent: 'endpoint_id' },
  endpoint_test: { route: '/api/endpoint/add-endpoint-test', parent: 'api_requirement_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<EndpointKind, CommandRoute> = {
  endpoint: '/api/endpoint/remove-endpoint',
  api_requirement: '/api/endpoint/remove-api-requirement',
  endpoint_handler: '/api/endpoint/remove-endpoint-handler',
  endpoint_test: '/api/endpoint/remove-endpoint-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: CommandRoute, input: Record<string, unknown>): Promise<WriteAnswer> => writer.command(route, input as unknown as CommandInputs[typeof route]);

/** What goes with a record when it is removed, inside the endpoint: what sits under it. */
function goesWith(page: EndpointPage, kind: EndpointKind, id: string): string[] {
  if (kind === 'endpoint') return [...(page.handler ? [page.handler.handler.id] : []), ...page.requirements.flatMap((r) => [r.requirement.id, ...r.tests.map((t) => t.test.id)])];
  if (kind === 'api_requirement') return page.requirements.find((r) => r.requirement.id === id)!.tests.map((t) => t.test.id);
  return [];
}

/** The record a removed one's page gives way to: what it sits under. */
function parentOf(page: EndpointPage, kind: EndpointKind, id: string): string {
  if (kind === 'endpoint') return page.endpoint.command_id ?? page.endpoint.query_id ?? '';
  if (kind === 'endpoint_test') return page.requirements.find((r) => r.tests.some((t) => t.test.id === id))!.requirement.id;
  return page.endpoint.id;
}

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Exclude<EndpointKind, 'endpoint'> } | { mode: 'move' } | { mode: 'remove' };

/** A record of the endpoint with its actions; a form or the remove question shows in place of its page. */
export function EndpointEditor({ index, page, children }: { index: RecordIndex; page: EndpointPage; children: ReactNode }) {
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
  const product = index.byId.get(page.endpoint.id)?.product ?? undefined;
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
  if (mode.mode === 'move') return <div className="spec-body"><MoveForm index={index} page={page} writer={writer} onDone={back} /></div>;
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        <AddMenu id={id} choices={addsUnder(page).map((k) => ({ key: k, label: kindLabel(index, k) }))} onPick={(k) => setMode({ mode: 'add', kind: k as Exclude<EndpointKind, 'endpoint'> })} />
        {MOVE[kind] && <Button onClick={() => setMode({ mode: 'move' })}>Move</Button>}
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

/** Add: an empty form for a kind under the record, its ID the next free one, sent as that kind's Add. */
function AddForm({ index, product, kind, parent, onDone }: { index: RecordIndex; product: string | undefined; kind: Exclude<EndpointKind, 'endpoint'>; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextEndpointId(kind, parent, index);
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
    <CommandForm eyebrow={`New ${kindWord(index.meta, kind)} under ${parent}`} title={`Add an ${kindWord(index.meta, kind)}`} submit={submit} saveLabel={`Add ${kindWord(index.meta, kind)}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Move: the endpoint to another command or query of its domain, as its own command. */
function MoveForm({ index, page, writer, onDone }: { index: RecordIndex; page: EndpointPage; writer: Writer; onDone: () => void }) {
  const announce = useAnnounce();
  const { endpoint } = page;
  const exposes = endpoint.command_id ?? endpoint.query_id ?? '';
  const [target, setTarget] = useState(exposes);
  const formId = useId();
  const domain = index.byId.get(endpoint.id)?.domain;
  const choices = [...index.byId.values()].filter((r) => (r.kind === 'command' || r.kind === 'query') && r.domain === domain).map((r) => ({ id: r.id, title: r.title }));
  const submit = async () => {
    if (target === exposes) { announce('Nothing changed'); onDone(); return null; }
    const by = index.byId.get(target)?.kind === 'query' ? 'query_id' : 'command_id';
    const answer = await writer.command(MOVE.endpoint!, { id: endpoint.id, [by]: target });
    if (answer.ok) { announce(`Moved ${endpoint.id}`); onDone(); }
    return answer;
  };
  return (
    <CommandForm eyebrow="Endpoint" title={`Move ${endpoint.id}`} submit={submit} saveLabel="Move" onCancel={onDone}>
      {(first) => (
        <IdField id={`${formId}-exposes`} label="Exposes" required inputRef={first} choices={choices} value={target} onChange={setTarget}
          description="The command or query of its domain it now exposes; everything in the endpoint moves with it." />
      )}
    </CommandForm>
  );
}

/**
 * Add an endpoint under the command or query it exposes (from that record's page): the aggregate's own Add, its ID
 * the next free one in the domain, naming its parent by the parent's kind.
 */
export function AddEndpointForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextEndpointId('endpoint', parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, index.byId.get(parent)?.product ?? undefined, 'endpoint', true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { [index.byId.get(parent)?.kind === 'query' ? 'query_id' : 'command_id']: parent });
    const answer = await send(writer, '/api/endpoint/add-endpoint', input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New endpoint under ${parent}`} title="Add an endpoint" submit={submit} saveLabel="Add endpoint" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
