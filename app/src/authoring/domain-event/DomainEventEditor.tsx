import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DomainEventKind } from '../../../../lathe/src/authoring/domain-event/model';
import type { DomainEventPage } from '../../../../lathe/src/authoring/domain-event/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type Writer } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { sendDomainEvent, type DomainEventCommands, type DomainEventRoute } from './commands';
import { useNextDomainEventId } from './reads';
import '../../edit/edit.css';

// The Domain event editor (LA-AUT-A7): the actions on a domain event or its event type, each sending one of the
// aggregate's own commands, POST /api/domain-event/<command>, and nothing else. Edit sends its kind's Change with only
// what changed (an event's fields as a list of rows); Add opens an empty form for the event's one event type, with its
// ID read from the aggregate (next-id), and sends its Add; Remove says what goes with the record and sends its Remove.
// The aggregate has no Move. A domain event is added from its aggregate's page (AddDomainEventForm). A refusal shows
// every reason the command gave, in its own words, keeps what was entered, and changes nothing.

/** A kind's label in a sentence. */
const LABEL: Record<DomainEventKind, string> = { domain_event: 'domain event', event_type: 'event type' };

/** The product's records of these kinds, as choices. */
function choices(index: RecordIndex, product: string, kinds: readonly string[]): Choice[] {
  return [...index.byId.values()].filter((r) => kinds.includes(r.kind) && r.product === product).map((r) => ({ id: r.id, title: r.title }));
}

/** The fields each kind's Add and Change take (Change leaves out the ID), in their input's order. */
function fieldsOf(index: RecordIndex, product: string, kind: DomainEventKind, adding: boolean): FieldSpec[] {
  const id = (table: string): FieldSpec[] => (adding ? [{ field: 'id', column: 'id', table }] : []);
  if (kind === 'domain_event') {
    return [
      ...id('domain_event'),
      { field: 'title', column: 'title', table: 'domain_event' },
      { field: 'published', column: 'published', table: 'domain_event' },
      { field: 'description', column: 'description', table: 'domain_event', long: true },
      { field: 'fields', label: 'Fields', description: 'The fields it carries in order, each a name, what it means, exactly one type (a basic type, a value object or an aggregate), whether it is required, and its column and an example when they help. The list replaces its fields.', table: 'event_field', columns: ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'] },
    ];
  }
  return [
    ...id('event_type'),
    { field: 'title', column: 'title', table: 'event_type' },
    { field: 'delivery', column: 'delivery', table: 'event_type' },
    { field: 'file', column: 'file', table: 'event_type' },
    { field: 'meets', label: 'Meets', description: 'The standard rules it meets.', many: choices(index, product, ['standard_rule']) },
    { field: 'packages', label: 'Packages', description: 'The packages it uses, by their names in the product\'s package.json files. The list replaces its packages.', table: 'package_use', columns: ['package'] },
  ];
}

/** The record's current values, by its input's field names: its row's columns, its parts and the links it starts. */
function currentOf(page: DomainEventPage, kind: DomainEventKind): Record<string, unknown> {
  if (kind === 'domain_event') return { ...page.event, fields: page.fields };
  const t = page.eventType!;
  return { ...t.eventType, meets: t.meets, packages: t.packages.map((p) => ({ package: p })) };
}

/** The command's input with its packages as the names it takes, when it sends them. */
function withPackageNames(input: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(input.packages)) return input;
  return { ...input, packages: (input.packages as { package?: string }[]).map((p) => p.package ?? '').filter(Boolean) };
}

/** Each kind's Change command, and the fields it may clear with null. */
const CHANGE: Record<DomainEventKind, { route: DomainEventRoute; clearable: readonly string[] }> = {
  domain_event: { route: '/api/domain-event/change-domain-event', clearable: [] },
  event_type: { route: '/api/domain-event/change-event-type', clearable: ['delivery', 'file'] },
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<DomainEventKind, { route: DomainEventRoute; parent: string }> = {
  domain_event: { route: '/api/domain-event/add-domain-event', parent: 'aggregate_id' },
  event_type: { route: '/api/domain-event/add-event-type', parent: 'domain_event_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<DomainEventKind, DomainEventRoute> = {
  domain_event: '/api/domain-event/remove-domain-event',
  event_type: '/api/domain-event/remove-event-type',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: DomainEventRoute, input: Record<string, unknown>): Promise<WriteAnswer> => sendDomainEvent(writer, route, withPackageNames(input) as unknown as DomainEventCommands[typeof route]);

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add' } | { mode: 'remove' };

/** A record of the domain event with its actions; a form or the remove question shows in place of its page. */
export function DomainEventEditor({ index, page, children }: { index: RecordIndex; page: DomainEventPage; children: ReactNode }) {
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
  const product = index.byId.get(page.event.id)?.product ?? '';
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, product, kind, false);
    const current = currentOf(page, kind);
    const submit = async (draft: Draft) => {
      const input = changeInput(index, specs, draft, current, { id }, CHANGE[kind].clearable);
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await send(writer, CHANGE[kind].route, input);
      if (answer.ok) { announce(`Saved ${id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} eyebrow={LABEL[kind]} id={id} submit={submit} onDone={back} /></div>;
  }
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} product={product} kind="event_type" parent={id} onDone={back} /></div>;
  // An event has one event type: once it has it, there is nothing to add under it.
  const canAdd = kind === 'domain_event' && !page.eventType;
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        {canAdd && <Button icon="plus" onClick={() => setMode({ mode: 'add' })}>Add {LABEL.event_type}</Button>}
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={LABEL[kind]} goes={kind === 'domain_event' && page.eventType ? [page.eventType.eventType.id] : []}
          then={addressOf(kind === 'domain_event' ? page.event.aggregate_id : page.event.id)} onCancel={back}
          remove={() => sendDomainEvent(writer, REMOVE[kind], { id })} />
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

/** Add: an empty form for a kind of the aggregate (an event under its aggregate, or its event type), its ID the next free one, sent as that kind's Add. */
function AddForm({ index, product, kind, parent, onDone }: { index: RecordIndex; product: string; kind: DomainEventKind; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextDomainEventId(kind, parent, index);
  // A new event starts unpublished: only one other domains hear is published.
  const text: Record<string, string> = kind === 'domain_event' ? { published: 'false' } : {};
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), text }));
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
  const article = /^[aeiou]/.test(LABEL[kind]) ? 'an' : 'a';
  return (
    <CommandForm eyebrow={`New ${LABEL[kind]} under ${parent}`} title={`Add ${article} ${LABEL[kind]}`} submit={submit} saveLabel={`Add ${LABEL[kind]}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a domain event to an aggregate (from the aggregate's page): the aggregate's own Add, with the next free ID in its domain. */
export function AddDomainEventForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  return <AddForm index={index} product={index.byId.get(parent)?.product ?? ''} kind="domain_event" parent={parent} onDone={onDone} />;
}
