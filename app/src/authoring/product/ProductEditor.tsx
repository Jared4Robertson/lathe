import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { KindEntry, ProductPage } from '../../../../lathe/src/authoring/product/read-model';
import type { ProductRelationRow } from '../../../../lathe/src/platform/data/tables';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import { IdField, Refusal, problemText, type Choice } from '../../edit/fields';
import { useWriter, type Writer } from '../../edit/write';
import { AddUnder, othersAddedUnder } from '../../record/pages';
import { AddMenu } from '../../edit/AddMenu';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { addressOf } from '../../views/address';
import { sendProduct, type ProductCommands, type ProductRoute } from './commands';
import { useNextProductId } from './reads';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';

// The Product editor (LA-AUT-A1): the actions on a product, an open question or an interface, each sending one of the
// aggregate's own commands, POST /api/product/<command>, and nothing else. On the product: Edit sends Change a product
// (its columns and its roles) with only what changed; Add opens an open question's or an interface's Add with the next
// free ID read from the aggregate (next-id), Declare opens a product kind's or a product relation's declaration, and any
// other record under the product (a business outcome, a domain, a view…) is added through its own aggregate's Add form; each declared kind and relation has its own Change and
// Remove. On an open question: Edit, Move (to the product or one of its domains, the aggregate's one Move) and Remove;
// on an interface: Edit and Remove. A product has no Remove. A refusal shows every reason the command gave, keeps what
// was entered, and changes nothing.

/** The kinds of the aggregate's records with a page. */
export type ProductRecordKind = 'product' | 'question' | 'interface';

/** The kind of the record with this ID in the product's page, or undefined. */
export function kindInProduct(page: ProductPage, id: string): ProductRecordKind | undefined {
  if (page.product.id === id) return 'product';
  if (page.questions.some((q) => q.id === id)) return 'question';
  if (page.interfaces.some((i) => i.id === id)) return 'interface';
  return undefined;
}

/** A relation's key: its name and the pair of kinds it links. */
const relationKey = (r: Pick<ProductRelationRow, 'name' | 'source_kind' | 'target_kind'>) => ({ name: r.name, source_kind: r.source_kind, target_kind: r.target_kind });
const relationName = (r: Pick<ProductRelationRow, 'name' | 'source_kind' | 'target_kind'>) => `${r.name} (${r.source_kind} → ${r.target_kind})`;

type Mode =
  | { mode: 'view' }
  | { mode: 'change' }
  | { mode: 'add'; kind: string }
  | { mode: 'declare-kind' }
  | { mode: 'declare-relation' }
  | { mode: 'change-kind'; name: string }
  | { mode: 'change-relation'; relation: ProductRelationRow }
  | { mode: 'move' }
  | { mode: 'remove' }
  | { mode: 'remove-kind'; name: string }
  | { mode: 'remove-relation'; relation: ProductRelationRow };

/** What the page's declarations offer when the editor is on: Change and Remove for each declared kind and relation. */
export interface DeclarationActions {
  changeKind: (name: string) => void;
  removeKind: (name: string) => void;
  changeRelation: (relation: ProductRelationRow) => void;
  removeRelation: (relation: ProductRelationRow) => void;
}

/** Sends a command whose input a form has built to its route's shape. */
const send = (writer: Writer, route: ProductRoute, input: Record<string, unknown>) => sendProduct(writer, route, input as unknown as ProductCommands[typeof route]);

// ---------- Fields ----------

/** The records of the product, as what an open question may be about. */
const productRecords = (index: RecordIndex, product: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.product === product && r.id !== product).map((r) => ({ id: r.id, title: r.title }));

const PRODUCT_FIELDS: FieldSpec[] = [
  { field: 'title', column: 'title', table: 'product' },
  { field: 'description', column: 'description', table: 'product', long: true },
  { field: 'icon', column: 'icon', table: 'product' },
  { field: 'color', column: 'color', table: 'product' },
  { field: 'notes', column: 'notes', table: 'product', long: true },
  { field: 'roles', label: 'Roles', description: 'The roles people and agents take in the product, each with what they do. The list replaces the roles.', table: 'role', columns: ['name', 'description'] },
];

const questionFields = (index: RecordIndex, product: string, adding: boolean): FieldSpec[] => [
  ...(adding ? [{ field: 'id', column: 'id', table: 'question' }] : []),
  { field: 'title', column: 'title', table: 'question' },
  { field: 'owner', column: 'owner', table: 'question' },
  { field: 'description', column: 'description', table: 'question', long: true },
  { field: 'about', label: 'About', description: 'The records of the product it is about.', many: productRecords(index, product) },
];

const interfaceFields = (adding: boolean): FieldSpec[] => [
  ...(adding ? [{ field: 'id', column: 'id', table: 'interface' }] : []),
  { field: 'title', column: 'title', table: 'interface' },
  { field: 'kind', column: 'kind', table: 'interface' },
  { field: 'description', column: 'description', table: 'interface', long: true },
];

const kindFields = (adding: boolean): FieldSpec[] => [
  ...(adding ? [{ field: 'name', column: 'name', table: 'product_kind' }] : []),
  { field: 'label', column: 'label', table: 'product_kind' },
  { field: 'description', column: 'description', table: 'product_kind', long: true },
  { field: 'parent_kind', column: 'parent_kind', table: 'product_kind' },
  { field: 'stage', column: 'stage', table: 'product_kind' },
  { field: 'obligation', column: 'obligation', table: 'product_kind' },
  { field: 'id_pattern', column: 'id_pattern', table: 'product_kind' },
  { field: 'id_example', column: 'id_example', table: 'product_kind' },
  { field: 'title_form', column: 'title_form', table: 'product_kind' },
  { field: 'fields', label: 'Fields', description: 'The kind\'s own columns, in order. The list replaces its fields.', table: 'product_kind_field', columns: ['name', 'type', 'required', 'description'] },
];

const relationFields = (adding: boolean): FieldSpec[] => [
  ...(adding ? [
    { field: 'name', column: 'name', table: 'product_relation' },
    { field: 'source_kind', column: 'source_kind', table: 'product_relation' },
    { field: 'target_kind', column: 'target_kind', table: 'product_relation' },
  ] : []),
  { field: 'role', column: 'role', table: 'product_relation' },
  { field: 'forward_label', column: 'forward_label', table: 'product_relation' },
  { field: 'reverse_label', column: 'reverse_label', table: 'product_relation' },
  { field: 'description', column: 'description', table: 'product_relation', long: true },
];

// ---------- The editor ----------

/** What a product's Add… offers, in reading order: its own open questions and interfaces, and every other aggregate's root added under it. */
function addedUnderProduct(index: RecordIndex): string[] {
  const kinds = new Set([...othersAddedUnder(index.meta, 'product'), 'question', 'interface']);
  return index.meta.kindList.map((k) => k.kind).filter((k) => kinds.has(k));
}

/** A record of the product with its actions; a form or a remove question shows in place of its page. */
export function ProductEditor({ index, page, id, kind, children }: {
  index: RecordIndex;
  page: ProductPage;
  id: string;
  kind: ProductRecordKind;
  children: (actions: DeclarationActions | null) => ReactNode;
}) {
  const writer = useWriter();
  const [mode, setMode] = useState<Mode>({ mode: 'view' });
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => { setMode({ mode: 'view' }); }, [id]);
  if (!writer) return <>{children(null)}</>;
  const back = () => {
    setMode({ mode: 'view' });
    backToActions(`Change ${id}`, toolbar);
  };
  const product = page.product.id;
  const context = { index, page, writer, onDone: back };
  const form = (() => {
    switch (mode.mode) {
      case 'change': return <ChangeForm context={context} id={id} kind={kind} />;
      case 'add':
        // An open question and an interface are the Product aggregate's own; any other record under the product is
        // added through its own aggregate's Add form.
        if (mode.kind === 'question' || mode.kind === 'interface') return <AddForm context={context} kind={mode.kind} />;
        return <AddUnder index={index} parent={product} kind={mode.kind} onDone={back} />;
      case 'declare-kind': return <KindForm context={context} kind={null} />;
      case 'change-kind': return <KindForm context={context} kind={page.kinds.find((k) => k.name === mode.name) ?? null} />;
      case 'declare-relation': return <RelationForm context={context} relation={null} />;
      case 'change-relation': return <RelationForm context={context} relation={mode.relation} />;
      case 'move': return <MoveForm context={context} id={id} />;
      default: return null;
    }
  })();
  if (form) return <div className="spec-body">{form}</div>;
  const actions: DeclarationActions = {
    changeKind: (name) => setMode({ mode: 'change-kind', name }),
    removeKind: (name) => setMode({ mode: 'remove-kind', name }),
    changeRelation: (relation) => setMode({ mode: 'change-relation', relation }),
    removeRelation: (relation) => setMode({ mode: 'remove-relation', relation }),
  };
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        {kind === 'question' && <Button onClick={() => setMode({ mode: 'move' })}>Move</Button>}
        {kind === 'product' && (
          <>
            <AddMenu id={id} choices={addedUnderProduct(index).map((k) => ({ key: k, label: kindLabel(index, k) }))}
              onPick={(k) => setMode({ mode: 'add', kind: k })} />
            <AddMenu id={id} title="Declare…" group="Declarations to add to" choices={[{ key: 'declare-kind', label: 'Product kind' }, { key: 'declare-relation', label: 'Product relation' }]}
              onPick={(k) => setMode({ mode: k as 'declare-kind' | 'declare-relation' })} />
          </>
        )}
        {kind !== 'product' && <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>}
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={kind === 'question' ? 'open question' : 'interface'} goes={[]} onCancel={back}
          then={addressOf(kind === 'question' ? page.questions.find((q) => q.id === id)?.domain_id ?? product : product)}
          remove={() => sendProduct(writer, kind === 'question' ? '/api/product/remove-question' : '/api/product/remove-interface', { id })} />
      )}
      {mode.mode === 'remove-kind' && (
        <RemoveDeclaration title={`Remove the product kind ${mode.name}?`} what={`the product kind ${mode.name} with its fields`} onCancel={back}
          remove={() => sendProduct(writer, '/api/product/remove-product-kind', { name: mode.name })} />
      )}
      {mode.mode === 'remove-relation' && (
        <RemoveDeclaration title={`Remove the product relation ${relationName(mode.relation)}?`} what={`the product relation ${relationName(mode.relation)}`} onCancel={back}
          remove={() => sendProduct(writer, '/api/product/remove-product-relation', relationKey(mode.relation))} />
      )}
      {children(actions)}
    </>
  );
}

interface FormContext {
  index: RecordIndex;
  page: ProductPage;
  writer: Writer;
  onDone: () => void;
}

/** A form over a draft of the given fields. */
function DraftForm({ index, specs, initial, eyebrow, title, saveLabel, submit, onDone, update }: {
  index: RecordIndex;
  specs: FieldSpec[];
  initial: Draft;
  eyebrow: string;
  title: string;
  saveLabel: string;
  submit: (draft: Draft) => Promise<WriteAnswer | null>;
  onDone: () => void;
  /** Fills fields the draft is missing once known, such as the next free ID. */
  update?: (draft: Draft) => Draft;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  useEffect(() => { if (update) setDraft((d) => update(d)); }, [update]);
  return (
    <CommandForm eyebrow={eyebrow} title={title} submit={() => submit(draft)} saveLabel={saveLabel} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Edit: the record's Change, with only what changed. */
function ChangeForm({ context, id, kind }: { context: FormContext; id: string; kind: ProductRecordKind }) {
  const { index, page, writer, onDone } = context;
  const announce = useAnnounce();
  const { specs, current, route, clearable, label } = (() => {
    switch (kind) {
      case 'product':
        return { specs: PRODUCT_FIELDS, current: { ...page.product, roles: page.roles } as Record<string, unknown>, route: '/api/product/change-product' as const, clearable: ['icon', 'color', 'notes'], label: 'Product' };
      case 'question':
        return { specs: questionFields(index, page.product.id, false), current: page.questions.find((q) => q.id === id)! as unknown as Record<string, unknown>, route: '/api/product/change-question' as const, clearable: [], label: 'Open question' };
      case 'interface':
        return { specs: interfaceFields(false), current: page.interfaces.find((i) => i.id === id)! as unknown as Record<string, unknown>, route: '/api/product/change-interface' as const, clearable: [], label: 'Interface' };
    }
  })();
  const submit = async (draft: Draft) => {
    const input = changeInput(index, specs, draft, current, { id }, clearable);
    if (Object.keys(input).length === 1) { announce('Nothing changed'); onDone(); return null; }
    const answer = await send(writer, route, input);
    if (answer.ok) { announce(`Saved ${id}`); onDone(); }
    return answer;
  };
  return <DraftForm index={index} specs={specs} initial={draftOf(specs, current)} eyebrow={label} title={`Edit ${id}`} saveLabel="Save" submit={submit} onDone={onDone} />;
}

/** Add: an open question or an interface under the product, its ID the next free one, sent as that kind's Add. */
function AddForm({ context, kind }: { context: FormContext; kind: 'question' | 'interface' }) {
  const { index, page, writer, onDone } = context;
  const announce = useAnnounce();
  const product = page.product.id;
  const next = useNextProductId(kind, product, index);
  const specs = kind === 'question' ? questionFields(index, product, true) : interfaceFields(true);
  const label = kind === 'question' ? 'open question' : 'interface';
  const suggested = next.state === 'read' ? next.answer : null;
  const [update, setUpdate] = useState<((d: Draft) => Draft) | undefined>(undefined);
  useEffect(() => {
    if (suggested) setUpdate(() => (d: Draft) => (d.text.id ? d : { ...d, text: { ...d.text, id: suggested } }));
  }, [suggested]);
  const submit = async (draft: Draft) => {
    const input = addInput(index, specs, draft, { product_id: product });
    const answer = await send(writer, kind === 'question' ? '/api/product/add-question' : '/api/product/add-interface', input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <DraftForm index={index} specs={specs} initial={emptyDraft()} update={update} eyebrow={`New ${label} under ${product}`} title={`Add ${kind === 'question' ? 'an open question' : 'an interface'}`}
      saveLabel={`Add ${label}`} submit={submit} onDone={onDone} />
  );
}

/** Declare or change a product kind with its fields: Declare a product kind, or Change a product kind with only what changed. */
function KindForm({ context, kind }: { context: FormContext; kind: KindEntry | null }) {
  const { index, page, writer, onDone } = context;
  const announce = useAnnounce();
  const specs = kindFields(kind === null);
  const current = kind ? ({ ...kind, fields: kind.fields } as unknown as Record<string, unknown>) : {};
  const submit = async (draft: Draft) => {
    if (kind === null) {
      const input = addInput(index, specs, draft, { product_id: page.product.id });
      if (input.obligation === undefined) input.obligation = false;
      const answer = await send(writer, '/api/product/declare-product-kind', input);
      if (answer.ok) { announce(`Declared ${String(input.name)}`); onDone(); }
      return answer;
    }
    const input = changeInput(index, specs, draft, current, { name: kind.name }, ['stage', 'id_pattern', 'id_example', 'title_form']);
    if (Object.keys(input).length === 1) { announce('Nothing changed'); onDone(); return null; }
    const answer = await send(writer, '/api/product/change-product-kind', input);
    if (answer.ok) { announce(`Saved ${kind.name}`); onDone(); }
    return answer;
  };
  const initial = kind ? draftOf(specs, current) : { ...emptyDraft(), text: { obligation: 'false' } };
  return (
    <DraftForm index={index} specs={specs} initial={initial} eyebrow={kind ? 'Product kind' : `New product kind of ${page.product.id}`}
      title={kind ? `Change the product kind ${kind.name}` : 'Declare a product kind'} saveLabel={kind ? 'Save' : 'Declare product kind'} submit={submit} onDone={onDone} />
  );
}

/** Declare or change a product relation: Declare a product relation, or Change a product relation with only what changed. */
function RelationForm({ context, relation }: { context: FormContext; relation: ProductRelationRow | null }) {
  const { index, page, writer, onDone } = context;
  const announce = useAnnounce();
  const specs = relationFields(relation === null);
  const current = (relation ?? {}) as Record<string, unknown>;
  const submit = async (draft: Draft) => {
    if (relation === null) {
      const input = addInput(index, specs, draft, { product_id: page.product.id });
      const answer = await send(writer, '/api/product/declare-product-relation', input);
      if (answer.ok) { announce(`Declared ${String(input.name)}`); onDone(); }
      return answer;
    }
    const input = changeInput(index, specs, draft, current, relationKey(relation), ['role']);
    if (Object.keys(input).length === 3) { announce('Nothing changed'); onDone(); return null; }
    const answer = await send(writer, '/api/product/change-product-relation', input);
    if (answer.ok) { announce(`Saved ${relation.name}`); onDone(); }
    return answer;
  };
  return (
    <DraftForm index={index} specs={specs} initial={relation ? draftOf(specs, current) : emptyDraft()} eyebrow={relation ? 'Product relation' : `New product relation of ${page.product.id}`}
      title={relation ? `Change the product relation ${relationName(relation)}` : 'Declare a product relation'} saveLabel={relation ? 'Save' : 'Declare product relation'} submit={submit} onDone={onDone} />
  );
}

/** Move: an open question to its product or one of the product's domains, as its own command. */
function MoveForm({ context, id }: { context: FormContext; id: string }) {
  const { page, writer, onDone } = context;
  const announce = useAnnounce();
  const question = page.questions.find((q) => q.id === id)!;
  const here = question.domain_id ?? question.product_id ?? page.product.id;
  const [under, setUnder] = useState(here);
  const choices: Choice[] = [{ id: page.product.id, title: page.product.title }, ...page.domains];
  const submit = async () => {
    if (under === here) { announce('Nothing changed'); onDone(); return null; }
    const answer = await sendProduct(writer, '/api/product/move-question', under === page.product.id ? { id, product_id: under } : { id, domain_id: under });
    if (answer.ok) { announce(`Moved ${id}`); onDone(); }
    return answer;
  };
  return (
    <CommandForm eyebrow="Open question" title={`Move ${id}`} submit={submit} saveLabel="Move" onCancel={onDone}>
      {(first) => (
        <IdField id={`move-${id}-under`} label="Under" required inputRef={first} choices={choices} value={under} onChange={setUnder}
          description="The product, or the domain of the product, the question sits under." />
      )}
    </CommandForm>
  );
}

/** Remove a declaration: asks first, sends its Remove, and shows the refusal in the question. */
function RemoveDeclaration({ title, what, remove, onCancel }: { title: string; what: string; remove: () => Promise<WriteAnswer>; onCancel: () => void }) {
  const announce = useAnnounce();
  const [refusal, setRefusal] = useState<string[] | null>(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const confirm = async () => {
    setBusy(true);
    const answer = await remove();
    setBusy(false);
    setTries((t) => t + 1);
    if (!answer.ok) { setRefusal(answer.problems.length ? answer.problems.map(problemText) : [answer.error]); return; }
    announce(`Removed ${what}`);
    onCancel();
  };
  return (
    <section className="remove-panel" aria-label={title}>
      <h2 tabIndex={-1} ref={heading}>{title}</h2>
      <p>This removes {what}. It is refused while any record is of the kind or links through the relation.</p>
      {refusal && <Refusal title="The removal was refused. Nothing was changed." reasons={refusal} focusKey={tries} />}
      <div className="record-form-actions">
        <Button danger onClick={confirm} disabled={busy}>{busy ? 'Removing…' : 'Remove'}</Button>
        <Button onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </section>
  );
}

/**
 * Add an open question under a domain of the product (from the domain's page): the Product aggregate's own Add a
 * question, its ID the next free one under the domain. Under the product itself it is added from the product's page.
 */
export function AddQuestionForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const under = index.byId.get(parent);
  const product = under?.kind === 'product' ? parent : under?.product ?? parent;
  const next = useNextProductId('question', parent, index);
  const specs = questionFields(index, product, true);
  const suggested = next.state === 'read' ? next.answer : null;
  const [update, setUpdate] = useState<((d: Draft) => Draft) | undefined>(undefined);
  useEffect(() => {
    if (suggested) setUpdate(() => (d: Draft) => (d.text.id ? d : { ...d, text: { ...d.text, id: suggested } }));
  }, [suggested]);
  const submit = async (draft: Draft) => {
    const input = addInput(index, specs, draft, under?.kind === 'product' ? { product_id: parent } : { domain_id: parent });
    const answer = await send(writer, '/api/product/add-question', input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <DraftForm index={index} specs={specs} initial={emptyDraft()} update={update} eyebrow={`New open question under ${parent}`} title="Add an open question"
      saveLabel="Add open question" submit={submit} onDone={onDone} />
  );
}
