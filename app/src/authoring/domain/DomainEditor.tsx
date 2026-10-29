import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DomainKind } from '../../../../lathe/src/authoring/domain/model';
import type { DomainPage } from '../../../../lathe/src/authoring/domain/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type Writer } from '../../edit/write';
import { adderOf } from '../../record/pages';
import { lowerLabel } from '../../plural';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { kindLabel, type SpecIndex } from '../../specs/data';
import { addressOf } from '../../views/address';
import { sendDomain, type DomainCommands, type DomainRoute } from './commands';
import { useNextDomainId } from './reads';
import '../../edit/edit.css';

// The Domain editor (LA-AUT-A4): the actions on a record of a domain, each sending one of the aggregate's own commands,
// POST /api/domain/<command>, and nothing else. Edit sends its kind's Change with only what changed; Add opens an empty
// form for a kind that sits under the record in the domain (a capability, term, domain service or repository under the
// domain; a service or test under a domain service), with the next free ID read from the aggregate (next-id), and sends
// its Add; Remove says what goes with the record and sends its Remove. The aggregate has no Move. Another aggregate's
// root that sits under a domain or a capability (a test data set, a use case) is added through that aggregate's own
// Add form, from the Record page's list (adderOf). A domain is added from its product's page (AddDomainForm). A refusal
// shows every reason the command gave, in its own words, keeps what was entered, and changes nothing.

type Inside = Exclude<DomainKind, 'domain'>;

/** A kind's label in a sentence. */
const LABEL: Record<DomainKind, string> = {
  domain: 'domain',
  capability: 'capability',
  term: 'term',
  domain_service: 'domain service',
  service: 'service',
  domain_service_test: 'domain service test',
  repository: 'repository',
};

/** The kinds added under a record of each kind, inside the domain. */
const ADDED_UNDER: Record<DomainKind, Inside[]> = {
  domain: ['capability', 'term', 'domain_service', 'repository'],
  capability: [],
  term: [],
  domain_service: ['service', 'domain_service_test'],
  service: [],
  domain_service_test: [],
  repository: [],
};

/** The product's records of these kinds, as choices; `domain` narrows them to its own. */
function choices(index: SpecIndex, product: string, kinds: readonly string[], domain?: string): Choice[] {
  return [...index.byId.values()]
    .filter((r) => kinds.includes(r.kind) && r.product === product && (domain === undefined || r.domain === domain))
    .map((r) => ({ id: r.id, title: r.title }));
}

/** A technical record's standard rules and packages: the packages a list of names, one part row each. */
const technical = (index: SpecIndex, product: string): FieldSpec[] => [
  { field: 'meets', label: 'Meets', description: 'The standard rules it meets.', many: choices(index, product, ['standard_rule']) },
  { field: 'packages', label: 'Packages', description: 'The packages it uses, by their names in the product\'s package.json files. The list replaces its packages.', table: 'package_use', columns: ['package'] },
];

/** The fields each kind's Add and Change take (Change leaves out the ID), in their input's order. */
function fieldsOf(index: SpecIndex, page: DomainPage | null, product: string, kind: DomainKind, adding: boolean): FieldSpec[] {
  const id = (table: string): FieldSpec[] => (adding ? [{ field: 'id', column: 'id', table }] : []);
  switch (kind) {
    case 'domain':
      return [
        ...id('domain'),
        { field: 'title', column: 'title', table: 'domain' },
        { field: 'subdomain_type', column: 'subdomain_type', table: 'domain' },
        { field: 'description', column: 'description', table: 'domain', long: true },
        { field: 'notes', column: 'notes', table: 'domain', long: true },
      ];
    case 'capability':
      return [
        ...id('capability'),
        { field: 'title', column: 'title', table: 'capability' },
        { field: 'position', column: 'position', table: 'capability' },
        { field: 'description', column: 'description', table: 'capability', long: true },
        { field: 'serves', label: 'Serves', description: 'The business outcomes of its product it serves.', many: choices(index, product, ['business_outcome']) },
      ];
    case 'term':
      return [
        ...id('term'),
        { field: 'title', column: 'title', table: 'term' },
        { field: 'meaning', column: 'meaning', table: 'term', long: true },
        { field: 'group_name', column: 'group_name', table: 'term' },
      ];
    case 'domain_service':
      return [...id('domain_service'), { field: 'title', column: 'title', table: 'domain_service' }, { field: 'statement', column: 'statement', table: 'domain_service', long: true }];
    case 'service':
      return [...id('service'), { field: 'title', column: 'title', table: 'service' }, { field: 'file', column: 'file', table: 'service' }, ...technical(index, product)];
    case 'repository':
      return [
        ...id('repository'),
        { field: 'title', column: 'title', table: 'repository' },
        { field: 'file', column: 'file', table: 'repository' },
        { field: 'description', column: 'description', table: 'repository', long: true },
        { field: 'persists', label: 'Persists', description: 'The aggregate of its domain it loads and saves.', one: choices(index, product, ['aggregate'], page?.domain.id) },
        ...technical(index, product),
      ];
    case 'domain_service_test': {
      const table = 'domain_service_test';
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
        { field: 'starts_from', label: 'Starts from', description: 'The test data sets it starts from.', many: choices(index, product, ['test_data_set']) },
      ];
    }
  }
}

/** Packages as the form's part rows. */
const packageRows = (packages: readonly string[]) => packages.map((p) => ({ package: p }));

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(page: DomainPage, kind: DomainKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'domain':
      return { ...page.domain };
    case 'capability': {
      const c = page.capabilities.find((x) => x.capability.id === id)!;
      return { ...c.capability, serves: c.serves };
    }
    case 'term':
      return { ...page.terms.find((t) => t.id === id)! };
    case 'domain_service':
      return { ...page.domainServices.find((s) => s.domainService.id === id)!.domainService };
    case 'service': {
      const s = page.domainServices.find((x) => x.service?.service.id === id)!.service!;
      return { ...s.service, meets: s.meets, packages: packageRows(s.packages) };
    }
    case 'domain_service_test': {
      const t = page.domainServices.flatMap((s) => s.tests).find((x) => x.test.id === id)!;
      return { ...t.test, starts_from: t.startsFrom };
    }
    case 'repository': {
      const r = page.repositories.find((x) => x.repository.id === id)!;
      return { ...r.repository, persists: r.persists ?? undefined, meets: r.meets, packages: packageRows(r.packages) };
    }
  }
}

/** The command's input with its packages as the names it takes, when it sends them. */
function withPackageNames(input: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(input.packages)) return input;
  return { ...input, packages: (input.packages as { package?: string }[]).map((p) => p.package ?? '').filter(Boolean) };
}

/** Each kind's Change command, and the fields it may clear with null. */
const CHANGE: Record<DomainKind, { route: DomainRoute; clearable: readonly string[] }> = {
  domain: { route: '/api/domain/change-domain', clearable: ['notes'] },
  capability: { route: '/api/domain/change-capability', clearable: [] },
  term: { route: '/api/domain/change-term', clearable: ['group_name'] },
  domain_service: { route: '/api/domain/change-domain-service', clearable: [] },
  service: { route: '/api/domain/change-service', clearable: ['file'] },
  domain_service_test: { route: '/api/domain/change-domain-service-test', clearable: ['file', 'manual_reason', 'size', 'smoke', 'external', 'notes'] },
  repository: { route: '/api/domain/change-repository', clearable: ['file', 'persists'] },
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<DomainKind, { route: DomainRoute; parent: string }> = {
  domain: { route: '/api/domain/add-domain', parent: 'product_id' },
  capability: { route: '/api/domain/add-capability', parent: 'domain_id' },
  term: { route: '/api/domain/add-term', parent: 'domain_id' },
  domain_service: { route: '/api/domain/add-domain-service', parent: 'domain_id' },
  service: { route: '/api/domain/add-service', parent: 'domain_service_id' },
  domain_service_test: { route: '/api/domain/add-domain-service-test', parent: 'domain_service_id' },
  repository: { route: '/api/domain/add-repository', parent: 'domain_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<DomainKind, DomainRoute> = {
  domain: '/api/domain/remove-domain',
  capability: '/api/domain/remove-capability',
  term: '/api/domain/remove-term',
  domain_service: '/api/domain/remove-domain-service',
  service: '/api/domain/remove-service',
  domain_service_test: '/api/domain/remove-domain-service-test',
  repository: '/api/domain/remove-repository',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: DomainRoute, input: Record<string, unknown>): Promise<WriteAnswer> => sendDomain(writer, route, withPackageNames(input) as unknown as DomainCommands[typeof route]);

/** The domain service that holds a service or a domain service test. */
const serviceHolding = (page: DomainPage, id: string) => page.domainServices.find((s) => s.service?.service.id === id || s.tests.some((t) => t.test.id === id))!;

/** What goes with a record when it is removed, inside the domain: what sits under it. */
function goesWith(page: DomainPage, kind: DomainKind, id: string): string[] {
  const ofService = (s: DomainPage['domainServices'][number]) => [...(s.service ? [s.service.service.id] : []), ...s.tests.map((t) => t.test.id)];
  if (kind === 'domain') {
    return [
      ...page.capabilities.map((c) => c.capability.id),
      ...page.terms.map((t) => t.id),
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

/** The roots of other aggregates added under a record of this kind through their own Add form, by the schema's parents. */
function othersUnder(index: SpecIndex, kind: DomainKind): string[] {
  if (kind !== 'domain' && kind !== 'capability') return [];
  return Object.values(index.workspace.schema.kinds)
    .filter((k) => k.parents.some((p) => p.kind === kind) || (kind === 'domain' && k.parents.length === 0 && k.idScope === 'domain'))
    .map((k) => k.name)
    .filter((k) => adderOf(k) !== undefined)
    .sort();
}

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Inside } | { mode: 'adopt'; kind: string } | { mode: 'remove' };

/** A record of the domain with its actions; a form or the remove question shows in place of its page. */
export function DomainEditor({ index, page, children }: { index: SpecIndex; page: DomainPage; children: ReactNode }) {
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
  const product = page.domain.product_id;
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, page, product, kind, false);
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
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} page={page} kind={mode.kind} parent={id} onDone={back} /></div>;
  if (mode.mode === 'adopt') {
    const Adder = adderOf(mode.kind)!;
    return <div className="spec-body"><Adder index={index} parent={id} onDone={back} /></div>;
  }
  // A domain service has one service: once it has it, there is nothing more to add of that kind.
  const adds = ADDED_UNDER[kind].filter((k) => k !== 'service' || !page.domainServices.find((s) => s.domainService.id === id)?.service);
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        {adds.map((k) => <Button key={k} icon="plus" onClick={() => setMode({ mode: 'add', kind: k })}>Add {LABEL[k]}</Button>)}
        {othersUnder(index, kind).map((k) => <Button key={k} icon="plus" onClick={() => setMode({ mode: 'adopt', kind: k })}>Add {lowerLabel(kindLabel(index, k))}</Button>)}
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={LABEL[kind]} goes={goesWith(page, kind, id)} then={addressOf(parentOf(page, kind, id))} onCancel={back}
          remove={() => sendDomain(writer, REMOVE[kind], { id })} />
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

/** Add: an empty form for a kind under the record, its ID the next free one, sent as that kind's Add. */
function AddForm({ index, page, kind, parent, onDone }: { index: SpecIndex; page: DomainPage; kind: Inside; parent: string; onDone: () => void }) {
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
  const article = /^[aeiou]/.test(LABEL[kind]) ? 'an' : 'a';
  return (
    <CommandForm eyebrow={`New ${LABEL[kind]} under ${parent}`} title={`Add ${article} ${LABEL[kind]}`} submit={submit} saveLabel={`Add ${LABEL[kind]}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/**
 * Add a domain to a product (from the product's page): the aggregate's own Add. A domain's ID is its product's and a
 * code chosen for it, so the form starts it with the product's prefix and leaves the code to the person.
 */
export function AddDomainForm({ index, parent, onDone }: { index: SpecIndex; parent: string; onDone: () => void }) {
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
