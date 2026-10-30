// The View aggregate's own reads, each answered from its read model (LA-AUT-RM32) through its reader (reader.ts), which
// the query runner gives each handler: a view whole, the views of a product, and the next free ID for a record of one
// of its kinds. A handler never sees the data, a repository or the aggregate's model; each changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { VIEW_SLICE, type ViewKind } from './model.ts';
import type { ViewPage, ViewSummary } from './read-model.ts';
import { viewReader, type ViewReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};
const a = (word: string) => (/^[aeiou]/.test(word) ? 'an' : 'a');

/** The view that holds the record: the view itself, or one of its requirements or tests. */
export function getView(reader: ViewReader, input: { id: string }): ViewPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${a(kind)} ${kind}, not a view or a record in one`);
}

/** GET a view whole (LA-AUT-QRY190). */
export const GET_VIEW: QueryDefinition<{ id: string }, ViewPage, ViewReader> = {
  id: 'LA-AUT-QRY190',
  slice: VIEW_SLICE,
  name: 'get-view',
  method: 'GET',
  route: '/api/view/get-view',
  description: "Reads a view whole as its page shows it, by its ID or the ID of any requirement or test in it: the record asked for and its kind, the view's row, and its requirements by ID, each with its tests (with the test data sets they start from).",
  input: { id: id('The view, or a view requirement or view test in it.', 'required') },
  reader: viewReader,
  run: getView,
  text: viewText,
};

/** The views of a product, by ID: those whose ID is the product's, V and a number. */
export function listViews(reader: ViewReader, input: { product_id: string }): ViewSummary[] {
  return reader.viewsOf(input.product_id) ?? refuse('missing', `there is no product ${input.product_id}`);
}

/** List the views of a product (LA-AUT-QRY191). */
export const LIST_VIEWS: QueryDefinition<{ product_id: string }, ViewSummary[], ViewReader> = {
  id: 'LA-AUT-QRY191',
  slice: VIEW_SLICE,
  name: 'list-views',
  method: 'GET',
  route: '/api/view/list-views',
  description: 'Lists the views of a product, by ID, with their titles.',
  input: { product_id: id('The product.', 'required') },
  reader: viewReader,
  run: listViews,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No views.'),
};

// One past the highest number in use after the prefix, padded to two digits.
const onePast = (reader: ViewReader, prefix: string): string => `${prefix}${String(reader.highestAfter(prefix) + 1).padStart(2, '0')}`;

/** The kinds of the aggregate, each with the kind of record it sits under. */
const UNDER: Record<ViewKind, string> = { view: 'product', view_requirement: 'view', view_test: 'view_requirement' };

/** The next free ID for a record of one of the aggregate's kinds under its parent: one past the highest in use. */
export function nextViewId(reader: ViewReader, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the View aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as ViewKind;
  const parent = reader.kindOf(input.parent);
  if (parent !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is ${parent ? `${a(parent)} ${parent}` : 'no record'}`);
  const suffix = { view: 'V', view_requirement: 'R', view_test: 'T' }[kind];
  return onePast(reader, `${input.parent}-${suffix}`);
}

/** Get the next ID in a view (LA-AUT-QRY192). */
export const NEXT_VIEW_ID: QueryDefinition<{ kind: string; parent: string }, string, ViewReader> = {
  id: 'LA-AUT-QRY192',
  slice: VIEW_SLICE,
  name: 'next-id',
  method: 'GET',
  route: '/api/view/next-id',
  description: 'The next free ID for a view (under a product), a view requirement (under a view) or a view test (under a view requirement): one past the highest in use.',
  input: {
    kind: id('The kind: view, view_requirement or view_test.', 'required'),
    parent: id('The record it will sit under: for a view, its product.', 'required'),
  },
  reader: viewReader,
  run: nextViewId,
  text: (next) => next,
};

/** A view as text: its row, then each requirement with its tests. */
function viewText(page: ViewPage): string {
  const { view: row } = page;
  const lines = [`View ${row.id}: ${row.title}`, ...(row.route ? [`  route: ${row.route}`] : []), `  description: ${row.description}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  for (const r of page.requirements) {
    lines.push(`View requirement ${r.requirement.id}: ${r.requirement.title}`);
    for (const t of r.tests) lines.push(`  view test ${t.test.id}: ${t.test.title} (${t.test.state})`);
  }
  return lines.join('\n');
}

/** The View aggregate's queries, as the CLI and the MCP server register them. */
export const VIEW_QUERIES: readonly AnyQuery[] = [GET_VIEW, LIST_VIEWS, NEXT_VIEW_ID];
