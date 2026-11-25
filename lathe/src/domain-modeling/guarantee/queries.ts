// The Guarantee aggregate's own reads, each answered from its read model (LA-MOD-RM44) through its reader (reader.ts),
// which the query runner gives each handler: a guarantee whole as its page reads it, the guarantees of a maker, and
// the next free ID for a guarantee or a guarantee test. A handler never sees the data, a repository or the aggregate's
// model; each changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { GuaranteePage, GuaranteeSummary } from './read-model.ts';
import { guaranteeReader, type GuaranteeReader } from './reader.ts';
import { GET_GUARANTEE_IDENTITY, LIST_GUARANTEES_IDENTITY, NEXT_GUARANTEE_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The guarantee that holds the record, as its page reads it: the guarantee itself, or one of its tests. */
export function getGuarantee(reader: GuaranteeReader, input: { id: string }): GuaranteePage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a guarantee or a record in one`);
}

/** GET a guarantee whole (LA-MOD-QRY228). */
export const GET_GUARANTEE: QueryDefinition<{ id: string }, GuaranteePage, GuaranteeReader> = {
  ...GET_GUARANTEE_IDENTITY,
  input: { id: id('The guarantee, or one of its tests.', 'required') },
  reader: guaranteeReader,
  run: getGuarantee,
  text: guaranteeText,
};

/** The guarantees of a maker, by ID. */
export function listGuarantees(reader: GuaranteeReader, input: { maker_id: string }): GuaranteeSummary[] {
  return reader.guaranteesOf(input.maker_id) ?? refuse('missing', `there is no domain, generated component or library ${input.maker_id}`);
}

/** List a maker's guarantees (LA-MOD-QRY229). */
export const LIST_GUARANTEES: QueryDefinition<{ maker_id: string }, GuaranteeSummary[], GuaranteeReader> = {
  ...LIST_GUARANTEES_IDENTITY,
  input: { maker_id: id('The maker: a platform domain, a generated component or a library.', 'required') },
  reader: guaranteeReader,
  run: listGuarantees,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No guarantees.'),
};

/** The kinds of the aggregate; how each one's IDs are written the schema says (`idShape`). */
const KINDS: readonly string[] = ['guarantee', 'guarantee_test'];

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a guarantee's is its maker's ID, GU
 * and one past the highest number in use; a guarantee test's is its guarantee's ID, T and one past the highest.
 */
export function nextGuaranteeId(reader: GuaranteeReader, input: { kind: string; parent: string }): string {
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Guarantee aggregate; its kinds are ${KINDS.join(', ')}`);
  const shape = reader.idShape(input.kind);
  const parentKind = reader.kindOf(input.parent);
  if (parentKind === undefined || !shape.parents.includes(parentKind)) refuse('parent', `a ${input.kind} sits under ${shape.parents.map((p) => `${article(p)} ${p}`).join(' or ')}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  return onePast(reader, `${input.parent}-${shape.letters}`, shape);
}

/** Get the next ID for a record of the Guarantee aggregate (LA-MOD-QRY230). */
export const NEXT_GUARANTEE_ID: QueryDefinition<{ kind: string; parent: string }, string, GuaranteeReader> = {
  ...NEXT_GUARANTEE_ID_IDENTITY,
  input: {
    kind: id('The kind: guarantee or guarantee_test.', 'required'),
    parent: id('The record it will sit under: its maker for a guarantee (a platform domain, a generated component or a library), else the guarantee.', 'required'),
  },
  reader: guaranteeReader,
  run: nextGuaranteeId,
  text: (next) => next,
};

/** A guarantee as text: its row, the building blocks that keep it, then its tests. */
function guaranteeText(page: GuaranteePage): string {
  const { guarantee: row } = page;
  const lines = [`Guarantee ${row.id}: ${row.title}`, `  made by: ${page.maker.id}`, `  statement: ${row.statement}`];
  if (row.consumers) lines.push(`  consumers: ${row.consumers}`);
  if (row.group_name) lines.push(`  group: ${row.group_name}`);
  if (page.keptBy.length) lines.push(`  kept by: ${page.keptBy.join(', ')}`);
  if (page.meets.length) lines.push(`  meets: ${page.meets.join(', ')}`);
  for (const { test, startsFrom } of page.tests) {
    lines.push(`Guarantee test ${test.id}: ${test.title} (${test.level}, ${test.state})${startsFrom.length ? ` [${startsFrom.map((x) => `starts from ${x}`).join('; ')}]` : ''}`);
  }
  return lines.join('\n');
}
