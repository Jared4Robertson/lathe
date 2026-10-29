// The Product aggregate's own reads (read model LA-AUT-RM21): a product whole, the interfaces of a product, and the
// next free ID for an open question or an interface. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { PRODUCT_SLICE, productsFrom, relationKey, type Product } from './model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

// The product a domain sits in, read from the domain.
const productOfDomain = (view: ReadView) => (domain: string) => {
  const record = view.record(domain);
  return record?.kind === 'domain' ? String(record.row.product_id) : undefined;
};

/** The product that holds the record: the product itself, an open question or interface in it, or a kind it declares. */
export function getProduct(view: ReadView, input: { id: string }): Product {
  const declared = view.rows('product_kind').find((k) => k.name === input.id);
  const record = view.record(input.id);
  let product: string | undefined;
  if (declared) product = String(declared.product_id);
  else if (!record) refuse('missing', `no record or product kind has the ID ${input.id}`);
  else if (record.kind === 'product') product = input.id;
  else if (record.kind === 'interface') product = String(record.row.product_id);
  else if (record.kind === 'question') product = record.row.product_id !== undefined ? String(record.row.product_id) : productOfDomain(view)(String(record.row.domain_id));
  else refuse('kind', `${input.id} is a ${record.kind}, not a product, an open question, an interface or a product kind`);
  return productsFrom((table) => view.rows(table), productOfDomain(view), product)[0];
}

/** GET a product whole (LA-AUT-QRY110). */
export const GET_PRODUCT: QueryDefinition<{ id: string }, Product> = {
  id: 'LA-AUT-QRY110',
  slice: PRODUCT_SLICE,
  name: 'get-product',
  description: 'Reads a product whole, by its ID, the ID of an open question or interface in it, or the name of a kind it declares: its row, roles, declared kinds with their fields, relations, open questions with what they are about, and interfaces.',
  method: 'GET',
  route: '/api/product/get-product',
  input: { id: id('The product, an open question or interface in it, or a product kind it declares.', 'required') },
  run: getProduct,
  text: productText,
};

/** The interfaces of a product, by ID. */
export function listInterfaces(view: ReadView, input: { product_id: string }): { id: string; title: string; kind: string }[] {
  if (view.record(input.product_id)?.kind !== 'product') refuse('missing', `there is no product ${input.product_id}`);
  return view
    .rows('interface')
    .filter((i) => i.product_id === input.product_id)
    .map((i) => ({ id: String(i.id), title: String(i.title), kind: String(i.kind) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** List the interfaces of a product (LA-AUT-QRY111). */
export const LIST_INTERFACES: QueryDefinition<{ product_id: string }, { id: string; title: string; kind: string }[]> = {
  id: 'LA-AUT-QRY111',
  slice: PRODUCT_SLICE,
  name: 'list-interfaces',
  description: 'Lists the interfaces of a product, by ID, with their titles and kinds.',
  method: 'GET',
  route: '/api/product/list-interfaces',
  input: { product_id: id('The product.', 'required') },
  run: listInterfaces,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title} (${r.kind})`).join('\n') : 'No interfaces.'),
};

// One past the highest number in the kind's IDs after the prefix, padded to two digits.
function onePast(view: ReadView, kind: string, prefix: string): string {
  const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let highest = 0;
  for (const row of view.rows(kind)) {
    const m = shape.exec(String(row.id));
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/**
 * The next free ID for an open question (under a product or a domain: its ID and Q) or an interface (under a product:
 * its ID and IF): one past the highest in use.
 */
export function nextProductId(view: ReadView, input: { kind: string; parent: string }): string {
  const parent = view.record(input.parent);
  if (input.kind === 'question') {
    if (parent?.kind !== 'product' && parent?.kind !== 'domain') refuse('parent', `an open question sits under a product or a domain, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
    return onePast(view, 'question', `${input.parent}-Q`);
  }
  if (input.kind === 'interface') {
    if (parent?.kind !== 'product') refuse('parent', `an interface sits under a product, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
    return onePast(view, 'interface', `${input.parent}-IF`);
  }
  return refuse('kind', `${input.kind} is not a kind of the Product aggregate with an ID under a parent; its kinds are question and interface`);
}

/** Get the next ID for a record of the Product aggregate (LA-AUT-QRY112). */
export const NEXT_PRODUCT_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
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
  run: nextProductId,
  text: (next) => next,
};

/** A product as text: its row, roles, declarations, questions and interfaces. */
function productText(product: Product): string {
  const { product: row } = product;
  const lines = [`Product ${row.id}: ${row.title}`, `  description: ${row.description}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  for (const r of product.roles) lines.push(`Role ${r.name}: ${r.description}`);
  for (const k of product.kinds) {
    lines.push(`Product kind ${k.row.name}: ${k.row.label} (under ${k.row.parent_kind}${k.row.stage ? `, ${k.row.stage}` : ''})`);
    for (const f of k.fields) lines.push(`  ${f.position}. ${f.name} (${f.type}${f.required ? ', required' : ''}): ${f.description}`);
  }
  for (const r of product.relations) lines.push(`Product relation ${relationKey(r)}: ${r.forward_label} / ${r.reverse_label}`);
  for (const q of product.questions) lines.push(`Open question ${q.row.id}: ${q.row.title} (owner ${q.row.owner}, under ${q.row.product_id ?? q.row.domain_id})${q.about.length ? ` [about ${q.about.join(', ')}]` : ''}`);
  for (const i of product.interfaces) lines.push(`Interface ${i.id}: ${i.title} (${i.kind})`);
  return lines.join('\n');
}

/** The Product aggregate's queries, as the CLI and the MCP server register them. */
export const PRODUCT_QUERIES: readonly AnyQuery[] = [GET_PRODUCT, LIST_INTERFACES, NEXT_PRODUCT_ID];
