// The Pattern aggregate's own reads, each answered from its read model (LA-AUT-RM22) through its reader (reader.ts),
// which the query runner gives each handler: a pattern whole as its page reads it, the patterns of a product, and the
// next free ID for a rule or rule test. A handler never sees the data, a repository or the aggregate's model; each
// changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { PATTERN_SLICE } from './model.ts';
import type { PatternPage, PatternSummary } from './read-model.ts';
import { patternReader, type PatternReader } from './reader.ts';

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
  id: 'LA-AUT-QRY138',
  slice: PATTERN_SLICE,
  name: 'get-pattern',
  description: 'Reads a pattern whole as its page shows it, by its ID or the ID of any rule or rule test in it: the record asked for and its kind, the pattern\'s row, its settings in order, and its rules by ID, each with its tests (with the test data sets they start from).',
  method: 'GET',
  route: '/api/pattern/get-pattern',
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
  id: 'LA-AUT-QRY139',
  slice: PATTERN_SLICE,
  name: 'list-patterns',
  description: 'Lists the patterns of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/pattern/list-patterns',
  input: { product_id: id('The product.', 'required') },
  reader: patternReader,
  run: listPatterns,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No patterns.'),
};

/** The numbered kinds of the aggregate, each with the kind of record it sits under. */
const UNDER = { pattern_rule: 'pattern', pattern_rule_test: 'pattern_rule' } as const;

/**
 * The next free ID for a pattern rule (under its pattern) or a pattern rule test (under its rule): one past the highest
 * in use. A pattern's own ID is its product's, PAT and a name chosen for it, so it has no next ID.
 */
export function nextPatternId(reader: PatternReader, input: { kind: string; parent: string }): string {
  if (input.kind === 'pattern') refuse('kind', "a pattern's ID is its product's ID, PAT and a name chosen for it, such as TL-PAT-LIBRARIAN-ACTION, so it has no next ID");
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Pattern aggregate; its numbered kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as keyof typeof UNDER;
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  const prefix = `${input.parent}-${kind === 'pattern_rule' ? 'R' : 'T'}`;
  return `${prefix}${String(reader.highestAfter(prefix) + 1).padStart(2, '0')}`;
}

/** Get the next ID for a record of the Pattern aggregate (LA-AUT-QRY140). */
export const NEXT_PATTERN_ID: QueryDefinition<{ kind: string; parent: string }, string, PatternReader> = {
  id: 'LA-AUT-QRY140',
  slice: PATTERN_SLICE,
  name: 'next-id',
  description: 'The next free ID for a pattern rule (under a pattern) or a pattern rule test (under a rule): one past the highest in use.',
  method: 'GET',
  route: '/api/pattern/next-id',
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

/** The Pattern aggregate's queries, as the CLI and the MCP server register them. */
export const PATTERN_QUERIES: readonly AnyQuery[] = [GET_PATTERN, LIST_PATTERNS, NEXT_PATTERN_ID];
