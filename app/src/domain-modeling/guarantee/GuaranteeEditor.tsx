import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GuaranteeKind } from '../../../../lathe/src/domain-modeling/guarantee/model';
import type { GuaranteePage } from '../../../../lathe/src/domain-modeling/guarantee/read-model';
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
import { GUARANTEE_FIELDS } from './fields.generated';
import { useNextGuaranteeId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';
import { kindWord } from '../../product/meta-model/reads';

// The Guarantee editor (LA-MOD-A24): the actions on a guarantee or one of its tests, each sending one of the
// aggregate's own commands, POST /api/guarantee/<command>, and nothing else. Edit sends its kind's Change with only
// what changed; Add opens an empty form for a guarantee test, with the next free ID read from the aggregate (next-id),
// and sends its Add; Remove says what goes with the record and sends its Remove. The aggregate has no Move. A guarantee
// is added from its platform domain's page (AddGuaranteeForm). A refusal shows every reason the command gave, in its
// own words, keeps what was entered, and changes nothing.

/** The records of the product of the kinds, as choices. */
const choices = (index: RecordIndex, product: string, kinds: (kind: string) => boolean): Choice[] =>
  [...index.byId.values()].filter((r) => kinds(r.kind) && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** Whether a kind's records may keep a guarantee: the technical records and data stores, a building block's kinds. */
const buildingBlock = (index: RecordIndex) => (kind: string) => index.meta.kinds.get(kind)?.stage === 'technical-specification' && kind !== 'standard' && kind !== 'standard_rule';

/** The fields each kind's Add and Change take, from their inputs; the hints add long text and the choices. */
function fieldsOf(index: RecordIndex, product: string, kind: GuaranteeKind, adding: boolean): FieldSpec[] {
  const F = GUARANTEE_FIELDS;
  switch (kind) {
    case 'guarantee': {
      // Its domain is the page it is added from.
      const hints = { statement: LONG, kept_by: { label: 'Kept by', choices: choices(index, product, buildingBlock(index)) } };
      return adding ? formFields(F['/api/guarantee/add-guarantee'], ['domain_id'], hints) : formFields(F['/api/guarantee/change-guarantee'], ['id'], hints);
    }
    case 'guarantee_test':
      return addOrChangeFields(adding, F['/api/guarantee/add-guarantee-test'], 'guarantee_id', F['/api/guarantee/change-guarantee-test'], {
        when: LONG, then: LONG, manual_reason: LONG, notes: LONG, starts_from: { choices: choices(index, product, (k) => k === 'test_data_set') },
      });
  }
}

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(page: GuaranteePage, kind: GuaranteeKind, id: string): Record<string, unknown> {
  if (kind === 'guarantee') return { ...page.guarantee, kept_by: page.keptBy };
  const { test, startsFrom } = page.tests.find((t) => t.test.id === id)!;
  return { ...test, starts_from: startsFrom };
}

/** Each kind's Change command. */
const CHANGE: Record<GuaranteeKind, CommandRoute> = {
  guarantee: '/api/guarantee/change-guarantee',
  guarantee_test: '/api/guarantee/change-guarantee-test',
};

/** Each kind's Remove command. */
const REMOVE: Record<GuaranteeKind, CommandRoute> = {
  guarantee: '/api/guarantee/remove-guarantee',
  guarantee_test: '/api/guarantee/remove-guarantee-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: CommandRoute, input: Record<string, unknown>): Promise<WriteAnswer> => writer.command(route, input as unknown as CommandInputs[typeof route]);

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add' } | { mode: 'remove' };

/** A record of the guarantee with its actions; a form or the remove question shows in place of its page. */
export function GuaranteeEditor({ index, page, children }: { index: RecordIndex; page: GuaranteePage; children: ReactNode }) {
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
  const product = index.byId.get(page.guarantee.id)?.product ?? '';
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
  if (mode.mode === 'add') return <div className="spec-body"><AddTestForm index={index} product={product} parent={id} onDone={back} /></div>;
  // A guarantee holds any number of tests; a test holds nothing.
  const adds = kind === 'guarantee' ? ['guarantee_test'] : [];
  const goes = kind === 'guarantee' ? page.tests.map((t) => t.test.id) : [];
  const then = kind === 'guarantee' ? page.guarantee.domain_id : page.guarantee.id;
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        <AddMenu id={id} choices={adds.map((k) => ({ key: k, label: kindLabel(index, k) }))} onPick={() => setMode({ mode: 'add' })} />
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={kindWord(index.meta, kind)} goes={goes} then={addressOf(then)} onCancel={back}
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

/** Add: an empty form for a guarantee test under the guarantee, its ID the next free one, sent as Add a guarantee test. */
function AddTestForm({ index, product, parent, onDone }: { index: RecordIndex; product: string; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextGuaranteeId('guarantee_test', parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, product, 'guarantee_test', true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { guarantee_id: parent });
    const answer = await send(writer, '/api/guarantee/add-guarantee-test', input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New ${kindWord(index.meta, 'guarantee_test')} under ${parent}`} title={`Add a ${kindWord(index.meta, 'guarantee_test')}`} submit={submit} saveLabel={`Add ${kindWord(index.meta, 'guarantee_test')}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a guarantee to a platform domain (from the domain's page): the aggregate's own Add, its ID the next free one. */
export function AddGuaranteeForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextGuaranteeId('guarantee', parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, index.byId.get(parent)?.product ?? '', 'guarantee', true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { domain_id: parent });
    const answer = await send(writer, '/api/guarantee/add-guarantee', input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New guarantee in ${parent}`} title="Add a guarantee" submit={submit} saveLabel="Add guarantee" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
