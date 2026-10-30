import type { ProductTraces } from '../../../lathe/src/traceability/trace/read-model';
import { LIST_TRACES } from '../../../lathe/src/traceability/trace/queries';
import { answerQuery } from '../../../lathe/src/platform/commands/run';
import { readViewOf, recordIndexOf, type ServedData } from '../read-view';
import type { RecordIndex } from '../../src/exploring/record-summaries/record-index';

// The Trace read's answer for the served data, as the test server answers GET /api/trace/list-traces: what the Trace
// stage's logic (chain.ts, tree.ts) reads chains, gaps, proof-only and untraced from.

const known = new WeakMap<ServedData, Map<string, ProductTraces>>();

/** The product's traces over the data (one answer per data and product, as the stage keeps one per read). */
export function tracesOf(data: ServedData, product: string): ProductTraces {
  let answers = known.get(data);
  if (!answers) { answers = new Map(); known.set(data, answers); }
  let answer = answers.get(product);
  if (!answer) {
    answer = answerQuery(readViewOf(data), LIST_TRACES, { product_id: product }) as ProductTraces;
    answers.set(product, answer);
  }
  return answer;
}

/** The product's space index and its traces over the data, as the Trace stage reads them; by default the data's first product. */
export function traced(data: ServedData, product?: string): { index: RecordIndex; traces: ProductTraces } {
  const index = recordIndexOf(data, product);
  return { index, traces: tracesOf(data, index.product) };
}
