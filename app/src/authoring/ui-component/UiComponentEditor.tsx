import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { UiComponentPage } from '../../../../lathe/src/authoring/ui-component/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { sendUiComponent, type UiComponentCommands } from './commands';
import { useNextUiComponentId } from './reads';
import '../../edit/edit.css';

// The UI component editor (LA-AUT-A15): the actions on a UI component, each sending one of the aggregate's own
// commands, POST /api/ui-component/<command>, and nothing else. Edit sends Change a UI component with only what
// changed (each list whole); Remove says it goes with the links it starts and its packages and sends Remove a UI
// component. A UI component is added from its product's page (AddUiComponentForm), its ID the next free one. The
// aggregate has no Move. A refusal shows every reason the command gave, keeps what was entered, and changes nothing.

/** The records of a kind in the product, as what a list may name. */
const choicesOf = (index: RecordIndex, product: string, kind: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === kind && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields Add and Change take (Change leaves out the ID), in their input's order; packages are one per line. */
function fieldsOf(index: RecordIndex, product: string, adding: boolean): FieldSpec[] {
  return [
    ...(adding ? [{ field: 'id', column: 'id', table: 'ui_component' }] : []),
    { field: 'title', column: 'title', table: 'ui_component' },
    { field: 'file', column: 'file', table: 'ui_component' },
    { field: 'description', column: 'description', table: 'ui_component', long: true },
    { field: 'renders', label: 'Renders', description: 'The views it renders, or part of.', many: choicesOf(index, product, 'view') },
    { field: 'builds', label: 'Builds', description: 'The view requirements its code builds.', many: choicesOf(index, product, 'view_requirement') },
    { field: 'meets', label: 'Meets', description: 'The standard rules it meets.', many: choicesOf(index, product, 'standard_rule') },
    { field: 'packages', column: 'package', table: 'package_use', label: 'packages', long: true, required: false },
  ];
}

/** The packages field's text as its list: one package per line. */
const packagesOf = (draft: Draft) => (draft.text.packages ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const withoutPackages = (specs: FieldSpec[]) => specs.filter((s) => s.field !== 'packages');

type Mode = 'view' | 'change' | 'remove';

/** The UI component with its actions; the form or the remove question shows in place of its page. */
export function UiComponentEditor({ index, page, children }: { index: RecordIndex; page: UiComponentPage; children: ReactNode }) {
  const writer = useWriter();
  const [mode, setMode] = useState<Mode>('view');
  const toolbar = useRef<HTMLDivElement>(null);
  const announce = useAnnounce();
  const { id } = page.record;
  useEffect(() => { setMode('view'); }, [id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode('view');
    setTimeout(() => toolbar.current?.querySelector<HTMLElement>('button')?.focus(), 0);
  };
  const product = index.byId.get(id)?.product ?? '';
  if (mode === 'change') {
    const specs = fieldsOf(index, product, false);
    const current = { ...page.component, renders: page.renders, builds: page.builds, meets: page.meets, packages: page.packages } as Record<string, unknown>;
    const submit = async (draft: Draft) => {
      const input = changeInput(index, withoutPackages(specs), draft, current, { id }, ['file']);
      const packages = packagesOf(draft);
      if (JSON.stringify([...packages].sort()) !== JSON.stringify(page.packages)) input.packages = packages;
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await sendUiComponent(writer, '/api/ui-component/change-ui-component', input as unknown as UiComponentCommands['/api/ui-component/change-ui-component']);
      if (answer.ok) { announce(`Saved ${id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} id={id} submit={submit} onDone={back} /></div>;
  }
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode('change')}>Edit</Button>
        <Button icon="trash" danger onClick={() => setMode('remove')} aria-expanded={mode === 'remove'}>Remove</Button>
      </div>
      {mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label="UI component" goes={[]} then={addressOf(product)} onCancel={back}
          remove={() => sendUiComponent(writer, '/api/ui-component/remove-ui-component', { id })} />
      )}
      {children}
    </>
  );
}

/** Edit: the UI component's Change, with only what changed. */
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
    <CommandForm eyebrow="UI component" title={`Edit ${id}`} submit={() => submit(draft)} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add a UI component to a product (from the product's page): the aggregate's own Add, its ID the next free one. */
export function AddUiComponentForm({ index, parent, onDone }: { index: RecordIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextUiComponentId(parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, parent, true);
  const submit = async () => {
    const input = addInput(index, withoutPackages(specs), draft, {});
    const packages = packagesOf(draft);
    if (packages.length > 0) input.packages = packages;
    const answer = await sendUiComponent(writer, '/api/ui-component/add-ui-component', input as unknown as UiComponentCommands['/api/ui-component/add-ui-component']);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New UI component under ${parent}`} title="Add a UI component" submit={submit} saveLabel="Add UI component" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
