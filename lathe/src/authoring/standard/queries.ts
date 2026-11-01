// The Standard aggregate's own reads, each answered from its read model (LA-AUT-RM23) through its reader (reader.ts),
// which the query runner gives each handler: a standard whole as its page reads it, the standards of a product, and
// the next free ID for a rule or rule test. A handler never sees the data, a repository or the aggregate's model; each
// changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { StandardPage, StandardSummary } from './read-model.ts';
import { standardReader, type StandardReader } from './reader.ts';
import { GET_STANDARD_IDENTITY, LIST_STANDARDS_IDENTITY, NEXT_STANDARD_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The standard that holds the record, as its page reads it: the standard itself, or one of its rules or rule tests. */
export function getStandard(reader: StandardReader, input: { id: string }): StandardPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a standard or a record in one`);
}

/** GET a standard whole (LA-AUT-QRY142). */
export const GET_STANDARD: QueryDefinition<{ id: string }, StandardPage, StandardReader> = {
  ...GET_STANDARD_IDENTITY,
  input: { id: id('The standard, or a rule or rule test in it.', 'required') },
  reader: standardReader,
  run: getStandard,
  text: standardText,
};

/** The standards of a product, by ID. */
export function listStandards(reader: StandardReader, input: { product_id: string }): StandardSummary[] {
  return reader.standardsOf(input.product_id) ?? refuse('missing', `there is no product ${input.product_id}`);
}

/** List the standards of a product (LA-AUT-QRY143). */
export const LIST_STANDARDS: QueryDefinition<{ product_id: string }, StandardSummary[], StandardReader> = {
  ...LIST_STANDARDS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: standardReader,
  run: listStandards,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No standards.'),
};

/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly string[] = ['standard_rule', 'standard_rule_test'];

/**
 * The next free ID for a standard rule (under its standard) or a standard rule test (under its rule): one past the
 * highest in use. A standard's own ID is its product's, STD and a name chosen for it, so it has no next ID.
 */
export function nextStandardId(reader: StandardReader, input: { kind: string; parent: string }): string {
  if (input.kind === 'standard') refuse('kind', "a standard's ID is its product's ID, STD and a name chosen for it, such as TL-STD-CODE, so it has no next ID");
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Standard aggregate; its numbered kinds are ${KINDS.join(', ')}`);
  const kind = input.kind;
  const shape = reader.idShape(kind);
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== shape.parents[0]) refuse('parent', `a ${kind} sits under a ${shape.parents[0]}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  return onePast(reader, `${input.parent}-${shape.letters}`, shape);
}

/** Get the next ID for a record of the Standard aggregate (LA-AUT-QRY144). */
export const NEXT_STANDARD_ID: QueryDefinition<{ kind: string; parent: string }, string, StandardReader> = {
  ...NEXT_STANDARD_ID_IDENTITY,
  input: {
    kind: id('The kind: standard_rule or standard_rule_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  reader: standardReader,
  run: nextStandardId,
  text: (next) => next,
};

/** A standard as text: its row, then each rule with what meets it and its tests. */
function standardText(page: StandardPage): string {
  const { standard: row } = page;
  const lines = [`Standard ${row.id}: ${row.title}`, `  product: ${row.product_id}`, `  description: ${row.description}`];
  for (const r of page.rules) {
    lines.push(`Standard rule ${r.rule.id}: ${r.rule.title}${r.metBy.length ? ` [met by ${r.metBy.join(', ')}]` : ''}`);
    for (const t of r.tests) lines.push(`  standard rule test ${t.test.id}: ${t.test.title} (${t.test.state})`);
  }
  return lines.join('\n');
}
