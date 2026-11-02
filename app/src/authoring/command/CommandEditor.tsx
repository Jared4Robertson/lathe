import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CommandKind } from '../../../../lathe/src/authoring/command/model';
import type { CommandPage } from '../../../../lathe/src/authoring/command/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, addOrChangeFields, changeInput, CommandForm, draftOf, emptyDraft, Fields, LONG, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type Writer, type CommandInputs, type CommandRoute } from '../../edit/write';
import { adderOf, othersAddedUnder } from '../../record/pages';
import { AddMenu } from '../../edit/AddMenu';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { COMMAND_FIELDS } from './fields.generated';
import { useNextCommandId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { kindWord, addedUnder } from '../../platform/meta-model/reads';

// The Command editor (LA-AUT-A8): the actions on a record of a command, each sending one of the aggregate's own
// commands, POST /api/command/<command>, and nothing else. Edit sends its kind's Change with only what changed (a
// command's events, specifications and domain services as lists of IDs, a policy's event as one); Add opens an empty
// form for a kind that sits under the record in the command (its one handler or a policy under the command; a policy's
// one event handler and one test), with the next free ID read from the aggregate (next-id), and sends its Add; Remove
// says what goes with the record and sends its Remove. The aggregate has no Move. Another aggregate's root that sits
// under a command (an endpoint) is added through that aggregate's own Add form, from the Record page's list (adderOf).
// A command is added from its entity's page (AddCommandForm). A refusal shows every reason the command gave, in its own
// words, keeps what was entered, and changes nothing.

type Inside = Exclude<CommandKind, 'command'>;

/** The kinds a record of another kind has under it inside the command; the meta model says which sit under which. */
const INSIDE: readonly Inside[] = ['command_handler', 'policy', 'event_handler', 'policy_test'];

/** Where the command sits: the entity it changes, that entity's aggregate, the domain and the product. */
interface Place {
  aggregate: string;
  domain: string;
  product: string;
}

/** The place of a command under the entity it changes, read from the records the page names. */
function placeOf(index: RecordIndex, entity: string): Place {
  const record = index.byId.get(entity);
  return { aggregate: record?.parent ?? '', domain: record?.domain ?? '', product: record?.product ?? '' };
}

/** The records of these kinds the filter keeps, as choices. */
function choices(index: RecordIndex, kinds: readonly string[], keep: (r: { parent?: string | null; domain?: string | null; product?: string | null }) => boolean): Choice[] {
  return [...index.byId.values()].filter((r) => kinds.includes(r.kind) && keep(r)).map((r) => ({ id: r.id, title: r.title }));
}

/** The fields each kind's Add and Change take, from their inputs (Change leaves out the ID, Add the parent). */
function fieldsOf(index: RecordIndex, place: Place, kind: CommandKind, adding: boolean): FieldSpec[] {
  const F = COMMAND_FIELDS;
  const meets = { choices: choices(index, ['standard_rule'], (r) => r.product === place.product) };
  switch (kind) {
    case 'command': {
      const hints = {
        description: LONG,
        raises: { choices: choices(index, ['domain_event'], (r) => r.parent === place.aggregate) },
        checks: { choices: choices(index, ['specification'], (r) => r.domain === place.domain) },
        calls: { choices: choices(index, ['domain_service'], (r) => r.domain === place.domain) },
      };
      return addOrChangeFields(adding, F['/api/command/add-command'], 'entity_id', F['/api/command/change-command'], hints);
    }
    case 'command_handler':
      return addOrChangeFields(adding, F['/api/command/add-command-handler'], 'command_id', F['/api/command/change-command-handler'], { description: LONG, meets });
    case 'policy':
      return addOrChangeFields(adding, F['/api/command/add-policy'], 'command_id', F['/api/command/change-policy'], {
        statement: LONG,
        hears: { choices: choices(index, ['domain_event'], (r) => r.product === place.product) },
        exchanges_with: { choices: choices(index, ['integration'], (r) => r.product === place.product) },
      });
    case 'event_handler':
      return addOrChangeFields(adding, F['/api/command/add-event-handler'], 'policy_id', F['/api/command/change-event-handler'], { description: LONG, meets });
    case 'policy_test':
      return addOrChangeFields(adding, F['/api/command/add-policy-test'], 'policy_id', F['/api/command/change-policy-test'], { when: LONG, then: LONG, manual_reason: LONG, notes: LONG, starts_from: { choices: choices(index, ['test_data_set'], (r) => r.product === place.product) } });
  }
}

const policyOf = (page: CommandPage, id: string) => page.policies.find((p) => p.policy.id === id || p.eventHandler?.handler.id === id || p.test?.test.id === id)!;

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(page: CommandPage, kind: CommandKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'command':
      return { ...page.command, raises: page.raises, checks: page.checks, calls: page.calls };
    case 'command_handler':
      return { ...page.handler!.handler, meets: page.handler!.meets, packages: page.handler!.packages };
    case 'policy': {
      const p = policyOf(page, id);
      return { ...p.policy, hears: p.hears ?? undefined, exchanges_with: p.exchangesWith };
    }
    case 'event_handler': {
      const h = policyOf(page, id).eventHandler!;
      return { ...h.handler, meets: h.meets, packages: h.packages };
    }
    case 'policy_test': {
      const t = policyOf(page, id).test!;
      return { ...t.test, starts_from: t.startsFrom };
    }
  }
}

/** Each kind's Change command. */
const CHANGE: Record<CommandKind, CommandRoute> = {
  command: '/api/command/change-command',
  command_handler: '/api/command/change-command-handler',
  policy: '/api/command/change-policy',
  event_handler: '/api/command/change-event-handler',
  policy_test: '/api/command/change-policy-test',
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<CommandKind, { route: CommandRoute; parent: string }> = {
  command: { route: '/api/command/add-command', parent: 'entity_id' },
  command_handler: { route: '/api/command/add-command-handler', parent: 'command_id' },
  policy: { route: '/api/command/add-policy', parent: 'command_id' },
  event_handler: { route: '/api/command/add-event-handler', parent: 'policy_id' },
  policy_test: { route: '/api/command/add-policy-test', parent: 'policy_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<CommandKind, CommandRoute> = {
  command: '/api/command/remove-command',
  command_handler: '/api/command/remove-command-handler',
  policy: '/api/command/remove-policy',
  event_handler: '/api/command/remove-event-handler',
  policy_test: '/api/command/remove-policy-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: CommandRoute, input: Record<string, unknown>): Promise<WriteAnswer> => writer.command(route, input as unknown as CommandInputs[typeof route]);

/** What goes with a record when it is removed, inside the command: what sits under it. */
function goesWith(page: CommandPage, kind: CommandKind, id: string): string[] {
  const ofPolicy = (p: CommandPage['policies'][number]) => [...(p.eventHandler ? [p.eventHandler.handler.id] : []), ...(p.test ? [p.test.test.id] : [])];
  if (kind === 'command') return [...(page.handler ? [page.handler.handler.id] : []), ...page.policies.flatMap((p) => [p.policy.id, ...ofPolicy(p)])];
  if (kind === 'policy') return ofPolicy(policyOf(page, id));
  return [];
}

/** The record a removed one's page gives way to: what it sits under. */
function parentOf(page: CommandPage, kind: CommandKind, id: string): string {
  if (kind === 'command') return page.command.entity_id;
  if (kind === 'event_handler' || kind === 'policy_test') return policyOf(page, id).policy.id;
  return page.command.id;
}


type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Inside } | { mode: 'adopt'; kind: string } | { mode: 'remove' };

/** A record of the command with its actions; a form or the remove question shows in place of its page. */
export function CommandEditor({ index, page, children }: { index: RecordIndex; page: CommandPage; children: ReactNode }) {
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
  const place = placeOf(index, page.command.entity_id);
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, place, kind, false);
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
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} place={place} kind={mode.kind} parent={id} onDone={back} /></div>;
  if (mode.mode === 'adopt') {
    const Adder = adderOf(index.meta, mode.kind)!;
    return <div className="spec-body"><Adder index={index} parent={id} onDone={back} /></div>;
  }
  // A command has one handler, and a policy one event handler and one test: once it has it, there is nothing more to add of that kind.
  const adds = addedUnder(index.meta, kind, INSIDE).filter((k) =>
    (k !== 'command_handler' || !page.handler)
    && (k !== 'event_handler' || !policyOf(page, id).eventHandler)
    && (k !== 'policy_test' || !policyOf(page, id).test));
  const others = othersAddedUnder(index.meta, kind);
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        <AddMenu id={id} choices={[...adds, ...others].map((k) => ({ key: k, label: kindLabel(index, k) }))}
          onPick={(k) => setMode((adds as readonly string[]).includes(k) ? { mode: 'add', kind: k as Inside } : { mode: 'adopt', kind: k })} />
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

/** Add: an empty form for a kind of the aggregate (a command under its entity, or a kind under the record), its ID the next free one, sent as that kind's Add. */
function AddForm({ index, place, kind, parent, onDone }: { index: RecordIndex; place: Place; kind: CommandKind; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextCommandId(kind, parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, place, kind, true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { [ADD[kind].parent]: parent });
    const answer = await send(writer, ADD[kind].route, input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  const article = /^[aeiou]/.test(kindWord(index.meta, kind)) ? 'an' : 'a';
  return (
    <CommandForm eyebrow={`New ${kindWord(index.meta, kind)} under ${parent}`} title={`Add ${article} ${kindWord(index.meta, kind)}`} submit={submit} saveLabel={`Add ${kindWord(index.meta, kind)}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a command to an entity (from the entity's page): the aggregate's own Add, with the next free ID in its domain. */
export function AddCommandForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  return <AddForm index={index} place={placeOf(index, parent)} kind="command" parent={parent} onDone={onDone} />;
}
