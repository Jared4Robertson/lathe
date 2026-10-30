import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { TablePage } from '../../../../lathe/src/authoring/table/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import { IdField, type Choice } from '../../edit/fields';
import { useWriter } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { sendTable, type TableCommands } from './commands';
import { useNextTableId } from './reads';
import '../../edit/edit.css';

// The Table editor (LA-AUT-A18): the actions on a table, each sending one of the aggregate's own commands,
// POST /api/table/<command>, and nothing else. Edit sends Change a table with only what changed (its keys as the whole
// list); Move sends Move a table, to another entity, read model or domain of its product; Remove says it goes with its
// keys and the links it starts and sends Remove a table. A table is added from the page of what it stores
// (AddTableForm). A refusal shows every reason the command gave, keeps what was entered, and changes nothing.

/** The columns of a key the form takes, in the command's order. */
const KEY_COLUMNS = ['type', 'columns', 'name', 'invariant_id', 'target_table_id', 'condition'];

/** The parent column of a table for each kind it sits under. */
const PARENT_COLUMN: Record<string, 'entity_id' | 'read_model_id' | 'domain_id'> = { entity: 'entity_id', read_model: 'read_model_id', domain: 'domain_id' };

/** The records of the product of these kinds, as choices. */
const choices = (index: RecordIndex, product: string, kinds: readonly string[]): Choice[] =>
  [...index.byId.values()].filter((r) => kinds.includes(r.kind) && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields Add and Change take (Change leaves out the ID), in their input's order. */
function fieldsOf(index: RecordIndex, product: string, adding: boolean): FieldSpec[] {
  return [
    ...(adding ? [{ field: 'id', column: 'id', table: 'table' }] : []),
    { field: 'title', column: 'title', table: 'table' },
    { field: 'name', column: 'name', table: 'table' },
    { field: 'storage', column: 'storage', table: 'table' },
    { field: 'file', column: 'file', table: 'table' },
    { field: 'keys', label: 'Keys', description: 'Its keys and indexes, in order. The list replaces its keys.', table: 'table_key', columns: KEY_COLUMNS },
    { field: 'meets', label: 'Meets', description: 'The standard rules it meets.', many: choices(index, product, ['standard_rule']) },
    { field: 'packages', label: 'Packages', description: 'The packages it uses.', texts: true },
  ];
}

/** The table's current values, by its input's field names. */
const currentOf = (page: TablePage): Record<string, unknown> => ({
  ...page.table,
  keys: page.keys,
  meets: page.meets,
  packages: page.packages,
});

type Mode = 'view' | 'change' | 'move' | 'remove';

/** The table with its actions; a form or the remove question shows in place of its page. */
export function TableEditor({ index, page, children }: { index: RecordIndex; page: TablePage; children: ReactNode }) {
  const writer = useWriter();
  const announce = useAnnounce();
  const [mode, setMode] = useState<Mode>('view');
  const toolbar = useRef<HTMLDivElement>(null);
  const { table } = page;
  useEffect(() => { setMode('view'); }, [table.id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode('view');
    setTimeout(() => toolbar.current?.querySelector<HTMLElement>('button')?.focus(), 0);
  };
  const product = index.byId.get(table.id)?.product ?? '';
  if (mode === 'change') {
    const specs = fieldsOf(index, product, false);
    const current = currentOf(page);
    const submit = async (draft: Draft) => {
      const input = changeInput(index, specs, draft, current, { id: table.id }, ['file']);
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await sendTable(writer, '/api/table/change-table', input as unknown as TableCommands['/api/table/change-table']);
      if (answer.ok) { announce(`Saved ${table.id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} id={table.id} submit={submit} onDone={back} /></div>;
  }
  if (mode === 'move') return <div className="spec-body"><MoveForm index={index} page={page} product={product} onDone={back} /></div>;
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${table.id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode('change')}>Edit</Button>
        <Button onClick={() => setMode('move')}>Move</Button>
        <Button icon="trash" danger onClick={() => setMode('remove')} aria-expanded={mode === 'remove'}>Remove</Button>
      </div>
      {mode === 'remove' && (
        <RemoveQuestion index={index} id={table.id} label="table" goes={[]} then={addressOf(page.parent.id)} onCancel={back}
          remove={() => sendTable(writer, '/api/table/remove-table', { id: table.id })} />
      )}
      {children}
    </>
  );
}

/** Edit: the table's Change, with only what changed. */
function ChangeForm({ index, specs, current, id, submit, onDone }: {
  index: RecordIndex;
  specs: FieldSpec[];
  current: Record<string, unknown>;
  id: string;
  submit: (draft: Draft) => Promise<WriteAnswer | null>;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(specs, current));
  return (
    <CommandForm eyebrow="Table" title={`Edit ${id}`} submit={() => submit(draft)} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Move: the table to another entity, read model or domain of its product, as its own command. */
function MoveForm({ index, page, product, onDone }: { index: RecordIndex; page: TablePage; product: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const formId = useId();
  const [parent, setParent] = useState(page.parent.id);
  const submit = async () => {
    if (parent.trim() === page.parent.id) { announce('Nothing changed'); onDone(); return null; }
    // The picked record's kind names the one parent column the command takes; one of no such kind is sent as a
    // domain, and the command refuses it with its reason.
    const column = PARENT_COLUMN[index.byId.get(parent.trim())?.kind ?? ''] ?? 'domain_id';
    const answer = await sendTable(writer, '/api/table/move-table', { id: page.table.id, [column]: parent.trim() });
    if (answer.ok) { announce(`Moved ${page.table.id}`); onDone(); }
    return answer;
  };
  return (
    <CommandForm eyebrow="Table" title={`Move ${page.table.id}`} submit={submit} saveLabel="Move" onCancel={onDone}>
      {(first) => (
        <IdField id={`${formId}-parent`} label="Stores" required inputRef={first} choices={choices(index, product, ['entity', 'read_model', 'domain'])} value={parent} onChange={setParent}
          description="The entity or read model it now stores, or the domain whose own infrastructure it is; its keys move with it." />
      )}
    </CommandForm>
  );
}

/** Add a table under an entity, a read model or a domain (from its page): the aggregate's own Add, its ID the next free one. */
export function AddTableForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextTableId(parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, index.byId.get(parent)?.product ?? '', true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { [PARENT_COLUMN[index.byId.get(parent)?.kind ?? ''] ?? 'domain_id']: parent });
    const answer = await sendTable(writer, '/api/table/add-table', input as unknown as TableCommands['/api/table/add-table']);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New table under ${parent}`} title="Add a table" submit={submit} saveLabel="Add table" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
