// The UI component aggregate's own reads, each answered from its read model (LA-AUT-RM35) through its reader
// (reader.ts), which the query runner gives each handler: a UI component whole, the UI components of a product, and
// the next free ID for one. A handler never sees the data, a repository or the model; each changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { UI_COMPONENT_SLICE } from './model.ts';
import type { UiComponentPage, UiComponentSummary } from './read-model.ts';
import { uiComponentReader, type UiComponentReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The UI component with the ID, whole. */
export function getUiComponent(reader: UiComponentReader, input: { id: string }): UiComponentPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}, not a UI component`);
}

/** GET a UI component whole (LA-AUT-QRY204). */
export const GET_UI_COMPONENT: QueryDefinition<{ id: string }, UiComponentPage, UiComponentReader> = {
  id: 'LA-AUT-QRY204',
  slice: UI_COMPONENT_SLICE,
  name: 'get-ui-component',
  method: 'GET',
  route: '/api/ui-component/get-ui-component',
  description: "Reads a UI component whole as its page shows it: the record asked for and its kind, the component's row, and the views it renders, the view requirements it builds, the standard rules it meets and the packages it uses, each list sorted.",
  input: { id: id('The UI component.', 'required') },
  reader: uiComponentReader,
  run: getUiComponent,
  text: (c) => {
    const { component: row } = c;
    const lines = [`UI component ${row.id}: ${row.title}`, ...(row.file ? [`  file: ${row.file}`] : []), `  description: ${row.description}`];
    if (c.renders.length) lines.push(`  renders: ${c.renders.join(', ')}`);
    if (c.builds.length) lines.push(`  builds: ${c.builds.join(', ')}`);
    if (c.meets.length) lines.push(`  meets: ${c.meets.join(', ')}`);
    if (c.packages.length) lines.push(`  uses: ${c.packages.join(', ')}`);
    return lines.join('\n');
  },
};

/** The UI components of a product, by ID: those whose ID is the product's, UI and a number. */
export function listUiComponents(reader: UiComponentReader, input: { product_id: string }): UiComponentSummary[] {
  return reader.componentsOf(input.product_id) ?? refuse('missing', `there is no product ${input.product_id}`);
}

/** List the UI components of a product (LA-AUT-QRY205). */
export const LIST_UI_COMPONENTS: QueryDefinition<{ product_id: string }, UiComponentSummary[], UiComponentReader> = {
  id: 'LA-AUT-QRY205',
  slice: UI_COMPONENT_SLICE,
  name: 'list-ui-components',
  method: 'GET',
  route: '/api/ui-component/list-ui-components',
  description: 'Lists the UI components of a product, by ID, with their titles.',
  input: { product_id: id('The product.', 'required') },
  reader: uiComponentReader,
  run: listUiComponents,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No UI components.'),
};

/** The next free ID for a UI component of the product: one past the highest in use. */
export function nextUiComponentId(reader: UiComponentReader, input: { product_id: string }): string {
  const shape = reader.idShape('ui_component');
  if (reader.kindOf(input.product_id) !== shape.parents[0]) refuse('missing', `there is no product ${input.product_id}`);
  return onePast(reader, `${input.product_id}-${shape.letters}`, shape);
}

/** Get the next ID for a UI component (LA-AUT-QRY206). */
export const NEXT_UI_COMPONENT_ID: QueryDefinition<{ product_id: string }, string, UiComponentReader> = {
  id: 'LA-AUT-QRY206',
  slice: UI_COMPONENT_SLICE,
  name: 'next-id',
  method: 'GET',
  route: '/api/ui-component/next-id',
  description: "The next free ID for a UI component of a product: one past the highest in use.",
  input: { product_id: id('The product.', 'required') },
  reader: uiComponentReader,
  run: nextUiComponentId,
  text: (next) => next,
};

/** The UI component aggregate's queries, as the CLI and the MCP server register them. */
export const UI_COMPONENT_QUERIES: readonly AnyQuery[] = [GET_UI_COMPONENT, LIST_UI_COMPONENTS, NEXT_UI_COMPONENT_ID];
