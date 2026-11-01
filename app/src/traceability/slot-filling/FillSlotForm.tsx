import { useState } from 'react';
import { addInput, CommandForm, emptyDraft, Fields, formFields, type Draft } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter } from '../../edit/write';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { SLOT_FILLING_FIELDS } from './fields.generated';

// The Slot filling aggregate's form (LA-TRC-A4): records that a technical record, written by hand, fills a slot,
// sending Fill a slot (POST /api/slot-filling/fill-slot) and nothing else; the slot's page offers it. A refusal (such as
// a record a tooling record generates) shows every reason the command gave, keeps what was entered, and changes nothing.

/** The kinds of the technical specification, whose records may fill a slot. */
const TECHNICAL = 'technical-specification';

/** The technical records of the product, as what may fill the slot. */
const technicalRecords = (index: RecordIndex, product: string): Choice[] => {
  const technical = new Set([...index.meta.kinds.values()].filter((k) => k.stage === TECHNICAL).map((k) => k.kind));
  return [...index.byId.values()].filter((r) => technical.has(r.kind) && r.product === product).map((r) => ({ id: r.id, title: r.title }));
};

/** Fill the slot with a hand-written technical record of its product. */
export function FillSlotForm({ index, slot, onDone }: { index: RecordIndex; slot: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const product = index.byId.get(slot)?.product ?? '';
  const specs = formFields(SLOT_FILLING_FIELDS['/api/slot-filling/fill-slot'], ['slot_id'], { record_id: { label: 'Record', choices: technicalRecords(index, product) } });
  const submit = async () => {
    const input = addInput(index, specs, draft, { slot_id: slot });
    const answer = await writer.command('/api/slot-filling/fill-slot', input as { record_id: string; slot_id: string });
    if (answer.ok) { announce(`${String(input.record_id)} fills ${slot}`); onDone(); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`Fill ${slot}`} title="Fill a slot" submit={submit} saveLabel="Fill slot" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
