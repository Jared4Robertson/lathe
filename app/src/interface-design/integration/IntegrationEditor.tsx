import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { IntegrationKind } from '../../../../lathe/src/interface-design/integration/model';
import type { IntegrationPage } from '../../../../lathe/src/interface-design/integration/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, addOrChangeFields, changeInput, CommandForm, draftOf, emptyDraft, Fields, formFields, LONG, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { AddMenu } from '../../edit/AddMenu';
import { useWriter, type Writer, type CommandInputs, type CommandRoute } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { INTEGRATION_FIELDS } from './fields.generated';
import { useNextIntegrationId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { kindWord } from '../../platform/meta-model/reads';

// The Integration editor (LA-IXD-A14): the actions on a record of an integration, each sending one of the aggregate's
// own commands, POST /api/integration/<command>, and nothing else. Edit sends its kind's Change with only what changed;
// Add opens an empty form for a kind that sits under the integration (its adapter, while it has none, or an integration
// test), with the next free ID read from the aggregate (next-id), and sends its Add; Remove says what goes with the
// record and sends its Remove. The aggregate has no Move. An integration is added from its product's page
// (AddIntegrationForm). A refusal shows every reason the command gave, in its own words, keeps what was entered, and
// changes nothing.

/** The kinds that sit under a record of the integration and are added from its page; an integration has one adapter. */
function addsUnder(page: IntegrationPage): Exclude<IntegrationKind, 'integration'>[] {
  if (page.record.kind !== 'integration') return [];
  return page.adapter ? ['integration_test'] : ['adapter', 'integration_test'];
}

/** The product's records of the kind, as choices. */
const choicesOf = (index: RecordIndex, product: string | undefined, kind: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === kind && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields each kind's Add and Change take, from their inputs; the hints add long text and the choices. */
function fieldsOf(index: RecordIndex, product: string | undefined, kind: IntegrationKind, adding: boolean): FieldSpec[] {
  const F = INTEGRATION_FIELDS;
  switch (kind) {
    case 'integration':
      // An integration has no parent column to leave out: its ID names its product.
      return adding ? formFields(F['/api/integration/add-integration'], [], { description: LONG }) : formFields(F['/api/integration/change-integration'], ['id'], { description: LONG });
    case 'adapter':
      return addOrChangeFields(adding, F['/api/integration/add-adapter'], 'integration_id', F['/api/integration/change-adapter'], { description: LONG, meets: { choices: choicesOf(index, product, 'standard_rule') } });
    case 'integration_test':
      return addOrChangeFields(adding, F['/api/integration/add-integration-test'], 'integration_id', F['/api/integration/change-integration-test'], {
        when: LONG, then: LONG, manual_reason: LONG, notes: LONG, starts_from: { choices: choicesOf(index, product, 'test_data_set') },
      });
  }
}

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(page: IntegrationPage, kind: IntegrationKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'integration':
      return { ...page.integration };
    case 'adapter':
      return { ...page.adapter!.adapter, meets: page.adapter!.meets, packages: page.adapter!.packages, helpers: page.adapter!.helpers };
    case 'integration_test': {
      const test = page.tests.find((t) => t.test.id === id)!;
      return { ...test.test, starts_from: test.startsFrom };
    }
  }
}

/** Each kind's Change command. */
const CHANGE: Record<IntegrationKind, CommandRoute> = {
  integration: '/api/integration/change-integration',
  adapter: '/api/integration/change-adapter',
  integration_test: '/api/integration/change-integration-test',
};

/** Each kind's Add command under the integration. */
const ADD: Record<Exclude<IntegrationKind, 'integration'>, CommandRoute> = {
  adapter: '/api/integration/add-adapter',
  integration_test: '/api/integration/add-integration-test',
};

/** Each kind's Remove command. */
const REMOVE: Record<IntegrationKind, CommandRoute> = {
  integration: '/api/integration/remove-integration',
  adapter: '/api/integration/remove-adapter',
  integration_test: '/api/integration/remove-integration-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: CommandRoute, input: Record<string, unknown>): Promise<WriteAnswer> => writer.command(route, input as unknown as CommandInputs[typeof route]);

/** What goes with a record when it is removed, inside the integration: what sits under it. */
function goesWith(page: IntegrationPage, kind: IntegrationKind): string[] {
  if (kind !== 'integration') return [];
  return [...(page.adapter ? [page.adapter.adapter.id] : []), ...page.tests.map((t) => t.test.id)];
}

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Exclude<IntegrationKind, 'integration'> } | { mode: 'remove' };

/** A record of the integration with its actions; a form or the remove question shows in place of its page. */
export function IntegrationEditor({ index, page, children }: { index: RecordIndex; page: IntegrationPage; children: ReactNode }) {
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
  const product = index.byId.get(page.integration.id)?.product ?? undefined;
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
  // A removed integration's page gives way to its product's; anything else's to its integration's.
  const then = addressOf(kind === 'integration' ? product ?? '' : page.integration.id);
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        <AddMenu id={id} choices={addsUnder(page).map((k) => ({ key: k, label: kindLabel(index, k) }))} onPick={(k) => setMode({ mode: 'add', kind: k as Exclude<IntegrationKind, 'integration'> })} />
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={kindWord(index.meta, kind)} goes={goesWith(page, kind)} then={then} onCancel={back}
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

/** Add: an empty form for the adapter or an integration test under the integration, its ID the next free one, sent as that kind's Add. */
function AddForm({ index, product, kind, parent, onDone }: { index: RecordIndex; product: string | undefined; kind: Exclude<IntegrationKind, 'integration'>; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextIntegrationId(kind, parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, product, kind, true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { integration_id: parent });
    const answer = await send(writer, ADD[kind], input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New ${kindWord(index.meta, kind)} under ${parent}`} title={`Add an ${kindWord(index.meta, kind)}`} submit={submit} saveLabel={`Add ${kindWord(index.meta, kind)}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/**
 * Add an integration to a product (from the product's page): the aggregate's own Add, its ID the next free one. An
 * integration has no owner: its product follows from its ID, so the input names no parent.
 */
export function AddIntegrationForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextIntegrationId('integration', parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, parent, 'integration', true);
  const submit = async () => {
    const input = addInput(index, specs, draft, {});
    const answer = await send(writer, '/api/integration/add-integration', input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New integration under ${parent}`} title="Add an integration" submit={submit} saveLabel="Add integration" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
