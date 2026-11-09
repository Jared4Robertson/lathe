import { useRef, useState, type ReactNode } from 'react';
import type { Limits } from '../../../../lathe/src/checking/product-setting/read-model';
import { Button } from '../../components/Button';
import { addInput, CommandForm, draftOf, Fields, formFields, type Draft, type FieldSpec } from '../../edit/command-form';
import { useWriter, type CommandInputs } from '../../edit/write';
import { PRODUCT_SETTING_FIELDS } from './fields.generated';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import '../../edit/edit.css';
import { backToActions } from '../../edit/back-to-actions';

// The Limits editor (LA-CHK-A2): Set limits, the Product setting aggregate's one command, POST
// /api/product-setting/set-limits, and nothing else. The form starts at the limits the product has now (its own or the
// defaults) and sends both; the first time it adds the product's settings row. A refusal shows every reason the
// command gave, in its own words, keeps what was entered, and changes nothing.

/** Set limits' fields, from its input (the product is sent by the form itself). */
const FIELDS: FieldSpec[] = formFields(PRODUCT_SETTING_FIELDS['/api/product-setting/set-limits'], ['product_id'], {
  max_children: { label: 'Children limit' },
  max_entities_per_aggregate: { label: 'Entities limit' },
});

/** The product's limits with Set limits; the form shows in their place while it is open. */
export function LimitsEditor({ index, limits, children }: { index: RecordIndex; limits: Limits; children: ReactNode }) {
  const writer = useWriter();
  const [open, setOpen] = useState(false);
  const toolbar = useRef<HTMLDivElement>(null);
  if (!writer) return <>{children}</>;
  const back = () => {
    setOpen(false);
    backToActions(`Change the limits of ${limits.product}`, toolbar);
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
    const answer = await writer.command('/api/product-setting/set-limits', input as unknown as CommandInputs['/api/product-setting/set-limits']);
    if (answer.ok) { announce(`Set the limits of ${limits.product}`); onDone(); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`Limits of ${limits.product}`} title="Set limits" submit={submit} saveLabel="Set limits" onCancel={onDone}>
      {(first) => <Fields index={index} specs={FIELDS} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
