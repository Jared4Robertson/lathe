import type { ProductDelivery } from '../../../lathe/src/traceability/delivery/read-model';
import { LIST_DELIVERY } from '../../../lathe/src/traceability/delivery/queries';
import { answerQuery } from '../../../lathe/src/platform/commands/run';
import { readViewOf, recordIndexOf, type ServedData } from '../read-view';
import type { RecordIndex } from '../../src/exploring/record-summaries/record-index';
import { deliveryGraph, type DeliveryGraph } from '../../src/trace/delivery/delivery';

// The Delivery read's answer for the served data, as the test server answers GET /api/delivery/list-delivery, and the
// Delivery view's graph over it: what the view's pure logic (delivery.ts, delivery-layout.ts, delivery-walk.ts) reads.

/** The product's space index, its Delivery and the view's graph over the data; by default the data's first product. */
export function delivered(data: ServedData, product?: string): { index: RecordIndex; delivery: ProductDelivery; graph: DeliveryGraph } {
  const index = recordIndexOf(data, product);
  const delivery = answerQuery(readViewOf(data), LIST_DELIVERY, { product_id: index.product }) as ProductDelivery;
  return { index, delivery, graph: deliveryGraph(index, delivery) };
}
