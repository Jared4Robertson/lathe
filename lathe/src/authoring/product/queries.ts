// The Product aggregate's own reads (read model LA-AUT-RM21): a product's page, every product as the nav lists it, the
// interfaces of a product, and the next free ID for an open question or an interface. Each reads only the read model,
// through its reader (reader.ts), and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { PRODUCT_SLICE } from './model.ts';
import type { ProductPage, ProductSummary } from './read-model.ts';
import { productReader, type ProductReader } from './reader.ts';

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
  id: 'LA-AUT-QRY110',
  slice: PRODUCT_SLICE,
  name: 'get-product',
  description: 'Reads a product whole, by its ID, the ID of an open question or interface in it, or the name of a kind it declares: its row, roles, business outcomes and domains, declared kinds with their fields, relations, open questions with what they are about, and interfaces with the flows through each.',
  method: 'GET',
  route: '/api/product/get-product',
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
  id: 'LA-AUT-QRY113',
  slice: PRODUCT_SLICE,
  name: 'list-products',
  description: 'Lists every product, by ID, with its title, and its icon and color when it gives them.',
  method: 'GET',
  route: '/api/product/list-products',
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
  id: 'LA-AUT-QRY111',
  slice: PRODUCT_SLICE,
  name: 'list-interfaces',
  description: 'Lists the interfaces of a product, by ID, with their titles and kinds.',
  method: 'GET',
  route: '/api/product/list-interfaces',
  input: { product_id: id('The product.', 'required') },
  reader: productReader,
  run: listInterfaces,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title} (${r.kind})`).join('\n') : 'No interfaces.'),
};

// One past the highest number in use after the prefix, padded to two digits.
const onePast = (reader: ProductReader, prefix: string): string => `${prefix}${String(reader.highestAfter(prefix) + 1).padStart(2, '0')}`;

/**
 * The next free ID for an open question (under a product or a domain: its ID and Q) or an interface (under a product:
 * its ID and IF): one past the highest in use.
 */
export function nextProductId(reader: ProductReader, input: { kind: string; parent: string }): string {
  const parent = reader.kindOf(input.parent);
  if (input.kind === 'question') {
    if (parent !== 'product' && parent !== 'domain') refuse('parent', `an open question sits under a product or a domain, and ${input.parent} is ${parent ? `a ${parent}` : 'no record'}`);
    return onePast(reader, `${input.parent}-Q`);
  }
  if (input.kind === 'interface') {
    if (parent !== 'product') refuse('parent', `an interface sits under a product, and ${input.parent} is ${parent ? `a ${parent}` : 'no record'}`);
    return onePast(reader, `${input.parent}-IF`);
  }
  return refuse('kind', `${input.kind} is not a kind of the Product aggregate with an ID under a parent; its kinds are question and interface`);
}

/** Get the next ID for a record of the Product aggregate (LA-AUT-QRY112). */
export const NEXT_PRODUCT_ID: QueryDefinition<{ kind: string; parent: string }, string, ProductReader> = {
  id: 'LA-AUT-QRY112',
  slice: PRODUCT_SLICE,
  name: 'next-id',
  description: 'The next free ID for an open question (under a product or a domain) or an interface (under a product): one past the highest in use.',
  method: 'GET',
  route: '/api/product/next-id',
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

/** The Product aggregate's queries, as the CLI and the MCP server register them. */
export const PRODUCT_QUERIES: readonly AnyQuery[] = [GET_PRODUCT, LIST_PRODUCTS, LIST_INTERFACES, NEXT_PRODUCT_ID];
