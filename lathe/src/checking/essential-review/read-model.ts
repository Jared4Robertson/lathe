// The Essential review read model (LA-CHK-RM12): a product's essential records alone, grouped by domain, as a reviewer
// reads them with fresh eyes: no technical record, no code, and none of what decides or proves the means (a pattern,
// its rules and slots, a test). The records are the ones accidental-in-essential reads (essential.ts), so the review
// and the check never disagree on what is essential.
// Its projection builds its table from the rows; it shares no type with an aggregate.
import { placementOf, wordGroupOf } from '../../essential.ts';
import { isLeadColumn } from '../../lead.ts';
import { compareIds } from '../../platform/data/ids.ts';
import type { ReadView } from '../../platform/data/rules.ts';

/** One essential record, as a reviewer reads it: its kind, title and lead text. */
export interface EssentialRecord {
  id: string;
  kind: string;
  /** Its kind's label, such as Use case. */
  label: string;
  title: string;
  /** Its lead text (statement, goal, meaning or description); null for a kind with none. */
  lead: string | null;
}

/** A domain's essential records, or the product's records in no domain (domain null). */
export interface EssentialDomain {
  domain: string | null;
  title: string;
  records: EssentialRecord[];
}

/** A product's essential records by domain, in ID order, then those in no domain, with how many there are. */
export interface EssentialReview {
  product: string;
  count: number;
  domains: EssentialDomain[];
}

/** The read model's table, kept in memory: each product's review, by product. */
export interface EssentialReviewTable {
  reviews: Map<string, EssentialReview>;
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function essentialReviewTableFrom(view: ReadView): EssentialReviewTable {
  const placement = placementOf(view);
  const domainTitles = new Map(view.rows('domain').map((d) => [String(d.id), String(d.title)]));
  const byProduct = new Map<string, Map<string | null, EssentialRecord[]>>();
  for (const kind of Object.values(view.schema.kinds)) {
    if (!wordGroupOf(kind)) continue;
    const lead = view.schema.tables[kind.name].columns.find((c) => isLeadColumn(c.name))?.name;
    for (const row of view.rows(kind.name)) {
      const id = String(row.id);
      if (placement.complexityOf(id) !== 'essential') continue;
      const product = placement.productOf(id);
      if (product === null) continue;
      const domain = placement.domainOf(id) ?? null;
      const domains = byProduct.get(product) ?? new Map<string | null, EssentialRecord[]>();
      byProduct.set(product, domains);
      domains.set(domain, [...(domains.get(domain) ?? []), { id, kind: kind.name, label: kind.label, title: String(row.title), lead: lead && typeof row[lead] === 'string' ? String(row[lead]) : null }]);
    }
  }
  const reviews = new Map<string, EssentialReview>();
  for (const p of view.rows('product')) {
    const product = String(p.id);
    const domains = [...(byProduct.get(product) ?? new Map<string | null, EssentialRecord[]>())]
      .map(([domain, records]) => ({ domain, title: domain === null ? 'In no domain' : (domainTitles.get(domain) ?? domain), records: records.sort((a, b) => compareIds(a.id, b.id)) }))
      .sort((a, b) => (a.domain === null ? 1 : b.domain === null ? -1 : compareIds(a.domain, b.domain)));
    reviews.set(product, { product, count: domains.reduce((n, d) => n + d.records.length, 0), domains });
  }
  return { reviews };
}
