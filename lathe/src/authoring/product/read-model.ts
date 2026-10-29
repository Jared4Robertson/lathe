// The Product read model (LA-AUT-RM21): what the Product aggregate's queries answer with, shaped for their readers
// (the product's page with its open questions and interfaces, and the spaces the nav lists) and built from rows by its
// projection. It shares no types with the aggregate's model.
import type { Row } from '../../platform/data/rows.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { InterfaceRow, ProductKindFieldRow, ProductKindRow, ProductRelationRow, ProductRow, QuestionRow, RoleRow } from '../../platform/data/tables.ts';

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

/** A flow through an interface, with the use case it carries out. */
export interface FlowThrough extends Named {
  useCase: Named;
}

/** An interface with the flows through it and the product's use cases with none, each by capability. */
export type InterfaceEntry = InterfaceRow & { flows: ByCapability<FlowThrough>[]; missing: ByCapability<Named>[] };

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

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true });

// A link table's targets by source, each list sorted.
function bySource(links: Row[]): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const l of links) found.set(String(l.source_id), [...(found.get(String(l.source_id)) ?? []), String(l.target_id)]);
  for (const list of found.values()) list.sort();
  return found;
}

/** The projection: each product's page, from the rows; only the one given, when given. */
export function productPagesFrom(view: ReadView, only?: string): ProductPage[] {
  const products = (view.rows('product') as unknown as ProductRow[]).filter((p) => only === undefined || p.id === only);
  if (!products.length) return [];
  const domains = view.rows('domain');
  const productOfDomain = new Map(domains.map((d) => [String(d.id), String(d.product_id)]));
  const about = bySource(view.rows('about'));
  const serves = new Map<string, string[]>();
  for (const l of view.rows('serves')) serves.set(String(l.target_id), [...(serves.get(String(l.target_id)) ?? []), String(l.source_id)].sort());
  const fields = view.rows('product_kind_field') as unknown as ProductKindFieldRow[];
  const capabilities = view.rows('capability');
  const useCases = view.rows('use_case');
  const flows = view.rows('flow');
  return products.map((product) => {
    const own = (r: Row) => r.product_id === product.id;
    // The product's capabilities by domain, then place, each with its use cases by ID.
    const ownDomains = new Set(domains.filter(own).map((d) => String(d.id)));
    const ownCapabilities = capabilities
      .filter((c) => ownDomains.has(String(c.domain_id)))
      .sort((a, b) => String(a.domain_id).localeCompare(String(b.domain_id)) || Number(a.position) - Number(b.position))
      .map((c) => ({
        capability: { id: String(c.id), title: String(c.title) },
        useCases: useCases.filter((u) => u.capability_id === c.id).map((u) => ({ id: String(u.id), title: String(u.title) })).sort(byId),
      }));
    const interfaceOf = (iface: InterfaceRow): InterfaceEntry => {
      const through = (useCase: Named) => flows.find((f) => f.use_case_id === useCase.id && f.interface_id === iface.id);
      return {
        ...iface,
        flows: ownCapabilities
          .map(({ capability, useCases: list }) => ({
            capability,
            items: list.flatMap((u) => {
              const flow = through(u);
              return flow ? [{ id: String(flow.id), title: String(flow.title), useCase: u }] : [];
            }),
          }))
          .filter((g) => g.items.length > 0),
        missing: ownCapabilities.map(({ capability, useCases: list }) => ({ capability, items: list.filter((u) => !through(u)) })).filter((g) => g.items.length > 0),
      };
    };
    return {
      product,
      roles: (view.rows('role') as unknown as RoleRow[]).filter((r) => r.product_id === product.id),
      outcomes: view
        .rows('business_outcome')
        .filter(own)
        .map((o) => ({ id: String(o.id), title: String(o.title), statement: String(o.statement), measure: String(o.measure), target: String(o.target), servedBy: serves.get(String(o.id)) ?? [] }))
        .sort(byId),
      domains: domains.filter(own).map((d) => ({ id: String(d.id), title: String(d.title) })).sort(byId),
      kinds: (view.rows('product_kind') as unknown as ProductKindRow[])
        .filter((k) => k.product_id === product.id)
        .map((k) => ({ ...k, fields: fields.filter((f) => f.kind === k.name).sort((a, b) => a.position - b.position) })),
      relations: (view.rows('product_relation') as unknown as ProductRelationRow[]).filter((r) => r.product_id === product.id),
      questions: (view.rows('question') as unknown as QuestionRow[])
        .filter((q) => (q.product_id ?? (q.domain_id === undefined ? undefined : productOfDomain.get(q.domain_id))) === product.id)
        .map((q) => ({ ...q, about: about.get(q.id) ?? [] }))
        .sort(byId),
      interfaces: (view.rows('interface') as unknown as InterfaceRow[]).filter((i) => i.product_id === product.id).sort(byId).map(interfaceOf),
    };
  });
}

/** The projection's list: every product as the nav's space rail shows it, by ID. */
export function productSummariesFrom(view: ReadView): ProductSummary[] {
  return (view.rows('product') as unknown as ProductRow[])
    .map((p) => ({ id: p.id, title: p.title, ...(p.icon !== undefined ? { icon: p.icon } : {}), ...(p.color !== undefined ? { color: p.color } : {}) }))
    .sort(byId);
}
