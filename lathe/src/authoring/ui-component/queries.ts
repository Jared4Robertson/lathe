// The UI component aggregate's own reads (read model LA-AUT-RM35): a UI component whole, the UI components of a
// product, and the next free ID for one. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { UI_COMPONENT_SLICE } from './model.ts';
import { uiComponentPageFrom, uiComponentSummariesFrom, type UiComponentPage, type UiComponentSummary } from './read-model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The UI component with the ID, whole. */
export function getUiComponent(view: ReadView, input: { id: string }): UiComponentPage {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (record.kind !== 'ui_component') refuse('kind', `${input.id} is ${/^[aeiou]/.test(record.kind) ? 'an' : 'a'} ${record.kind}, not a UI component`);
  return uiComponentPageFrom((table) => view.rows(table), input.id)!;
}

/** GET a UI component whole (LA-AUT-QRY204). */
export const GET_UI_COMPONENT: QueryDefinition<{ id: string }, UiComponentPage> = {
  id: 'LA-AUT-QRY204',
  slice: UI_COMPONENT_SLICE,
  name: 'get-ui-component',
  method: 'GET',
  route: '/api/ui-component/get-ui-component',
  description: 'Reads a UI component whole: its row, the views it renders, the standard rules it meets and the packages it uses.',
  input: { id: id('The UI component.', 'required') },
  run: getUiComponent,
  text: (c) => {
    const lines = [`UI component ${c.id}: ${c.title}`, ...(c.file ? [`  file: ${c.file}`] : []), `  description: ${c.description}`];
    if (c.renders.length) lines.push(`  renders: ${c.renders.join(', ')}`);
    if (c.meets.length) lines.push(`  meets: ${c.meets.join(', ')}`);
    if (c.packages.length) lines.push(`  uses: ${c.packages.join(', ')}`);
    return lines.join('\n');
  },
};

/** The UI components of a product, by ID: those whose ID starts with the product's. */
export function listUiComponents(view: ReadView, input: { product_id: string }): UiComponentSummary[] {
  if (view.record(input.product_id)?.kind !== 'product') refuse('missing', `there is no product ${input.product_id}`);
  return uiComponentSummariesFrom((table) => view.rows(table), input.product_id);
}

/** List the UI components of a product (LA-AUT-QRY205). */
export const LIST_UI_COMPONENTS: QueryDefinition<{ product_id: string }, UiComponentSummary[]> = {
  id: 'LA-AUT-QRY205',
  slice: UI_COMPONENT_SLICE,
  name: 'list-ui-components',
  method: 'GET',
  route: '/api/ui-component/list-ui-components',
  description: 'Lists the UI components of a product, by ID, with their titles.',
  input: { product_id: id('The product.', 'required') },
  run: listUiComponents,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No UI components.'),
};

/** The next free ID for a UI component of the product: one past the highest in use. */
export function nextUiComponentId(view: ReadView, input: { product_id: string }): string {
  if (view.record(input.product_id)?.kind !== 'product') refuse('missing', `there is no product ${input.product_id}`);
  const prefix = `${input.product_id}-UI`;
  let highest = 0;
  for (const row of view.rows('ui_component')) {
    const m = /^(.*)-UI(\d+)$/.exec(String(row.id));
    if (m && m[1] === input.product_id) highest = Math.max(highest, Number(m[2]));
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/** Get the next ID for a UI component (LA-AUT-QRY206). */
export const NEXT_UI_COMPONENT_ID: QueryDefinition<{ product_id: string }, string> = {
  id: 'LA-AUT-QRY206',
  slice: UI_COMPONENT_SLICE,
  name: 'next-id',
  method: 'GET',
  route: '/api/ui-component/next-id',
  description: "The next free ID for a UI component of a product: one past the highest in use.",
  input: { product_id: id('The product.', 'required') },
  run: nextUiComponentId,
  text: (next) => next,
};

/** The UI component aggregate's queries, as the CLI and the MCP server register them. */
export const UI_COMPONENT_QUERIES: readonly AnyQuery[] = [GET_UI_COMPONENT, LIST_UI_COMPONENTS, NEXT_UI_COMPONENT_ID];
