// The Standard aggregate's own reads (read model LA-AUT-RM23): a standard whole, the standards of a product, and the
// next free ID for a rule or rule test. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { STANDARD_KINDS, STANDARD_SLICE, standardsFrom, type Standard, type StandardKind } from './model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The standard that holds the record: the standard itself, or one of its rules or rule tests. */
export function getStandard(view: ReadView, input: { id: string }): Standard {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (!(record.kind in STANDARD_KINDS)) refuse('kind', `${input.id} is a ${record.kind}, not a standard or a record in one`);
  let at = record;
  while (at.kind !== 'standard') {
    const column = STANDARD_KINDS[at.kind as Exclude<StandardKind, 'standard'>];
    at = view.record(String(at.row[column]))!;
  }
  return standardsFrom((table) => view.rows(table), String(at.row.id))[0];
}

/** GET a standard whole (LA-AUT-QRY142). */
export const GET_STANDARD: QueryDefinition<{ id: string }, Standard> = {
  id: 'LA-AUT-QRY142',
  slice: STANDARD_SLICE,
  name: 'get-standard',
  description: 'Reads a standard whole, by its ID or the ID of any rule or rule test in it: its row, its rules, and their tests.',
  method: 'GET',
  route: '/api/standard/get-standard',
  input: { id: id('The standard, or a rule or rule test in it.', 'required') },
  run: getStandard,
  text: standardText,
};

/** The standards of a product, by ID. */
export function listStandards(view: ReadView, input: { product_id: string }): { id: string; title: string }[] {
  if (view.record(input.product_id)?.kind !== 'product') refuse('missing', `there is no product ${input.product_id}`);
  return view
    .rows('standard')
    .filter((s) => s.product_id === input.product_id)
    .map((s) => ({ id: String(s.id), title: String(s.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** List the standards of a product (LA-AUT-QRY143). */
export const LIST_STANDARDS: QueryDefinition<{ product_id: string }, { id: string; title: string }[]> = {
  id: 'LA-AUT-QRY143',
  slice: STANDARD_SLICE,
  name: 'list-standards',
  description: 'Lists the standards of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/standard/list-standards',
  input: { product_id: id('The product.', 'required') },
  run: listStandards,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No standards.'),
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
const UNDER = { standard_rule: 'standard', standard_rule_test: 'standard_rule' } as const;

/**
 * The next free ID for a standard rule (under its standard) or a standard rule test (under its rule): one past the
 * highest in use. A standard's own ID is its product's, STD and a name chosen for it, so it has no next ID.
 */
export function nextStandardId(view: ReadView, input: { kind: string; parent: string }): string {
  if (input.kind === 'standard') refuse('kind', "a standard's ID is its product's ID, STD and a name chosen for it, such as TL-STD-CODE, so it has no next ID");
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Standard aggregate; its numbered kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as keyof typeof UNDER;
  const parent = view.record(input.parent);
  if (parent?.kind !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  return onePast(view, `${input.parent}-${kind === 'standard_rule' ? 'R' : 'T'}`);
}

/** Get the next ID for a record of the Standard aggregate (LA-AUT-QRY144). */
export const NEXT_STANDARD_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
  id: 'LA-AUT-QRY144',
  slice: STANDARD_SLICE,
  name: 'next-id',
  description: 'The next free ID for a standard rule (under a standard) or a standard rule test (under a rule): one past the highest in use.',
  method: 'GET',
  route: '/api/standard/next-id',
  input: {
    kind: id('The kind: standard_rule or standard_rule_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  run: nextStandardId,
  text: (next) => next,
};

/** A standard as text: its row, then each rule with its tests. */
function standardText(standard: Standard): string {
  const { standard: row } = standard;
  const lines = [`Standard ${row.id}: ${row.title}`, `  product: ${row.product_id}`, `  description: ${row.description}`];
  for (const r of standard.rules) {
    lines.push(`Standard rule ${r.id}: ${r.title}`);
    for (const t of standard.ruleTests.filter((x) => x.row.standard_rule_id === r.id)) lines.push(`  standard rule test ${t.row.id}: ${t.row.title} (${t.row.state})`);
  }
  return lines.join('\n');
}

/** The Standard aggregate's queries, as the CLI and the MCP server register them. */
export const STANDARD_QUERIES: readonly AnyQuery[] = [GET_STANDARD, LIST_STANDARDS, NEXT_STANDARD_ID];
