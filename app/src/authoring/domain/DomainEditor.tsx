import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DomainKind } from '../../../../lathe/src/authoring/domain/model';
import type { DomainPage } from '../../../../lathe/src/authoring/domain/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, addOrChangeFields, changeInput, CommandForm, draftOf, emptyDraft, Fields, formFields, LONG, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type Writer, type CommandInputs, type CommandRoute } from '../../edit/write';
import { adderOf, othersAddedUnder } from '../../record/pages';
import { AddMenu } from '../../edit/AddMenu';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { DOMAIN_FIELDS } from './fields.generated';
import { useNextDomainId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { kindWord, addedUnder } from '../../platform/meta-model/reads';

// The Domain editor (LA-AUT-A4): the actions on a record of a domain, each sending one of the aggregate's own commands,
// POST /api/domain/<command>, and nothing else. Edit sends its kind's Change with only what changed; Add opens an empty
// form for a kind that sits under the record in the domain (a capability, term, domain service or repository under the
// domain; a service or test under a domain service), with the next free ID read from the aggregate (next-id), and sends
// its Add; Remove says what goes with the record and sends its Remove. The aggregate has no Move. Another aggregate's
// root that sits under a domain or a capability (a test data set, a use case) is added through that aggregate's own
// Add form, from the Record page's list (adderOf). A domain is added from its product's page (AddDomainForm). A refusal
// shows every reason the command gave, in its own words, keeps what was entered, and changes nothing.

type Inside = Exclude<DomainKind, 'domain'>;

/** The kinds a record of another kind has under it inside the domain; the meta model says which sit under which. */
const INSIDE: readonly Inside[] = ['capability', 'term', 'domain_service', 'repository', 'service', 'domain_service_test'];

/** The product's records of these kinds, as choices; `domain` narrows them to its own. */
function choices(index: RecordIndex, product: string, kinds: readonly string[], domain?: string): Choice[] {
  return [...index.byId.values()]
    .filter((r) => kinds.includes(r.kind) && r.product === product && (domain === undefined || r.domain === domain))
    .map((r) => ({ id: r.id, title: r.title }));
}

/** The fields each kind's Add and Change take, from their inputs (Change leaves out the ID, Add the parent). */
function fieldsOf(index: RecordIndex, page: DomainPage | null, product: string, kind: DomainKind, adding: boolean): FieldSpec[] {
  const F = DOMAIN_FIELDS;
  const meets = { choices: choices(index, product, ['standard_rule']) };
  switch (kind) {
    case 'domain':
      return addOrChangeFields(adding, F['/api/domain/add-domain'], 'product_id', F['/api/domain/change-domain'], { description: LONG, notes: LONG });
    case 'capability':
      return addOrChangeFields(adding, F['/api/domain/add-capability'], 'domain_id', F['/api/domain/change-capability'], { description: LONG, serves: { choices: choices(index, product, ['business_outcome']) } });
    case 'term': {
      const builds = { choices: choices(index, product, ['term']).filter((c) => c.id !== page?.record.id || adding) };
      return addOrChangeFields(adding, F['/api/domain/add-term'], 'domain_id', F['/api/domain/change-term'], { meaning: LONG, builds_on: builds });
    }
    case 'domain_service':
      return addOrChangeFields(adding, F['/api/domain/add-domain-service'], 'domain_id', F['/api/domain/change-domain-service'], { statement: LONG });
    case 'service':
      return addOrChangeFields(adding, F['/api/domain/add-service'], 'domain_service_id', F['/api/domain/change-service'], { meets });
    case 'repository': {
      const hints = { description: LONG, persists: { choices: choices(index, product, ['aggregate'], page?.domain.id) }, meets };
      // The form has never offered the data store a repository is stored in (stored_in).
      return adding ? formFields(F['/api/domain/add-repository'], ['domain_id', 'stored_in'], hints) : formFields(F['/api/domain/change-repository'], ['id', 'stored_in'], hints);
    }
    case 'domain_service_test':
      return addOrChangeFields(adding, F['/api/domain/add-domain-service-test'], 'domain_service_id', F['/api/domain/change-domain-service-test'], { when: LONG, then: LONG, manual_reason: LONG, notes: LONG, starts_from: { choices: choices(index, product, ['test_data_set']) } });
  }
}

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(page: DomainPage, kind: DomainKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'domain':
      return { ...page.domain };
    case 'capability': {
      const c = page.capabilities.find((x) => x.capability.id === id)!;
      return { ...c.capability, serves: c.serves };
    }
    case 'term': {
      const t = page.terms.find((x) => x.term.id === id)!;
      return { ...t.term, builds_on: t.buildsOn };
    }
    case 'domain_service':
      return { ...page.domainServices.find((s) => s.domainService.id === id)!.domainService };
    case 'service': {
      const s = page.domainServices.find((x) => x.service?.service.id === id)!.service!;
      return { ...s.service, meets: s.meets, packages: s.packages };
    }
    case 'domain_service_test': {
      const t = page.domainServices.flatMap((s) => s.tests).find((x) => x.test.id === id)!;
      return { ...t.test, starts_from: t.startsFrom };
    }
    case 'repository': {
      const r = page.repositories.find((x) => x.repository.id === id)!;
      return { ...r.repository, persists: r.persists ?? undefined, meets: r.meets, packages: r.packages };
    }
  }
}

/** Each kind's Change command. */
const CHANGE: Record<DomainKind, CommandRoute> = {
  domain: '/api/domain/change-domain',
  capability: '/api/domain/change-capability',
  term: '/api/domain/change-term',
  domain_service: '/api/domain/change-domain-service',
  service: '/api/domain/change-service',
  domain_service_test: '/api/domain/change-domain-service-test',
  repository: '/api/domain/change-repository',
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<DomainKind, { route: CommandRoute; parent: string }> = {
  domain: { route: '/api/domain/add-domain', parent: 'product_id' },
  capability: { route: '/api/domain/add-capability', parent: 'domain_id' },
  term: { route: '/api/domain/add-term', parent: 'domain_id' },
  domain_service: { route: '/api/domain/add-domain-service', parent: 'domain_id' },
  service: { route: '/api/domain/add-service', parent: 'domain_service_id' },
  domain_service_test: { route: '/api/domain/add-domain-service-test', parent: 'domain_service_id' },
  repository: { route: '/api/domain/add-repository', parent: 'domain_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<DomainKind, CommandRoute> = {
  domain: '/api/domain/remove-domain',
  capability: '/api/domain/remove-capability',
  term: '/api/domain/remove-term',
  domain_service: '/api/domain/remove-domain-service',
  service: '/api/domain/remove-service',
  domain_service_test: '/api/domain/remove-domain-service-test',
  repository: '/api/domain/remove-repository',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: CommandRoute, input: Record<string, unknown>): Promise<WriteAnswer> => writer.command(route, input as unknown as CommandInputs[typeof route]);

/** The domain service that holds a service or a domain service test. */
const serviceHolding = (page: DomainPage, id: string) => page.domainServices.find((s) => s.service?.service.id === id || s.tests.some((t) => t.test.id === id))!;

/** What goes with a record when it is removed, inside the domain: what sits under it. */
function goesWith(page: DomainPage, kind: DomainKind, id: string): string[] {
  const ofService = (s: DomainPage['domainServices'][number]) => [...(s.service ? [s.service.service.id] : []), ...s.tests.map((t) => t.test.id)];
  if (kind === 'domain') {
    return [
      ...page.capabilities.map((c) => c.capability.id),
      ...page.terms.map((t) => t.term.id),
      ...page.domainServices.flatMap((s) => [s.domainService.id, ...ofService(s)]),
      ...page.repositories.map((r) => r.repository.id),
    ];
  }
  if (kind === 'domain_service') return ofService(page.domainServices.find((s) => s.domainService.id === id)!);
  return [];
}

/** The record a removed one's page gives way to: what it sits under. */
function parentOf(page: DomainPage, kind: DomainKind, id: string): string {
  if (kind === 'domain') return page.domain.product_id;
  if (kind === 'service' || kind === 'domain_service_test') return serviceHolding(page, id).domainService.id;
  return page.domain.id;
}


type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Inside } | { mode: 'adopt'; kind: string } | { mode: 'remove' };

/** A record of the domain with its actions; a form or the remove question shows in place of its page. */
export function DomainEditor({ index, page, children }: { index: RecordIndex; page: DomainPage; children: ReactNode }) {
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
  const product = page.domain.product_id;
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, page, product, kind, false);
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
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} page={page} kind={mode.kind} parent={id} onDone={back} /></div>;
  if (mode.mode === 'adopt') {
    const Adder = adderOf(index.meta, mode.kind)!;
    return <div className="spec-body"><Adder index={index} parent={id} onDone={back} /></div>;
  }
  // A domain service has one service: once it has it, there is nothing more to add of that kind.
  const adds = addedUnder(index.meta, kind, INSIDE).filter((k) => k !== 'service' || !page.domainServices.find((s) => s.domainService.id === id)?.service);
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

/** Add: an empty form for a kind under the record, its ID the next free one, sent as that kind's Add. */
function AddForm({ index, page, kind, parent, onDone }: { index: RecordIndex; page: DomainPage; kind: Inside; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextDomainId(kind, parent, index);
  // A new capability goes last.
  const text: Record<string, string> = kind === 'capability' ? { position: String(Math.max(0, ...page.capabilities.map((c) => c.capability.position)) + 1) } : {};
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), text }));
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, page, page.domain.product_id, kind, true);
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

/**
 * Add a domain to a product (from the product's page): the aggregate's own Add. A domain's ID is its product's and a
 * code chosen for it, so the form starts it with the product's prefix and leaves the code to the person.
 */
export function AddDomainForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), text: { id: `${parent}-` } }));
  const specs = fieldsOf(index, null, parent, 'domain', true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { product_id: parent });
    const answer = await send(writer, ADD.domain.route, input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New domain under ${parent}`} title="Add a domain" submit={submit} saveLabel="Add domain" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
