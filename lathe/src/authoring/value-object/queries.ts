// The Value object aggregate's own reads, each answered from its read model (LA-AUT-RM29) through its reader
// (reader.ts), which the query runner gives each handler: a value object whole as its page reads it, the value objects
// of a product, and the next free ID for a record of one of its kinds. A handler never sees the data, a repository or
// the aggregate's model; each changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { VALUE_OBJECT_SLICE, type ValueObjectKind } from './model.ts';
import type { ValueObjectPage, ValueObjectSummary } from './read-model.ts';
import { valueObjectReader, type ValueObjectReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The value object that holds the record, as its page reads it: the value object itself, or a constraint, its value type or a constraint test. */
export function getValueObject(reader: ValueObjectReader, input: { id: string }): ValueObjectPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a value object or a record in one`);
}

/** GET a value object whole (LA-AUT-QRY174). */
export const GET_VALUE_OBJECT: QueryDefinition<{ id: string }, ValueObjectPage, ValueObjectReader> = {
  id: 'LA-AUT-QRY174',
  slice: VALUE_OBJECT_SLICE,
  name: 'get-value-object',
  description: 'Reads a value object whole as its page shows it, by its ID or the ID of any record in it: the record asked for and its kind, the value object\'s row and the product its ID names, its fields in order, its constraints by ID each with its test (and the test data sets it starts from), and its value type with the standard rules it meets and the packages it uses.',
  method: 'GET',
  route: '/api/value-object/get-value-object',
  input: { id: id('The value object, or a constraint, its value type or a constraint test in it.', 'required') },
  reader: valueObjectReader,
  run: getValueObject,
  text: valueObjectText,
};

/** The value objects of a product, by ID: those whose ID names it. */
export function listValueObjects(reader: ValueObjectReader, input: { product_id: string }): ValueObjectSummary[] {
  return reader.valueObjectsOf(input.product_id) ?? refuse('missing', `there is no product ${input.product_id}`);
}

/** List the value objects of a product (LA-AUT-QRY175). */
export const LIST_VALUE_OBJECTS: QueryDefinition<{ product_id: string }, ValueObjectSummary[], ValueObjectReader> = {
  id: 'LA-AUT-QRY175',
  slice: VALUE_OBJECT_SLICE,
  name: 'list-value-objects',
  description: 'Lists the value objects of a product (those whose ID names it), by ID, with their titles.',
  method: 'GET',
  route: '/api/value-object/list-value-objects',
  input: { product_id: id('The product.', 'required') },
  reader: valueObjectReader,
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

// One past the highest number in use after the prefix, padded to two digits.
const onePast = (reader: ValueObjectReader, prefix: string): string => `${prefix}${String(reader.highestAfter(prefix) + 1).padStart(2, '0')}`;

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a value object's is its product's ID,
 * VO and one past the highest number in use; a constraint's its value object's, C and the next number. A value object
 * has one value type (VT) and a constraint one test (T), so theirs is fixed, and refused once taken.
 */
export function nextValueObjectId(reader: ValueObjectReader, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Value object aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as ValueObjectKind;
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  switch (kind) {
    case 'value_object':
      return onePast(reader, `${input.parent}-VO`);
    case 'constraint':
      return onePast(reader, `${input.parent}-C`);
    case 'value_type':
    case 'constraint_test': {
      const own = `${input.parent}-${kind === 'value_type' ? 'VT' : 'T'}`;
      if (reader.kindOf(own)) refuse('exists', `${input.parent} already has its ${kind === 'value_type' ? 'value type' : 'test'}, ${own}`);
      return own;
    }
  }
}

/** Get the next ID for a record of the Value object aggregate (LA-AUT-QRY176). */
export const NEXT_VALUE_OBJECT_ID: QueryDefinition<{ kind: string; parent: string }, string, ValueObjectReader> = {
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
  reader: valueObjectReader,
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
  for (const { constraint: c, test } of page.constraints) {
    lines.push(`Constraint ${c.id}: ${c.title}`);
    if (test) lines.push(`  constraint test ${test.test.id}: ${test.test.title} (${test.test.level}, ${test.test.state})${listed(test.startsFrom.map((x) => `starts from ${x}`))}`);
  }
  if (valueType) lines.push(`Value type ${valueType.valueType.id}: ${valueType.valueType.title}${valueType.valueType.file ? ` (${valueType.valueType.file})` : ''}${listed([...valueType.meets.map((x) => `meets ${x}`), ...valueType.packages.map((x) => `uses ${x}`)])}`);
  return lines.join('\n');
}

/** The Value object aggregate's queries, as the CLI and the MCP server register them. */
export const VALUE_OBJECT_QUERIES: readonly AnyQuery[] = [GET_VALUE_OBJECT, LIST_VALUE_OBJECTS, NEXT_VALUE_OBJECT_ID];
