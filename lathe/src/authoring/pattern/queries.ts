// The Pattern aggregate's own reads (read model LA-AUT-RM22): a pattern whole, the patterns of a product, and the next
// free ID for a rule or rule test. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { PATTERN_KINDS, PATTERN_SLICE, patternsFrom, type Pattern, type PatternKind } from './model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The pattern that holds the record: the pattern itself, or one of its rules or rule tests. */
export function getPattern(view: ReadView, input: { id: string }): Pattern {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (!(record.kind in PATTERN_KINDS)) refuse('kind', `${input.id} is a ${record.kind}, not a pattern or a record in one`);
  let at = record;
  while (at.kind !== 'pattern') {
    const column = PATTERN_KINDS[at.kind as Exclude<PatternKind, 'pattern'>];
    at = view.record(String(at.row[column]))!;
  }
  return patternsFrom((table) => view.rows(table), String(at.row.id))[0];
}

/** GET a pattern whole (LA-AUT-QRY138). */
export const GET_PATTERN: QueryDefinition<{ id: string }, Pattern> = {
  id: 'LA-AUT-QRY138',
  slice: PATTERN_SLICE,
  name: 'get-pattern',
  description: 'Reads a pattern whole, by its ID or the ID of any rule or rule test in it: its row, its settings in order, its rules, and their tests.',
  input: { id: id('The pattern, or a rule or rule test in it.', 'required') },
  run: getPattern,
  text: patternText,
};

/** The patterns of a product, by ID. */
export function listPatterns(view: ReadView, input: { product_id: string }): { id: string; title: string }[] {
  if (view.record(input.product_id)?.kind !== 'product') refuse('missing', `there is no product ${input.product_id}`);
  return view
    .rows('pattern')
    .filter((p) => p.product_id === input.product_id)
    .map((p) => ({ id: String(p.id), title: String(p.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** List the patterns of a product (LA-AUT-QRY139). */
export const LIST_PATTERNS: QueryDefinition<{ product_id: string }, { id: string; title: string }[]> = {
  id: 'LA-AUT-QRY139',
  slice: PATTERN_SLICE,
  name: 'list-patterns',
  description: 'Lists the patterns of a product, by ID, with their titles.',
  input: { product_id: id('The product.', 'required') },
  run: listPatterns,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No patterns.'),
};

// One past the highest number in use after the prefix, padded to two digits.
function onePast(view: ReadView, prefix: string): string {
  const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let highest = 0;
  for (const kind of Object.keys(view.schema.kinds)) {
    for (const row of view.rows(kind)) {
      const m = shape.exec(String(row.id));
      if (m) highest = Math.max(highest, Number(m[1]));
    }
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/** The numbered kinds of the aggregate, each with the kind of record it sits under. */
const UNDER = { pattern_rule: 'pattern', pattern_rule_test: 'pattern_rule' } as const;

/**
 * The next free ID for a pattern rule (under its pattern) or a pattern rule test (under its rule): one past the highest
 * in use. A pattern's own ID is its product's, PAT and a name chosen for it, so it has no next ID.
 */
export function nextPatternId(view: ReadView, input: { kind: string; parent: string }): string {
  if (input.kind === 'pattern') refuse('kind', "a pattern's ID is its product's ID, PAT and a name chosen for it, such as TL-PAT-LIBRARIAN-ACTION, so it has no next ID");
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Pattern aggregate; its numbered kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as keyof typeof UNDER;
  const parent = view.record(input.parent);
  if (parent?.kind !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  return onePast(view, `${input.parent}-${kind === 'pattern_rule' ? 'R' : 'T'}`);
}

/** Get the next ID for a record of the Pattern aggregate (LA-AUT-QRY140). */
export const NEXT_PATTERN_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
  id: 'LA-AUT-QRY140',
  slice: PATTERN_SLICE,
  name: 'next-id',
  description: 'The next free ID for a pattern rule (under a pattern) or a pattern rule test (under a rule): one past the highest in use.',
  input: {
    kind: id('The kind: pattern_rule or pattern_rule_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  run: nextPatternId,
  text: (next) => next,
};

/** A pattern as text: its row and settings, then each rule with its tests. */
function patternText(pattern: Pattern): string {
  const { pattern: row } = pattern;
  const lines = [`Pattern ${row.id}: ${row.title}`, `  product: ${row.product_id}`, `  description: ${row.description}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  pattern.settings.forEach((s, at) => lines.push(`  setting ${at + 1}. ${s.name}: ${s.meaning}`));
  for (const r of pattern.rules) {
    lines.push(`Pattern rule ${r.id}: ${r.title}${r.setting ? ` (setting ${r.setting})` : ''}`);
    for (const t of pattern.ruleTests.filter((x) => x.row.pattern_rule_id === r.id)) lines.push(`  pattern rule test ${t.row.id}: ${t.row.title} (in ${t.row.domain_id}, ${t.row.state})`);
  }
  return lines.join('\n');
}

/** The Pattern aggregate's queries, as the CLI and the MCP server register them. */
export const PATTERN_QUERIES: readonly AnyQuery[] = [GET_PATTERN, LIST_PATTERNS, NEXT_PATTERN_ID];
