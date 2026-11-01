// The Pattern aggregate's own reads, each answered from its read model (LA-AUT-RM22) through its reader (reader.ts),
// which the query runner gives each handler: a pattern whole as its page reads it, the patterns of a product, and the
// next free ID for a rule or rule test. A handler never sees the data, a repository or the aggregate's model; each
// changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { PatternPage, PatternSummary } from './read-model.ts';
import { patternReader, type PatternReader } from './reader.ts';
import { GET_PATTERN_IDENTITY, LIST_PATTERNS_IDENTITY, NEXT_PATTERN_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The pattern that holds the record, as its page reads it: the pattern itself, or one of its rules or rule tests. */
export function getPattern(reader: PatternReader, input: { id: string }): PatternPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a pattern or a record in one`);
}

/** GET a pattern whole (LA-AUT-QRY138). */
export const GET_PATTERN: QueryDefinition<{ id: string }, PatternPage, PatternReader> = {
  ...GET_PATTERN_IDENTITY,
  input: { id: id('The pattern, or a rule or rule test in it.', 'required') },
  reader: patternReader,
  run: getPattern,
  text: patternText,
};

/** The patterns of a product, by ID. */
export function listPatterns(reader: PatternReader, input: { product_id: string }): PatternSummary[] {
  return reader.patternsOf(input.product_id) ?? refuse('missing', `there is no product ${input.product_id}`);
}

/** List the patterns of a product (LA-AUT-QRY139). */
export const LIST_PATTERNS: QueryDefinition<{ product_id: string }, PatternSummary[], PatternReader> = {
  ...LIST_PATTERNS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: patternReader,
  run: listPatterns,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No patterns.'),
};

/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly string[] = ['pattern_rule', 'pattern_rule_test'];

/**
 * The next free ID for a pattern rule (under its pattern) or a pattern rule test (under its rule): one past the highest
 * in use. A pattern's own ID is its product's, PAT and a name chosen for it, so it has no next ID.
 */
export function nextPatternId(reader: PatternReader, input: { kind: string; parent: string }): string {
  if (input.kind === 'pattern') refuse('kind', "a pattern's ID is its product's ID, PAT and a name chosen for it, such as TL-PAT-LIBRARIAN-ACTION, so it has no next ID");
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Pattern aggregate; its numbered kinds are ${KINDS.join(', ')}`);
  const kind = input.kind;
  const shape = reader.idShape(kind);
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== shape.parents[0]) refuse('parent', `a ${kind} sits under a ${shape.parents[0]}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  return onePast(reader, `${input.parent}-${shape.letters}`, shape);
}

/** Get the next ID for a record of the Pattern aggregate (LA-AUT-QRY140). */
export const NEXT_PATTERN_ID: QueryDefinition<{ kind: string; parent: string }, string, PatternReader> = {
  ...NEXT_PATTERN_ID_IDENTITY,
  input: {
    kind: id('The kind: pattern_rule or pattern_rule_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  reader: patternReader,
  run: nextPatternId,
  text: (next) => next,
};

/** A pattern as text: its row and settings, then each rule with its tests. */
function patternText(page: PatternPage): string {
  const { pattern: row } = page;
  const lines = [`Pattern ${row.id}: ${row.title}`, `  product: ${row.product_id}`, `  description: ${row.description}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  page.settings.forEach((s, at) => lines.push(`  setting ${at + 1}. ${s.name}: ${s.meaning}`));
  for (const r of page.rules) {
    lines.push(`Pattern rule ${r.rule.id}: ${r.rule.title}`);
    for (const t of r.tests) lines.push(`  pattern rule test ${t.test.id}: ${t.test.title} (in ${t.test.domain_id}, ${t.test.state})`);
  }
  return lines.join('\n');
}
