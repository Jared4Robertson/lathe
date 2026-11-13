import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AggregateKind } from '../../../../lathe/src/domain-modeling/aggregate/model';
import type { AggregatePage } from '../../../../lathe/src/domain-modeling/aggregate/read-model';
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
import { AGGREGATE_FIELDS } from './fields.generated';
import { useNextAggregateId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { kindWord, addedUnder } from '../../platform/meta-model/reads';

// The Aggregate editor (LA-MOD-A6): the actions on a record of an aggregate, each sending one of the aggregate's own
// commands, POST /api/aggregate/<command>, and nothing else. Edit sends its kind's Change with only what changed (an
// entity's fields as a list of rows, the entities it holds as lists of IDs); Add opens an empty form for a kind that
// sits under the record in the aggregate (an entity or invariant under the aggregate, an entity's one data model, an
// invariant's one rule and one test), with the next free ID read from the aggregate (next-id), and sends its Add; Remove says what
// goes with the record and sends its Remove. The aggregate has no Move. Another aggregate's root that sits under an
// aggregate or an entity (a domain event, a command) is added through that aggregate's own Add form, from the Record
// page's list (adderOf). An aggregate is added from its domain's page (AddAggregateForm). A refusal shows every reason
// the command gave, in its own words, keeps what was entered, and changes nothing.

type Inside = Exclude<AggregateKind, 'aggregate'>;

/** The kinds a record of another kind has under it inside the aggregate; the meta model says which sit under which. */
const INSIDE: readonly Inside[] = ['entity', 'invariant', 'data_model', 'rule', 'invariant_test'];

/** The product's records of these kinds, as choices. */
function choices(index: RecordIndex, product: string, kinds: readonly string[]): Choice[] {
  return [...index.byId.values()].filter((r) => kinds.includes(r.kind) && r.product === product).map((r) => ({ id: r.id, title: r.title }));
}

/** The fields each kind's Add and Change take, from their inputs; the hints add labels, long text and the choices. */
function fieldsOf(index: RecordIndex, page: AggregatePage | null, product: string, kind: AggregateKind, adding: boolean, self?: string): FieldSpec[] {
  const F = AGGREGATE_FIELDS;
  const meets = { choices: choices(index, product, ['standard_rule']) };
  switch (kind) {
    case 'aggregate':
      return addOrChangeFields(adding, F['/api/aggregate/add-aggregate'], 'domain_id', F['/api/aggregate/change-aggregate'], { description: LONG, identity: LONG, notes: LONG, serves: { choices: choices(index, product, ['business_outcome']) } });
    case 'entity': {
      // The entities it may hold: the others of its own aggregate.
      const siblings: Choice[] = (page?.entities ?? []).filter((e) => e.entity.id !== self).map((e) => ({ id: e.entity.id, title: e.entity.title }));
      return addOrChangeFields(adding, F['/api/aggregate/add-entity'], 'aggregate_id', F['/api/aggregate/change-entity'], { description: LONG, has_one: { choices: siblings }, has_many: { choices: siblings } });
    }
    case 'invariant':
      return addOrChangeFields(adding, F['/api/aggregate/add-invariant'], 'aggregate_id', F['/api/aggregate/change-invariant'], { statement: LONG });
    case 'data_model':
      return addOrChangeFields(adding, F['/api/aggregate/add-data-model'], 'entity_id', F['/api/aggregate/change-data-model'], { meets });
    case 'rule':
      return addOrChangeFields(adding, F['/api/aggregate/add-rule'], 'invariant_id', F['/api/aggregate/change-rule'], { meets });
    case 'invariant_test':
      return addOrChangeFields(adding, F['/api/aggregate/add-invariant-test'], 'invariant_id', F['/api/aggregate/change-invariant-test'], {
        when: LONG, then: LONG, manual_reason: LONG, notes: LONG, starts_from: { choices: choices(index, product, ['test_data_set']) },
      });
  }
}

/** The record's current values, by its input's field names: its row's columns, its parts and the links it starts. */
function currentOf(page: AggregatePage, kind: AggregateKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'aggregate':
      return { ...page.aggregate, serves: page.serves };
    case 'entity': {
      const e = page.entities.find((x) => x.entity.id === id)!;
      return { ...e.entity, fields: e.fields, has_one: e.hasOne, has_many: e.hasMany };
    }
    case 'invariant':
      return { ...page.invariants.find((i) => i.invariant.id === id)!.invariant };
    case 'data_model': {
      const d = page.entities.find((e) => e.dataModel?.dataModel.id === id)!.dataModel!;
      return { ...d.dataModel, meets: d.meets, packages: d.packages, helpers: d.helpers };
    }
    case 'rule': {
      const r = page.invariants.find((i) => i.rule?.rule.id === id)!.rule!;
      return { ...r.rule, meets: r.meets, packages: r.packages, helpers: r.helpers };
    }
    case 'invariant_test': {
      const t = page.invariants.find((i) => i.test?.test.id === id)!.test!;
      return { ...t.test, starts_from: t.startsFrom };
    }
  }
}

/** Each kind's Change command. */
const CHANGE: Record<AggregateKind, CommandRoute> = {
  aggregate: '/api/aggregate/change-aggregate',
  entity: '/api/aggregate/change-entity',
  invariant: '/api/aggregate/change-invariant',
  data_model: '/api/aggregate/change-data-model',
  rule: '/api/aggregate/change-rule',
  invariant_test: '/api/aggregate/change-invariant-test',
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<AggregateKind, { route: CommandRoute; parent: string }> = {
  aggregate: { route: '/api/aggregate/add-aggregate', parent: 'domain_id' },
  entity: { route: '/api/aggregate/add-entity', parent: 'aggregate_id' },
  invariant: { route: '/api/aggregate/add-invariant', parent: 'aggregate_id' },
  data_model: { route: '/api/aggregate/add-data-model', parent: 'entity_id' },
  rule: { route: '/api/aggregate/add-rule', parent: 'invariant_id' },
  invariant_test: { route: '/api/aggregate/add-invariant-test', parent: 'invariant_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<AggregateKind, CommandRoute> = {
  aggregate: '/api/aggregate/remove-aggregate',
  entity: '/api/aggregate/remove-entity',
  invariant: '/api/aggregate/remove-invariant',
  data_model: '/api/aggregate/remove-data-model',
  rule: '/api/aggregate/remove-rule',
  invariant_test: '/api/aggregate/remove-invariant-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: CommandRoute, input: Record<string, unknown>): Promise<WriteAnswer> => writer.command(route, input as unknown as CommandInputs[typeof route]);

/** What goes with a record when it is removed, inside the aggregate: what sits under it. */
function goesWith(page: AggregatePage, kind: AggregateKind, id: string): string[] {
  const ofEntity = (e: AggregatePage['entities'][number]) => (e.dataModel ? [e.dataModel.dataModel.id] : []);
  const ofInvariant = (i: AggregatePage['invariants'][number]) => [...(i.rule ? [i.rule.rule.id] : []), ...(i.test ? [i.test.test.id] : [])];
  if (kind === 'aggregate') return [...page.entities.flatMap((e) => [e.entity.id, ...ofEntity(e)]), ...page.invariants.flatMap((i) => [i.invariant.id, ...ofInvariant(i)])];
  if (kind === 'entity') return ofEntity(page.entities.find((e) => e.entity.id === id)!);
  if (kind === 'invariant') return ofInvariant(page.invariants.find((i) => i.invariant.id === id)!);
  return [];
}

/** The record a removed one's page gives way to: what it sits under. */
function parentOf(page: AggregatePage, kind: AggregateKind, id: string): string {
  switch (kind) {
    case 'aggregate': return page.aggregate.domain_id;
    case 'data_model': return page.entities.find((e) => e.dataModel?.dataModel.id === id)!.entity.id;
    case 'rule': return page.invariants.find((i) => i.rule?.rule.id === id)!.invariant.id;
    case 'invariant_test': return page.invariants.find((i) => i.test?.test.id === id)!.invariant.id;
    default: return page.aggregate.id;
  }
}


type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Inside } | { mode: 'adopt'; kind: string } | { mode: 'remove' };

/** A record of the aggregate with its actions; a form or the remove question shows in place of its page. */
export function AggregateEditor({ index, page, children }: { index: RecordIndex; page: AggregatePage; children: ReactNode }) {
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
  const product = index.byId.get(page.aggregate.id)?.product ?? '';
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, page, product, kind, false, id);
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
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} page={page} product={product} kind={mode.kind} parent={id} onDone={back} /></div>;
  if (mode.mode === 'adopt') {
    const Adder = adderOf(index.meta, mode.kind)!;
    return <div className="spec-body"><Adder index={index} parent={id} onDone={back} /></div>;
  }
  // An entity has one data model and an invariant one rule and one test: once it has it, there is nothing more to add of that kind.
  const adds = addedUnder(index.meta, kind, INSIDE).filter((k) =>
    (k !== 'data_model' || !page.entities.find((e) => e.entity.id === id)?.dataModel)
    && (k !== 'rule' || !page.invariants.find((i) => i.invariant.id === id)?.rule)
    && (k !== 'invariant_test' || !page.invariants.find((i) => i.invariant.id === id)?.test));
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

/** Add: an empty form for a kind of the aggregate (under the record, or an aggregate under its domain), its ID the next free one under its parent, sent as that kind's Add. */
function AddForm({ index, page, product, kind, parent, onDone }: { index: RecordIndex; page: AggregatePage | null; product: string; kind: AggregateKind; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextAggregateId(kind, parent, index);
  // A first entity is the root.
  const text: Record<string, string> = kind === 'entity' && page && page.entities.length === 0 ? { role: 'root' } : {};
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), text }));
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, page, product, kind, true);
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

/** Add an aggregate to a domain (from the domain's page): the aggregate's own Add, with the next free ID in the domain. */
export function AddAggregateForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  return <AddForm index={index} page={null} product={index.byId.get(parent)?.product ?? ''} kind="aggregate" parent={parent} onDone={onDone} />;
}
