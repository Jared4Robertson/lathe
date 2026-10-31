import type { ProductTrace } from '../../../lathe/src/traceability/trace/read-model';
import { LIST_TRACE_ROWS } from '../../../lathe/src/traceability/trace/queries';
import { answerQuery } from '../../../lathe/src/platform/commands/run';
import { readViewOf, recordIndexOf, type ServedData } from '../read-view';
import type { RecordIndex } from '../../src/exploring/record-summaries/record-index';
import { traceGraph, type TraceGraph } from '../../src/trace/trace';

// The Trace read's answer for the served data, as the test server answers GET /api/trace/list-trace-rows, and the
// Trace stage's graph over it: what the stage's pure logic (trace.ts, layout.ts, walk.ts) reads.

/** The product's space index, its trace rows and the stage's graph over the data; by default the data's first product. */
export function traced(data: ServedData, product?: string): { index: RecordIndex; trace: ProductTrace; graph: TraceGraph } {
  const index = recordIndexOf(data, product);
  const trace = answerQuery(readViewOf(data), LIST_TRACE_ROWS, { product_id: index.product }) as ProductTrace;
  return { index, trace, graph: traceGraph(index, trace) };
}
