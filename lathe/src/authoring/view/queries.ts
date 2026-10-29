// The View aggregate's own reads (read model LA-AUT-RM32): a view whole, the views of a product, and the next free ID
// for a record of one of its kinds. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { VIEW_SLICE } from './model.ts';
import { viewPageFrom, viewSummariesFrom, type ViewPage, type ViewSummary } from './read-model.ts';

/** The kinds of the View aggregate, each with the column that names its parent. */
const PARENT_COLUMN = { view_requirement: 'view_id', view_test: 'view_requirement_id' } as const;
type ViewKind = 'view' | keyof typeof PARENT_COLUMN;

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The view that holds the record: the view itself, or one of its requirements or tests. */
export function getView(view: ReadView, input: { id: string }): ViewPage {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (record.kind !== 'view' && !(record.kind in PARENT_COLUMN)) refuse('kind', `${input.id} is ${/^[aeiou]/.test(record.kind) ? 'an' : 'a'} ${record.kind}, not a view or a record in one`);
  let at = record;
  while (at.kind !== 'view') {
    at = view.record(String(at.row[PARENT_COLUMN[at.kind as keyof typeof PARENT_COLUMN]]))!;
  }
  return viewPageFrom((table) => view.rows(table), String(at.row.id))!;
}

/** GET a view whole (LA-AUT-QRY190). */
export const GET_VIEW: QueryDefinition<{ id: string }, ViewPage> = {
  id: 'LA-AUT-QRY190',
  slice: VIEW_SLICE,
  name: 'get-view',
  method: 'GET',
  route: '/api/view/get-view',
  description: 'Reads a view whole, by its ID or the ID of any record in it: its row, and its view requirements with their tests.',
  input: { id: id('The view, or a view requirement or view test in it.', 'required') },
  run: getView,
  text: viewText,
};

/** The views of a product, by ID: those whose ID starts with the product's. */
export function listViews(view: ReadView, input: { product_id: string }): ViewSummary[] {
  if (view.record(input.product_id)?.kind !== 'product') refuse('missing', `there is no product ${input.product_id}`);
  return viewSummariesFrom((table) => view.rows(table), input.product_id);
}

/** List the views of a product (LA-AUT-QRY191). */
export const LIST_VIEWS: QueryDefinition<{ product_id: string }, ViewSummary[]> = {
  id: 'LA-AUT-QRY191',
  slice: VIEW_SLICE,
  name: 'list-views',
  method: 'GET',
  route: '/api/view/list-views',
  description: 'Lists the views of a product, by ID, with their titles.',
  input: { product_id: id('The product.', 'required') },
  run: listViews,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No views.'),
};

// One past the highest number in use after the prefix among the kind's records, padded to two digits.
function onePast(view: ReadView, kind: string, prefix: string): string {
  const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let highest = 0;
  for (const row of view.rows(kind)) {
    const m = shape.exec(String(row.id));
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/** The kinds of the aggregate, each with the kind of record it sits under. */
const UNDER: Record<ViewKind, string> = { view: 'product', view_requirement: 'view', view_test: 'view_requirement' };

/** The next free ID for a record of one of the aggregate's kinds under its parent: one past the highest in use. */
export function nextViewId(view: ReadView, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the View aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as ViewKind;
  const parent = view.record(input.parent);
  if (parent?.kind !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  switch (kind) {
    case 'view':
      return onePast(view, 'view', `${input.parent}-V`);
    case 'view_requirement':
      return onePast(view, 'view_requirement', `${input.parent}-R`);
    case 'view_test':
      return onePast(view, 'view_test', `${input.parent}-T`);
  }
}

/** Get the next ID in a view (LA-AUT-QRY192). */
export const NEXT_VIEW_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
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
  run: nextViewId,
  text: (next) => next,
};

/** A view as text: its row, then each requirement with its tests. */
function viewText(page: ViewPage): string {
  const lines = [`View ${page.id}: ${page.title}`, ...(page.route ? [`  route: ${page.route}`] : []), `  description: ${page.description}`];
  if (page.notes) lines.push(`  notes: ${page.notes}`);
  for (const r of page.requirements) {
    lines.push(`View requirement ${r.id}: ${r.title}`);
    for (const t of r.tests) lines.push(`  view test ${t.id}: ${t.title} (${t.state})`);
  }
  return lines.join('\n');
}

/** The View aggregate's queries, as the CLI and the MCP server register them. */
export const VIEW_QUERIES: readonly AnyQuery[] = [GET_VIEW, LIST_VIEWS, NEXT_VIEW_ID];
