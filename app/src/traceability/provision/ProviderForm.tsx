import { useState } from 'react';
import { addInput, CommandForm, emptyDraft, Fields, formFields, type Draft } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter } from '../../edit/write';
import { useAnnounce } from '../../shell/commands';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { PROVISION_FIELDS } from './fields.generated';

// The Provision aggregate's form (LA-TRC-A5): names what provides a record from outside the product, sending Name a
// provider (POST /api/provision/name-provider) and nothing else; the record's page offers it, and Remove provider beside
// it. A refusal shows every reason the command gave, keeps what was entered, and changes nothing.

/** The integrations of the product, as what may provide the record. */
const integrations = (index: RecordIndex, product: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === 'integration' && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** Name a provider for the record: an integration of its product, in place of any it had. */
export function NameProviderForm({ index, record, onDone }: { index: RecordIndex; record: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const product = index.byId.get(record)?.product ?? '';
  const specs = formFields(PROVISION_FIELDS['/api/provision/name-provider'], ['record_id'], { provider_id: { label: 'Provider', choices: integrations(index, product) } });
  const submit = async () => {
    const input = addInput(index, specs, draft, { record_id: record });
    const answer = await writer.command('/api/provision/name-provider', input as { record_id: string; provider_id: string });
    if (answer.ok) { announce(`Named the provider of ${record}`); onDone(); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`Provider of ${record}`} title="Name a provider" submit={submit} saveLabel="Name provider" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
