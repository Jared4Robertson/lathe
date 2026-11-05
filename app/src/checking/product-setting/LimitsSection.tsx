import { Refusal, problemText } from '../../edit/fields';
import { Facts } from '../../record/page-parts';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { Section } from '../../specs/parts';
import { LimitsEditor } from './LimitsEditor';
import { useLimits } from './reads';
import type { Limits } from '../../../../lathe/src/checking/product-setting/read-model';

// The Product page's Limits (LA-CHK-A2's section of LA-V51, /<id>): the product's limits and whether its check is
// strict, read through the Product setting aggregate's own query (GET /api/product-setting/get-limits), its own or the
// defaults, and Set limits, which changes the limits only through the aggregate's own command (LimitsEditor).

/** Whether the product's check is strict, in words: the accepted warnings are a recorded deviation, shown as one. */
export function strictnessText(limits: Pick<Limits, 'strictCheck' | 'acceptedWarnings'>): string {
  if (!limits.strictCheck) return 'Not strict: warnings never fail it';
  if (!limits.acceptedWarnings) return 'Strict: warnings fail';
  return `Strict: warnings fail, beyond ${limits.acceptedWarnings} accepted (a recorded deviation)`;
}

/** A product's limits: the most children of one kind a record should hold and the most entities an aggregate should hold, and whether its check is strict. */
export function LimitsSection({ index, product }: { index: RecordIndex; product: string }) {
  const read = useLimits(product, index);
  return (
    <Section title="Limits" className="product-limits">
      {read.state === 'refused' ? (
        <Refusal title={`The limits of ${product} could not be read.`} reasons={read.problems.length ? read.problems.map(problemText) : [read.error]} focusKey={0} />
      ) : read.state !== 'read' || read.answer.product !== product ? (
        <p className="hint" role="status">Reading the limits…</p>
      ) : (
        <LimitsEditor index={index} limits={read.answer}>
          <p className="hint">{read.answer.own ? 'Set for this product. ' : 'The defaults: this product has not set its own. '}The checks warn of a record with more children of one kind, and of an aggregate with more entities. A strict check fails on any warning beyond those it accepts.</p>
          <Facts facts={[
            { label: 'Children of one kind', value: read.answer.maxChildren },
            { label: 'Entities per aggregate', value: read.answer.maxEntitiesPerAggregate },
            { label: 'Check', value: strictnessText(read.answer) },
          ]} />
        </LimitsEditor>
      )}
    </Section>
  );
}
