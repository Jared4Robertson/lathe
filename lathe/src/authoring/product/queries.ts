// The Product aggregate's own reads (read model LA-AUT-RM21): a product's page, every product as the nav lists it, the
// interfaces of a product, and the next free ID for an open question or an interface. Each reads only the read model,
// through its reader (reader.ts), and changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ProductPage, ProductSummary } from './read-model.ts';
import { productReader, type ProductReader } from './reader.ts';
import { GET_PRODUCT_IDENTITY, LIST_INTERFACES_IDENTITY, NEXT_PRODUCT_ID_IDENTITY, LIST_PRODUCTS_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The page of the product that holds the record: the product itself, an open question or interface in it, or a kind it declares. */
export function getProduct(reader: ProductReader, input: { id: string }): ProductPage {
  const product = reader.productHolding(input.id);
  if (product === undefined) {
    const kind = reader.kindOf(input.id);
    if (!kind) refuse('missing', `no record or product kind has the ID ${input.id}`);
    refuse('kind', `${input.id} is a ${kind}, not a product, an open question, an interface or a product kind`);
  }
  return reader.page(product!)!;
}

/** GET a product whole (LA-AUT-QRY110). */
export const GET_PRODUCT: QueryDefinition<{ id: string }, ProductPage, ProductReader> = {
  ...GET_PRODUCT_IDENTITY,
  input: { id: id('The product, an open question or interface in it, or a product kind it declares.', 'required') },
  reader: productReader,
  run: getProduct,
  text: productText,
};

/** Every product, as the nav's space rail lists it: its ID, title, icon and color, by ID. */
export function listProducts(reader: ProductReader): ProductSummary[] {
  return reader.products();
}

/** List the products (LA-AUT-QRY113). */
export const LIST_PRODUCTS: QueryDefinition<Record<string, never>, ProductSummary[], ProductReader> = {
  ...LIST_PRODUCTS_IDENTITY,
  input: {},
  reader: productReader,
  run: listProducts,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No products.'),
};

/** The interfaces of a product, by ID. */
export function listInterfaces(reader: ProductReader, input: { product_id: string }): { id: string; title: string; kind: string }[] {
  if (reader.kindOf(input.product_id) !== 'product') refuse('missing', `there is no product ${input.product_id}`);
  return reader.page(input.product_id)!.interfaces.map((i) => ({ id: i.id, title: i.title, kind: i.kind }));
}

/** List the interfaces of a product (LA-AUT-QRY111). */
export const LIST_INTERFACES: QueryDefinition<{ product_id: string }, { id: string; title: string; kind: string }[], ProductReader> = {
  ...LIST_INTERFACES_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: productReader,
  run: listInterfaces,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title} (${r.kind})`).join('\n') : 'No interfaces.'),
};

/**
 * The next free ID for an open question (under a product or a domain: its ID and Q) or an interface (under a product:
 * its ID and IF): one past the highest in use.
 */
export function nextProductId(reader: ProductReader, input: { kind: string; parent: string }): string {
  if (input.kind !== 'question' && input.kind !== 'interface') refuse('kind', `${input.kind} is not a kind of the Product aggregate with an ID under a parent; its kinds are question and interface`);
  const shape = reader.idShape(input.kind);
  const parent = reader.kindOf(input.parent);
  if (!parent || !shape.parents.includes(parent)) refuse('parent', `${input.kind === 'question' ? 'an open question' : 'an interface'} sits under ${shape.parents.map((k) => `a ${k}`).join(' or ')}, and ${input.parent} is ${parent ? `a ${parent}` : 'no record'}`);
  return onePast(reader, `${input.parent}-${shape.letters}`, shape);
}

/** Get the next ID for a record of the Product aggregate (LA-AUT-QRY112). */
export const NEXT_PRODUCT_ID: QueryDefinition<{ kind: string; parent: string }, string, ProductReader> = {
  ...NEXT_PRODUCT_ID_IDENTITY,
  input: {
    kind: id('The kind: question or interface.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  reader: productReader,
  run: nextProductId,
  text: (next) => next,
};

// A relation's key: its name and the pair of kinds it links.
const relationKey = (r: { name: string; source_kind: string; target_kind: string }) => `${r.name} ${r.source_kind} -> ${r.target_kind}`;

/** A product as text: its row, roles, declarations, questions and interfaces. */
function productText(product: ProductPage): string {
  const { product: row } = product;
  const lines = [`Product ${row.id}: ${row.title}`, `  description: ${row.description}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  for (const r of product.roles) lines.push(`Role ${r.name}: ${r.description}`);
  for (const k of product.kinds) {
    lines.push(`Product kind ${k.name}: ${k.label} (under ${k.parent_kind}${k.stage ? `, ${k.stage}` : ''})`);
    for (const f of k.fields) lines.push(`  ${f.position}. ${f.name} (${f.type}${f.required ? ', required' : ''}): ${f.description}`);
  }
  for (const r of product.relations) lines.push(`Product relation ${relationKey(r)}: ${r.forward_label} / ${r.reverse_label}`);
  for (const q of product.questions) lines.push(`Open question ${q.id}: ${q.title} (owner ${q.owner}, under ${q.product_id ?? q.domain_id})${q.about.length ? ` [about ${q.about.join(', ')}]` : ''}`);
  for (const i of product.interfaces) lines.push(`Interface ${i.id}: ${i.title} (${i.kind})`);
  return lines.join('\n');
}
