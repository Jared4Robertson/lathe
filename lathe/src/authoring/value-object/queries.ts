// The Value object aggregate's own reads, each answered from its read model (LA-AUT-RM29) through its reader
// (reader.ts), which the query runner gives each handler: a value object whole as its page reads it, the value objects
// of a product, and the next free ID for a record of one of its kinds. A handler never sees the data, a repository or
// the aggregate's model; each changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { type ValueObjectKind } from './model.ts';
import type { ValueObjectPage, ValueObjectSummary } from './read-model.ts';
import { valueObjectReader, type ValueObjectReader } from './reader.ts';
import { GET_VALUE_OBJECT_IDENTITY, LIST_VALUE_OBJECTS_IDENTITY, NEXT_VALUE_OBJECT_ID_IDENTITY } from './queries.generated.ts';

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
  ...GET_VALUE_OBJECT_IDENTITY,
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
  ...LIST_VALUE_OBJECTS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: valueObjectReader,
  run: listValueObjects,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No value objects.'),
};

/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly string[] = ['value_object', 'constraint', 'value_type', 'constraint_test'];

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a value object's is its product's ID,
 * VO and one past the highest number in use; a constraint's its value object's, C and the next number. A value object
 * has one value type (VT) and a constraint one test (T), so theirs is fixed, and refused once taken.
 */
export function nextValueObjectId(reader: ValueObjectReader, input: { kind: string; parent: string }): string {
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Value object aggregate; its kinds are ${KINDS.join(', ')}`);
  const kind = input.kind as ValueObjectKind;
  const shape = reader.idShape(kind);
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== shape.parents[0]) refuse('parent', `a ${kind} sits under a ${shape.parents[0]}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  switch (kind) {
    case 'value_object':
      return onePast(reader, `${input.parent}-${shape.letters}`, shape);
    case 'constraint':
      return onePast(reader, `${input.parent}-${shape.letters}`, shape);
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
  ...NEXT_VALUE_OBJECT_ID_IDENTITY,
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
