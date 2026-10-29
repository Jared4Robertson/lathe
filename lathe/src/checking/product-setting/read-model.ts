// The Product setting read model (LA-CHK-RM11): a product's limits as its readers see them, its own or the defaults.
// Its projection builds them from the rows; it shares no type with the aggregate.
import type { Row } from '../../platform/data/rows.ts';

/** A product's limits. */
export interface Limits {
  product: string;
  maxChildren: number;
  maxEntitiesPerAggregate: number;
  /** Whether the product set them, or takes the defaults. */
  own: boolean;
}

/** The limits a product without a settings row takes. */
const DEFAULTS = { maxChildren: 15, maxEntitiesPerAggregate: 7 };

/** The product's limits, from the rows (the projection, LA-CHK-RM11-PJ). */
export function limitsFrom(rows: (table: string) => Row[], productId: string): Limits {
  const own = rows('product_setting').find((s) => s.product_id === productId);
  return own
    ? { product: productId, maxChildren: Number(own.max_children), maxEntitiesPerAggregate: Number(own.max_entities_per_aggregate), own: true }
    : { product: productId, ...DEFAULTS, own: false };
}
