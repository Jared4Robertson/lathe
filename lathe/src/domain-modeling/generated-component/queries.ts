// The Generated component aggregate's own reads (read model LA-MOD-RM45): a generated component's page, the generated components of a domain, and the next free
// ID for one. Each reads only the read model, through its reader (reader.ts), and changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { GeneratedComponentPage, GeneratedComponentSummary } from './read-model.ts';
import { generatedComponentReader, type GeneratedComponentReader } from './reader.ts';
import { GET_GENERATED_COMPONENT_IDENTITY, LIST_GENERATED_COMPONENTS_IDENTITY, NEXT_GENERATED_COMPONENT_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The generated component with this ID, whole. */
export function getGeneratedComponent(reader: GeneratedComponentReader, input: { id: string }): GeneratedComponentPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (kind !== 'generated_component') refuse('kind', `${input.id} is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}, not a generated component`);
  return reader.page(input.id)!;
}

/** Get a generated component (LA-MOD-QRY231). */
export const GET_GENERATED_COMPONENT: QueryDefinition<{ id: string }, GeneratedComponentPage, GeneratedComponentReader> = {
  ...GET_GENERATED_COMPONENT_IDENTITY,
  input: { id: id('The generated component.', 'required') },
  reader: generatedComponentReader,
  run: getGeneratedComponent,
  text: generatedComponentText,
};

/** The generated components of a domain, by ID. */
export function listGeneratedComponents(reader: GeneratedComponentReader, input: { domain_id: string }): GeneratedComponentSummary[] {
  if (reader.kindOf(input.domain_id) !== 'domain') refuse('missing', `there is no domain ${input.domain_id}`);
  return reader.list(input.domain_id);
}

/** List a domain's generated components (LA-MOD-QRY232). */
export const LIST_GENERATED_COMPONENTS: QueryDefinition<{ domain_id: string }, GeneratedComponentSummary[], GeneratedComponentReader> = {
  ...LIST_GENERATED_COMPONENTS_IDENTITY,
  input: { domain_id: id('The domain.', 'required') },
  reader: generatedComponentReader,
  run: listGeneratedComponents,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No generated components.'),
};

/** The next free ID for a generated component of the domain: its domain's ID and its letters, one past the highest number in use. */
export function nextGeneratedComponentId(reader: GeneratedComponentReader, input: { domain_id: string }): string {
  const shape = reader.idShape('generated_component');
  if (reader.kindOf(input.domain_id) !== shape.parents[0]) refuse('parent', `a generated component sits under a domain, and ${input.domain_id} is not one`);
  return onePast(reader, `${input.domain_id}-${shape.letters}`, shape);
}

/** Get the next generated component ID (LA-MOD-QRY233). */
export const NEXT_GENERATED_COMPONENT_ID: QueryDefinition<{ domain_id: string }, string, GeneratedComponentReader> = {
  ...NEXT_GENERATED_COMPONENT_ID_IDENTITY,
  input: { domain_id: id('The domain it will sit under.', 'required') },
  reader: generatedComponentReader,
  run: nextGeneratedComponentId,
  text: (next) => next,
};

/** A generated component as text: its row, what it serves, then the guarantees it makes. */
function generatedComponentText(page: GeneratedComponentPage): string {
  const row = page.generatedComponent;
  const lines = [`Generated component ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, `  description: ${row.description}`];
  if (page.serves.length) lines.push(`  serves: ${page.serves.join(', ')}`);
  for (const g of page.guarantees) lines.push(`Guarantee ${g.id}: ${g.title}`);
  return lines.join('\n');
}
