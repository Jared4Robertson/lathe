// The Delivery read model's reader (LA-TRC-RM13-RD): the one way the Delivery query reaches the read model's storage.
// The query handler depends only on the DeliveryReader interface; the query runner injects the reader the query's
// definition makes (`reader`), over the data with the checks' run, so keeping the read model elsewhere is a new
// implementation of this interface and nothing more. Today's implementation reads the projection's table, kept in
// memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { deliveryTableFrom, type DeliveryTable, type ProductDelivery } from './read-model.ts';

/** What the Delivery query reads, and all it reads. */
export interface DeliveryReader {
  /** The product's Delivery, or undefined when there is no such product. */
  deliveryOf(product: string): ProductDelivery | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryDeliveryReader implements DeliveryReader {
  private readonly table: DeliveryTable;

  constructor(table: DeliveryTable) {
    this.table = table;
  }

  deliveryOf(product: string): ProductDelivery | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the Delivery query: today's, over the projection's table built from the rows and the checks' run. */
export const deliveryReader = (view: ReadView): DeliveryReader => new InMemoryDeliveryReader(deliveryTableFrom(view));
