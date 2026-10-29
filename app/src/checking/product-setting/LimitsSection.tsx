import { Refusal, problemText } from '../../edit/fields';
import { Facts } from '../../record/page-parts';
import type { SpecIndex } from '../../specs/data';
import { Section } from '../../specs/parts';
import { LimitsEditor } from './LimitsEditor';
import { useLimits } from './reads';

// The Product page's Limits (LA-CHK-A2's section of LA-V51, /<id>): the product's limits read through the Product
// setting aggregate's own query (GET /api/product-setting/get-limits), its own or the defaults, and Set limits, which
// changes them only through the aggregate's own command (LimitsEditor).

/** A product's limits: the most children of one kind a record should hold and the most entities an aggregate should hold. */
export function LimitsSection({ index, product }: { index: SpecIndex; product: string }) {
  const read = useLimits(product, index);
  return (
    <Section title="Limits" className="product-limits">
      {read.state === 'refused' ? (
        <Refusal title={`The limits of ${product} could not be read.`} reasons={read.problems.length ? read.problems.map(problemText) : [read.error]} focusKey={0} />
      ) : read.state !== 'read' || read.answer.product !== product ? (
        <p className="hint" role="status">Reading the limits…</p>
      ) : (
        <LimitsEditor index={index} limits={read.answer}>
          <p className="hint">{read.answer.own ? 'Set for this product. ' : 'The defaults: this product has not set its own. '}The checks warn of a record with more children of one kind, and of an aggregate with more entities.</p>
          <Facts facts={[
            { label: 'Children of one kind', value: read.answer.maxChildren },
            { label: 'Entities per aggregate', value: read.answer.maxEntitiesPerAggregate },
          ]} />
        </LimitsEditor>
      )}
    </Section>
  );
}
