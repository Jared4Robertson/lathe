// The View aggregate's own reads, each answered from its read model (LA-AUT-RM32) through its reader (reader.ts), which
// the query runner gives each handler: a view whole, the views of a product, and the next free ID for a record of one
// of its kinds. A handler never sees the data, a repository or the aggregate's model; each changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { type ViewKind } from './model.ts';
import type { ViewPage, ViewSummary } from './read-model.ts';
import { viewReader, type ViewReader } from './reader.ts';
import { GET_VIEW_IDENTITY, LIST_VIEWS_IDENTITY, NEXT_VIEW_ID_IDENTITY } from './queries.generated.ts';

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
  ...GET_VIEW_IDENTITY,
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
  ...LIST_VIEWS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: viewReader,
  run: listViews,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No views.'),
};

/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly ViewKind[] = ['view', 'view_requirement', 'view_test'];

/** The next free ID for a record of one of the aggregate's kinds under its parent: one past the highest in use. */
export function nextViewId(reader: ViewReader, input: { kind: string; parent: string }): string {
  if (!KINDS.includes(input.kind as ViewKind)) refuse('kind', `${input.kind} is not a kind of the View aggregate; its kinds are ${KINDS.join(', ')}`);
  const kind = input.kind as ViewKind;
  const shape = reader.idShape(kind);
  const parent = reader.kindOf(input.parent);
  if (parent !== shape.parents[0]) refuse('parent', `a ${kind} sits under a ${shape.parents[0]}, and ${input.parent} is ${parent ? `${a(parent)} ${parent}` : 'no record'}`);
  return onePast(reader, `${input.parent}-${shape.letters}`, shape);
}

/** Get the next ID in a view (LA-AUT-QRY192). */
export const NEXT_VIEW_ID: QueryDefinition<{ kind: string; parent: string }, string, ViewReader> = {
  ...NEXT_VIEW_ID_IDENTITY,
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
