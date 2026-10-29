// The Value object aggregate's own reads (read model LA-AUT-RM29): a value object whole, the value objects of a
// product, and the next free ID for a record of one of its kinds. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { VALUE_OBJECT_SLICE } from './model.ts';
import { PARENT_OF, valueObjectPagesFrom, type ValueObjectPage, type ValueObjectSummary } from './read-model.ts';

type ValueObjectKind = keyof typeof PARENT_OF;

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The value object that holds the record: the value object itself, or a constraint, its value type or a constraint test. */
export function getValueObject(view: ReadView, input: { id: string }): ValueObjectPage {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (!(record.kind in PARENT_OF)) refuse('kind', `${input.id} is a ${record.kind}, not a value object or a record in one`);
  let at = record;
  while (at.kind !== 'value_object') {
    const column = PARENT_OF[at.kind as Exclude<ValueObjectKind, 'value_object'>];
    at = view.record(String(at.row[column]))!;
  }
  return valueObjectPagesFrom(view, String(at.row.id))[0];
}

/** GET a value object whole (LA-AUT-QRY174). */
export const GET_VALUE_OBJECT: QueryDefinition<{ id: string }, ValueObjectPage> = {
  id: 'LA-AUT-QRY174',
  slice: VALUE_OBJECT_SLICE,
  name: 'get-value-object',
  description: 'Reads a value object whole, by its ID or the ID of any record in it: its row, its fields in order, its constraints with their tests, and its value type with the standard rules it meets and the packages it uses.',
  method: 'GET',
  route: '/api/value-object/get-value-object',
  input: { id: id('The value object, or a constraint, its value type or a constraint test in it.', 'required') },
  run: getValueObject,
  text: valueObjectText,
};

/** The product a value object's ID names: the longest product ID it starts with, and a hyphen. */
function productNamed(view: ReadView, recordId: string): string | undefined {
  let found: string | undefined;
  for (const p of view.rows('product')) {
    const productId = String(p.id);
    if (recordId.startsWith(`${productId}-`) && (found === undefined || productId.length > found.length)) found = productId;
  }
  return found;
}

/** The value objects of a product, by ID: those whose ID names it. */
export function listValueObjects(view: ReadView, input: { product_id: string }): ValueObjectSummary[] {
  if (view.record(input.product_id)?.kind !== 'product') refuse('missing', `there is no product ${input.product_id}`);
  return view
    .rows('value_object')
    .filter((v) => productNamed(view, String(v.id)) === input.product_id)
    .map((v) => ({ id: String(v.id), title: String(v.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** List the value objects of a product (LA-AUT-QRY175). */
export const LIST_VALUE_OBJECTS: QueryDefinition<{ product_id: string }, ValueObjectSummary[]> = {
  id: 'LA-AUT-QRY175',
  slice: VALUE_OBJECT_SLICE,
  name: 'list-value-objects',
  description: 'Lists the value objects of a product (those whose ID names it), by ID, with their titles.',
  method: 'GET',
  route: '/api/value-object/list-value-objects',
  input: { product_id: id('The product.', 'required') },
  run: listValueObjects,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No value objects.'),
};

/** The kind of record each of the aggregate's kinds sits under, for its next ID. */
const UNDER: Record<ValueObjectKind, string> = {
  value_object: 'product',
  constraint: 'value_object',
  value_type: 'value_object',
  constraint_test: 'constraint',
};

// One past the highest number in use after the prefix, among the table's IDs, padded to two digits.
function onePast(view: ReadView, table: string, prefix: string): string {
  let highest = 0;
  for (const row of view.rows(table)) {
    const id = String(row.id);
    if (id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length))) highest = Math.max(highest, Number(id.slice(prefix.length)));
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a value object's is its product's ID,
 * VO and one past the highest number in use; a constraint's its value object's, C and the next number. A value object
 * has one value type (VT) and a constraint one test (T), so theirs is fixed, and refused once taken.
 */
export function nextValueObjectId(view: ReadView, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Value object aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as ValueObjectKind;
  const parent = view.record(input.parent);
  if (parent?.kind !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  switch (kind) {
    case 'value_object':
      return onePast(view, 'value_object', `${input.parent}-VO`);
    case 'constraint':
      return onePast(view, 'constraint', `${input.parent}-C`);
    case 'value_type':
    case 'constraint_test': {
      const own = `${input.parent}-${kind === 'value_type' ? 'VT' : 'T'}`;
      if (view.record(own)) refuse('exists', `${input.parent} already has its ${kind === 'value_type' ? 'value type' : 'test'}, ${own}`);
      return own;
    }
  }
}

/** Get the next ID for a record of the Value object aggregate (LA-AUT-QRY176). */
export const NEXT_VALUE_OBJECT_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
  id: 'LA-AUT-QRY176',
  slice: VALUE_OBJECT_SLICE,
  name: 'next-id',
  description: 'The next free ID for a value object (under its product) or a constraint (under its value object): one past the highest in use; or the one ID of a value type (under its value object) or a constraint test (under its constraint).',
  method: 'GET',
  route: '/api/value-object/next-id',
  input: {
    kind: id('The kind: value_object, constraint, value_type or constraint_test.', 'required'),
    parent: id('The record it will sit under: a product for a value object, a constraint for a constraint test, else the value object.', 'required'),
  },
  run: nextValueObjectId,
  text: (next) => next,
};

/** A value object as text: its row, its fields, then its constraints with their tests, and its value type. */
function valueObjectText(page: ValueObjectPage): string {
  const { valueObject: row, valueType } = page;
  const lines = [`Value object ${row.id}: ${row.title}`, `  description: ${row.description}`];
  const listed = (links: string[]) => (links.length ? ` [${links.join('; ')}]` : '');
  for (const f of page.fields) {
    const type = f.type ?? f.type_value_object_id ?? f.type_aggregate_id;
    lines.push(`  field ${f.position}: ${f.name} (${type}${f.required ? ', required' : ''}): ${f.meaning}`);
  }
  for (const c of page.constraints) {
    lines.push(`Constraint ${c.id}: ${c.title}`);
    if (c.test) lines.push(`  constraint test ${c.test.id}: ${c.test.title} (${c.test.level}, ${c.test.state})${listed(c.test.startsFrom.map((x) => `starts from ${x}`))}`);
  }
  if (valueType) lines.push(`Value type ${valueType.id}: ${valueType.title}${valueType.file ? ` (${valueType.file})` : ''}${listed([...valueType.meets.map((x) => `meets ${x}`), ...valueType.packages.map((x) => `uses ${x}`)])}`);
  return lines.join('\n');
}

/** The Value object aggregate's queries, as the CLI and the MCP server register them. */
export const VALUE_OBJECT_QUERIES: readonly AnyQuery[] = [GET_VALUE_OBJECT, LIST_VALUE_OBJECTS, NEXT_VALUE_OBJECT_ID];
