// The Product aggregate (LA-AUT-A1): a product with its roles, the kinds (with their fields) and relations it declares
// as its own, its open questions (under the product or one of its domains, with what each is about) and its
// interfaces. One instance is one product, whole; nothing in it belongs to another aggregate, and it holds only the
// links its own records start.
import type { Transaction } from '../../platform/data/transaction.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { InterfaceRow, ProductKindFieldRow, ProductKindRow, ProductRelationRow, ProductRow, QuestionRow, RoleRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const PRODUCT_AGGREGATE = 'LA-AUT-A1';

/** A role as a command gives it: its name and description; the product fills the rest. */
export type RoleInput = Omit<RoleRow, 'product_id'>;

/** A product kind field as a command gives it: in order, so its position is its place in the list. */
export type FieldInput = Omit<ProductKindFieldRow, 'kind' | 'position'>;

/** A product kind with its fields, in order. */
export interface ProductKind {
  row: ProductKindRow;
  fields: ProductKindFieldRow[];
}

/** An open question with the records it is about. */
export interface Question {
  row: QuestionRow;
  about: string[];
}

/** One product, whole. */
export interface Product {
  /** The product's ID: the aggregate's root. */
  readonly root: string;
  product: ProductRow;
  roles: RoleRow[];
  kinds: ProductKind[];
  relations: ProductRelationRow[];
  questions: Question[];
  interfaces: InterfaceRow[];
}

/** The tables the Product aggregate keeps its rows in: its kinds, declarations, parts, and the relation its questions start. */
export const PRODUCT_TABLES = ['product', 'role', 'product_kind', 'product_kind_field', 'product_relation', 'question', 'about', 'interface'] as const;

/** A new product, with nothing under it yet but its roles. */
export function newProduct(product: ProductRow, roles: RoleInput[]): Product {
  return { root: product.id, product, roles: rolesOf(product.id, roles), kinds: [], relations: [], questions: [], interfaces: [] };
}

/** The roles as rows of the product. */
export const rolesOf = (product: string, roles: RoleInput[]): RoleRow[] => roles.map((r) => ({ product_id: product, ...r }));

/** The fields as rows of the kind, numbered by their order. */
export const fieldsOf = (kind: string, fields: FieldInput[]): ProductKindFieldRow[] => fields.map((f, at) => ({ kind, position: at + 1, ...f }));

/** A relation's key: its name and the pair of kinds it links. */
export const relationKey = (r: Pick<ProductRelationRow, 'name' | 'source_kind' | 'target_kind'>): string => `${r.name} ${r.source_kind} -> ${r.target_kind}`;

/**
 * The products in the data, each whole, built from the aggregate's tables; only the one given, when given. A
 * question under a domain is its domain's product's: `productOfDomain` reads that from the domain, which is not one of
 * the aggregate's records.
 */
export function productsFrom(rows: (table: string) => Row[], productOfDomain: (domain: string) => string | undefined, only?: string): Product[] {
  const products = rows('product').filter((r) => only === undefined || r.id === only) as unknown as ProductRow[];
  if (!products.length) return [];
  const roles = rows('role') as unknown as RoleRow[];
  const kinds = rows('product_kind') as unknown as ProductKindRow[];
  const fields = rows('product_kind_field') as unknown as ProductKindFieldRow[];
  const relations = rows('product_relation') as unknown as ProductRelationRow[];
  const questions = rows('question') as unknown as QuestionRow[];
  const interfaces = rows('interface') as unknown as InterfaceRow[];
  const about = bySource(rows('about'));
  const fieldsOf = groupBy(fields, (f) => f.kind);
  return products.map((product) => {
    const own = (r: { product_id?: string }) => r.product_id === product.id;
    return {
      root: product.id,
      product,
      roles: roles.filter(own),
      kinds: kinds.filter(own).map((row) => ({ row, fields: [...groupOf(fieldsOf, row.name)].sort((a, b) => a.position - b.position) })),
      relations: relations.filter(own),
      questions: questions
        .filter((q) => (q.product_id ?? (q.domain_id === undefined ? undefined : productOfDomain(q.domain_id))) === product.id)
        .map((row) => ({ row, about: groupOf(about, row.id) })),
      interfaces: interfaces.filter(own),
    };
  });
}

const asRow = <T extends object>(row: T) => row as unknown as Row;

/** The instance's rows, by table. */
export function productRows(product: Product): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['product', [asRow(product.product)]],
    ['role', product.roles.map(asRow)],
    ['product_kind', product.kinds.map((k) => asRow(k.row))],
    ['product_kind_field', product.kinds.flatMap((k) => k.fields.map(asRow))],
    ['product_relation', product.relations.map(asRow)],
    ['question', product.questions.map((q) => asRow(q.row))],
    ['about', product.questions.flatMap((q) => q.about.map((target) => ({ source_id: q.row.id, target_id: target })))],
    ['interface', product.interfaces.map(asRow)],
  ]);
}

/**
 * The product a question sits in, from where it is put: its product, or one of the product's domains (read, never
 * loaded: a domain is Domain's record). Refused unless exactly one is given and it exists.
 */
export function productUnder(tx: Transaction, at: { product_id?: string; domain_id?: string }): string {
  if ((at.product_id === undefined) === (at.domain_id === undefined)) tx.refuse('parent', 'an open question sits under its product or one of its domains: give exactly one of product_id and domain_id');
  if (at.product_id !== undefined) return at.product_id;
  const domain = tx.record(at.domain_id!);
  if (domain?.kind !== 'domain') tx.refuse('missing', `there is no domain ${at.domain_id}`);
  return String(domain!.row.product_id);
}
