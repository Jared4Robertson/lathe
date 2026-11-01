// The Journey aggregate's own reads, each answered from its read model (LA-AUT-RM44) through its reader (reader.ts),
// which the query runner gives each handler: a journey whole as its page reads it, the journeys of a product, and the
// next free ID for a record of one of its kinds. A handler never sees the data, a repository or the aggregate's model;
// each changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { JourneyKind } from './model.ts';
import type { JourneyPage, JourneySummary } from './read-model.ts';
import { journeyReader, type JourneyReader } from './reader.ts';
import { GET_JOURNEY_IDENTITY, LIST_JOURNEYS_IDENTITY, NEXT_JOURNEY_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The journey that holds the record, as its page reads it: the journey itself, or one of its steps or its test. */
export function getJourney(reader: JourneyReader, input: { id: string }): JourneyPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}, not a journey or a record in one`);
}

/** Get a journey whole (LA-AUT-QRY228). */
export const GET_JOURNEY: QueryDefinition<{ id: string }, JourneyPage, JourneyReader> = {
  ...GET_JOURNEY_IDENTITY,
  input: { id: id('The journey, or a step or the test in it.', 'required') },
  reader: journeyReader,
  run: getJourney,
  text: journeyText,
};

/** The journeys of a product, by ID. */
export function listJourneys(reader: JourneyReader, input: { product_id: string }): JourneySummary[] {
  if (reader.kindOf(input.product_id) !== 'product') refuse('missing', `there is no product ${input.product_id}`);
  return reader.list(input.product_id);
}

/** List the journeys of a product (LA-AUT-QRY229). */
export const LIST_JOURNEYS: QueryDefinition<{ product_id: string }, JourneySummary[], JourneyReader> = {
  ...LIST_JOURNEYS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: journeyReader,
  run: listJourneys,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No journeys.'),
};

/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly JourneyKind[] = ['journey', 'journey_step', 'journey_test'];

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: one past the highest in use. A
 * journey sits under its product, a step under its journey; a journey has one journey test, whose ID is the journey's
 * and T.
 */
export function nextJourneyId(reader: JourneyReader, input: { kind: string; parent: string }): string {
  const kind = KINDS.find((k) => k === input.kind) ?? refuse('kind', `${input.kind} is not a kind of the Journey aggregate; its kinds are ${KINDS.join(', ')}`);
  const shape = reader.idShape(kind);
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== shape.parents[0]) refuse('parent', `a ${kind} sits under a ${shape.parents[0]}, and ${input.parent} is ${parentKind ? `a ${parentKind}` : 'no record'}`);
  if (kind === 'journey_test') {
    const one = `${input.parent}-${shape.letters}`;
    if (reader.kindOf(one)) refuse('exists', `${input.parent} already has its journey test, ${one}`);
    return one;
  }
  return onePast(reader, `${input.parent}-${shape.letters}`, shape);
}

/** Get the next ID for a record of the Journey aggregate (LA-AUT-QRY230). */
export const NEXT_JOURNEY_ID: QueryDefinition<{ kind: string; parent: string }, string, JourneyReader> = {
  ...NEXT_JOURNEY_ID_IDENTITY,
  input: {
    kind: id('The kind: journey, journey_step or journey_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  reader: journeyReader,
  run: nextJourneyId,
  text: (next) => next,
};

/** A journey as text: its row, the outcomes it serves, then its paths step by step and its test. */
function journeyText(page: JourneyPage): string {
  const { journey: row } = page;
  const lines = [`Journey ${row.id}: ${row.title}`, `  product: ${row.product_id}`, `  trigger: ${row.trigger}`, `  result: ${row.result}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  if (page.serves.length) lines.push(`  serves: ${page.serves.join(', ')}`);
  for (const path of page.paths) {
    lines.push(`Path ${path.name}:`);
    for (const { step, carriesOut } of path.steps) {
      const what = carriesOut === null ? 'carries out nothing yet' : carriesOut.kind === 'use_case' ? `carries out ${carriesOut.id} ${carriesOut.title} (${carriesOut.actors.join(', ')}; ${carriesOut.capability.title}, ${carriesOut.domain.title})` : `hands off by ${carriesOut.id} ${carriesOut.title} (${carriesOut.hears ? `hears ${carriesOut.hears.title}, ` : ''}sends ${carriesOut.sends.title}; ${carriesOut.domain.title})`;
      lines.push(`  ${step.position}. ${step.id}: ${step.title} [${what}]`);
    }
  }
  if (page.test) lines.push(`Journey test ${page.test.test.id}: ${page.test.test.title} (${page.test.test.state})`);
  return lines.join('\n');
}
