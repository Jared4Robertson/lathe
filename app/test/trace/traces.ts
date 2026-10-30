import type { ProductTraces } from '../../../lathe/src/traceability/trace/read-model';
import { LIST_TRACES } from '../../../lathe/src/traceability/trace/queries';
import { answerQuery } from '../../../lathe/src/platform/commands/run';
import type { SpecIndex } from '../../src/specs/data';
import { readViewOf } from '../read-view';

// The Trace read's answer for an index's data, as the test server answers GET /api/trace/list-traces: what the Trace
// stage's logic (chain.ts, tree.ts) reads chains, gaps, proof-only and untraced from.

const known = new WeakMap<SpecIndex, Map<string, ProductTraces>>();

/** The product's traces over the index's data (one answer per index and product, as the stage keeps one per read). */
export function tracesOf(index: SpecIndex, product: string): ProductTraces {
  let answers = known.get(index);
  if (!answers) { answers = new Map(); known.set(index, answers); }
  let answer = answers.get(product);
  if (!answer) {
    const { schema, sources, problems, exceptions, coverage, chains } = index.workspace;
    answer = answerQuery(readViewOf({ schema, sources, placements: {}, problems, exceptions, coverage, chains }), LIST_TRACES, { product_id: product }) as ProductTraces;
    answers.set(product, answer);
  }
  return answer;
}
