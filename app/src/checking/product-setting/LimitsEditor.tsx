import { useRef, useState, type ReactNode } from 'react';
import type { Limits } from '../../../../lathe/src/checking/product-setting/read-model';
import { Button } from '../../components/Button';
import { addInput, CommandForm, draftOf, Fields, type Draft, type FieldSpec } from '../../edit/command-form';
import { useWriter } from '../../edit/write';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { sendProductSetting, type ProductSettingCommands } from './commands';
import '../../edit/edit.css';

// The Limits editor (LA-CHK-A2): Set limits, the Product setting aggregate's one command, POST
// /api/product-setting/set-limits, and nothing else. The form starts at the limits the product has now (its own or the
// defaults) and sends both; the first time it adds the product's settings row. A refusal shows every reason the
// command gave, in its own words, keeps what was entered, and changes nothing.

/** Set limits' fields, in its input's order. */
const FIELDS: FieldSpec[] = [
  { field: 'max_children', column: 'max_children', table: 'product_setting', label: 'Children of one kind' },
  { field: 'max_entities_per_aggregate', column: 'max_entities_per_aggregate', table: 'product_setting', label: 'Entities per aggregate' },
];

/** The product's limits with Set limits; the form shows in their place while it is open. */
export function LimitsEditor({ index, limits, children }: { index: RecordIndex; limits: Limits; children: ReactNode }) {
  const writer = useWriter();
  const [open, setOpen] = useState(false);
  const toolbar = useRef<HTMLDivElement>(null);
  if (!writer) return <>{children}</>;
  const back = () => {
    setOpen(false);
    setTimeout(() => toolbar.current?.querySelector<HTMLElement>('button')?.focus(), 0);
  };
  if (open) return <SetLimitsForm index={index} limits={limits} onDone={back} />;
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change the limits of ${limits.product}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setOpen(true)}>Set limits</Button>
      </div>
      {children}
    </>
  );
}

/** Set limits: both limits, starting at the product's current ones. */
function SetLimitsForm({ index, limits, onDone }: { index: RecordIndex; limits: Limits; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const [draft, setDraft] = useState<Draft>(() => draftOf(FIELDS, { max_children: limits.maxChildren, max_entities_per_aggregate: limits.maxEntitiesPerAggregate }));
  const submit = async () => {
    const input = addInput(index, FIELDS, draft, { product_id: limits.product });
    const answer = await sendProductSetting(writer, '/api/product-setting/set-limits', input as unknown as ProductSettingCommands['/api/product-setting/set-limits']);
    if (answer.ok) { announce(`Set the limits of ${limits.product}`); onDone(); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`Limits of ${limits.product}`} title="Set limits" submit={submit} saveLabel="Set limits" onCancel={onDone}>
      {(first) => <Fields index={index} specs={FIELDS} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
