// The Essential review read (LA-CHK-RM12): a product's essential records alone, grouped by domain, answered from the
// read model through its reader (reader.ts), for a reviewer who reads them with fresh eyes and asks of each whether
// someone who knows the domain but not software would recognize and care about it. Its handler never sees the data
// and changes nothing. This slice holds only the read, so it names its read model where an aggregate's slice names
// its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { EssentialReview } from './read-model.ts';
import { essentialReviewReader, type EssentialReviewReader } from './reader.ts';
import { LIST_ESSENTIAL_RECORDS_IDENTITY } from './queries.generated.ts';

/** The product's essential records by domain. */
export function listEssentialRecords(reader: EssentialReviewReader, input: { product_id: string }): EssentialReview {
  const review = reader.reviewOf(input.product_id);
  if (!review) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return review;
}

/** List a product's essential records (LA-CHK-QRY13). */
export const LIST_ESSENTIAL_RECORDS: QueryDefinition<{ product_id: string }, EssentialReview, EssentialReviewReader> = {
  ...LIST_ESSENTIAL_RECORDS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: essentialReviewReader,
  run: listEssentialRecords,
  text: (r) =>
    [
      `${r.product}: ${r.count} essential record${r.count === 1 ? '' : 's'}. Would someone who knows this domain but not software recognize and care about each?`,
      ...r.domains.flatMap((d) => [
        `  ${d.title}${d.domain ? ` (${d.domain})` : ''}`,
        ...d.records.map((x) => `    ${x.id} ${x.label} "${x.title}"${x.lead ? `: ${x.lead}` : ''}`),
      ]),
    ].join('\n'),
};
