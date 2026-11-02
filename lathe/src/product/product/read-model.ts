// The Product read model (LA-PRD-RM21): what the Product aggregate's queries answer with, shaped for their readers
// (the product's page with its open questions and interfaces, and the spaces the nav lists) and built from rows by its
// projection. It shares no types with the aggregate's model.
import { bySource } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { InterfaceRow, ProductKindFieldRow, ProductKindRow, ProductRelationRow, ProductRow, QuestionRow, RoleRow } from '../../platform/data/tables.ts';
import { byRecordId } from '../../platform/data/ids.ts';
import { domainOrder } from '../../platform/data/domain-order.ts';

/** A record the page names: its ID and title. */
export interface Named {
  id: string;
  title: string;
}

/** An open question with the records it is about. */
export type QuestionEntry = QuestionRow & { about: string[] };

/** A product kind the product declares, with its fields in order. */
export type KindEntry = ProductKindRow & { fields: ProductKindFieldRow[] };

/** A business outcome as the product's page shows it: its statement, measure and target, and the capabilities that serve it. */
export interface OutcomeCard extends Named {
  statement: string;
  measure: string;
  target: string;
  servedBy: string[];
}

/** Records grouped under one capability of the product. */
export interface ByCapability<T> {
  capability: Named;
  items: T[];
}

/** An interface with the roles that use it, the patterns it follows, the use cases it offers and the product's use cases it does not, each by capability. */
export type InterfaceEntry = InterfaceRow & { actors: string[]; patterns: string[]; offers: ByCapability<Named>[]; missing: ByCapability<Named>[] };

/** One product's page: its row and roles, outcomes and domains, declarations, open questions and interfaces. */
export interface ProductPage {
  product: ProductRow;
  roles: RoleRow[];
  /** Its business outcomes, by ID. */
  outcomes: OutcomeCard[];
  /** Its domains, by ID. */
  domains: Named[];
  kinds: KindEntry[];
  relations: ProductRelationRow[];
  /** Its open questions, under it or one of its domains, by ID. */
  questions: QuestionEntry[];
  /** Its interfaces, by ID. */
  interfaces: InterfaceEntry[];
}

/** A product as the nav's space rail lists it: its ID, title, and its icon and color when given. */
export interface ProductSummary extends Named {
  icon?: string;
  color?: string;
}

// Each product's page, from the rows.
function productPagesFrom(view: ReadView): ProductPage[] {
  const products = view.rows('product') as unknown as ProductRow[];
  const domains = view.rows('domain');
  const productOfDomain = new Map(domains.map((d) => [String(d.id), String(d.product_id)]));
  const domainRank = domainOrder(domains);
  const about = bySource(view.rows('about'));
  const serves = new Map<string, string[]>();
  for (const l of view.rows('serves')) serves.set(String(l.target_id), [...(serves.get(String(l.target_id)) ?? []), String(l.source_id)].sort());
  const fields = view.rows('product_kind_field') as unknown as ProductKindFieldRow[];
  const capabilities = view.rows('capability');
  const useCases = view.rows('use_case');
  const offers = new Set(view.rows('offers').map((l) => `${String(l.source_id)} ${String(l.target_id)}`));
  const follows = bySource(view.rows('follows'));
  const actors = view.rows('interface_actor');
  return products.map((product) => {
    const own = (r: Row) => r.product_id === product.id;
    // The product's capabilities by domain, then place, each with its use cases by ID.
    const ownDomains = new Set(domains.filter(own).map((d) => String(d.id)));
    const ownCapabilities = capabilities
      .filter((c) => ownDomains.has(String(c.domain_id)))
      .sort((a, b) => domainRank.get(String(a.domain_id))! - domainRank.get(String(b.domain_id))! || Number(a.position) - Number(b.position))
      .map((c) => ({
        capability: { id: String(c.id), title: String(c.title) },
        useCases: useCases.filter((u) => u.capability_id === c.id).map((u) => ({ id: String(u.id), title: String(u.title) })).sort(byRecordId),
      }));
    const interfaceOf = (iface: InterfaceRow): InterfaceEntry => {
      const offered = (useCase: Named) => offers.has(`${iface.id} ${useCase.id}`);
      return {
        ...iface,
        actors: actors.filter((a) => a.interface_id === iface.id).sort((a, b) => Number(a.position) - Number(b.position)).map((a) => String(a.role_name)),
        patterns: [...(follows.get(iface.id) ?? [])].sort(),
        offers: ownCapabilities.map(({ capability, useCases: list }) => ({ capability, items: list.filter(offered) })).filter((g) => g.items.length > 0),
        missing: ownCapabilities.map(({ capability, useCases: list }) => ({ capability, items: list.filter((u) => !offered(u)) })).filter((g) => g.items.length > 0),
      };
    };
    return {
      product,
      roles: (view.rows('role') as unknown as RoleRow[]).filter((r) => r.product_id === product.id),
      outcomes: view
        .rows('business_outcome')
        .filter(own)
        .map((o) => ({ id: String(o.id), title: String(o.title), statement: String(o.statement), measure: String(o.measure), target: String(o.target), servedBy: serves.get(String(o.id)) ?? [] }))
        .sort(byRecordId),
      domains: domains.filter(own).sort((a, b) => domainRank.get(String(a.id))! - domainRank.get(String(b.id))!).map((d) => ({ id: String(d.id), title: String(d.title) })),
      kinds: (view.rows('product_kind') as unknown as ProductKindRow[])
        .filter((k) => k.product_id === product.id)
        .map((k) => ({ ...k, fields: fields.filter((f) => f.kind === k.name).sort((a, b) => a.position - b.position) })),
      relations: (view.rows('product_relation') as unknown as ProductRelationRow[]).filter((r) => r.product_id === product.id),
      questions: (view.rows('question') as unknown as QuestionRow[])
        .filter((q) => (q.product_id ?? (q.domain_id === undefined ? undefined : productOfDomain.get(q.domain_id))) === product.id)
        .map((q) => ({ ...q, about: about.get(q.id) ?? [] }))
        .sort(byRecordId),
      interfaces: (view.rows('interface') as unknown as InterfaceRow[]).filter((i) => i.product_id === product.id).sort(byRecordId).map(interfaceOf),
    };
  });
}

// Every product as the nav's space rail shows it, by ID.
function productSummariesFrom(view: ReadView): ProductSummary[] {
  return (view.rows('product') as unknown as ProductRow[])
    .map((p) => ({ id: p.id, title: p.title, ...(p.icon !== undefined ? { icon: p.icon } : {}), ...(p.color !== undefined ? { color: p.color } : {}) }))
    .sort(byRecordId);
}

/** The read model's table: each product's page and summary, which product holds each record, and every record's kind. */
export interface ProductTable {
  pages: Map<string, ProductPage>;
  summaries: ProductSummary[];
  /** The product that holds each product, open question and interface, and declares each product kind (by name). */
  holding: Map<string, string>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/**
 * The projection: the read model's table, built from the rows on each read. It is the only code that reads the source
 * rows for the queries.
 */
export function productTableFrom(view: ReadView): ProductTable {
  const pages = new Map(productPagesFrom(view).map((p) => [p.product.id, p]));
  const holding = new Map<string, string>();
  for (const page of pages.values()) {
    holding.set(page.product.id, page.product.id);
    for (const q of page.questions) holding.set(q.id, page.product.id);
    for (const i of page.interfaces) holding.set(i.id, page.product.id);
    for (const k of page.kinds) holding.set(k.name, page.product.id);
  }
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { pages, summaries: productSummariesFrom(view), holding, kinds };
}
