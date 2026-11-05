// The Product setting read model (LA-CHK-RM11): a product's limits, technology words and strictness as its readers see
// them, its own or the defaults.
// Its projection builds its table from the rows; it shares no type with the aggregate.
import type { ReadView } from '../../platform/data/rules.ts';
import { strictnessOf } from './strictness.ts';

/** A product's limits. */
export interface Limits {
  product: string;
  maxChildren: number;
  maxEntitiesPerAggregate: number;
  /** The words, besides Lathe's own, that name technology in its essential records. */
  technologyWords: string[];
  /** Whether its check is strict: any warning beyond those it accepts fails it. */
  strictCheck: boolean;
  /** The warnings a strict check accepts, a recorded deviation; 0 for plain strict and for a check that is not strict. */
  acceptedWarnings: number;
  /** Whether the product set them, or takes the defaults. */
  own: boolean;
}

/** The read model's table, kept in memory: each product's limits, its own or the defaults, by product. */
export interface LimitsTable {
  limits: Map<string, Limits>;
}

/** The limits a product without a settings row takes. */
const DEFAULTS = { maxChildren: 15, maxEntitiesPerAggregate: 7, technologyWords: [] as string[], strictCheck: false, acceptedWarnings: 0 };

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function limitsTableFrom(view: ReadView): LimitsTable {
  const own = new Map(view.rows('product_setting').map((s) => [String(s.product_id), s]));
  const limits = new Map<string, Limits>();
  for (const p of view.rows('product')) {
    const product = String(p.id);
    const s = own.get(product);
    const { strict, accepted } = strictnessOf(s);
    limits.set(
      product,
      s
        ? { product, maxChildren: Number(s.max_children), maxEntitiesPerAggregate: Number(s.max_entities_per_aggregate), technologyWords: (s.technology_words as string[]).map(String), strictCheck: strict, acceptedWarnings: accepted, own: true }
        : { product, ...DEFAULTS, own: false },
    );
  }
  return { limits };
}
