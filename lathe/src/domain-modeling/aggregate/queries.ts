// The Aggregate aggregate's own reads, each answered from its read model (LA-MOD-RM26) through its reader (reader.ts),
// which the query runner gives each handler: an aggregate whole as its page reads it, the aggregates of a domain, and
// the next free ID for a record of one of its kinds. A handler never sees the data, a repository or the aggregate's
// model; each changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { AggregateKind } from './model.ts';
import type { AggregatePage, AggregateSummary } from './read-model.ts';
import { aggregateReader, type AggregateReader } from './reader.ts';
import { GET_AGGREGATE_IDENTITY, LIST_AGGREGATES_IDENTITY, NEXT_AGGREGATE_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (word: string) => (/^[aeiou]/.test(word) ? 'an' : 'a');

/** The aggregate that holds the record, as its page reads it: the aggregate itself, or one of its entities, invariants, data models or tests. */
export function getAggregate(reader: AggregateReader, input: { id: string }): AggregatePage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not an aggregate or a record in one`);
}

/** GET an aggregate whole (LA-MOD-QRY150). */
export const GET_AGGREGATE: QueryDefinition<{ id: string }, AggregatePage, AggregateReader> = {
  ...GET_AGGREGATE_IDENTITY,
  input: { id: id('The aggregate, or an entity, invariant, data model, rule or invariant test in it.', 'required') },
  reader: aggregateReader,
  run: getAggregate,
  text: aggregateText,
};

/** The aggregates of a domain, by ID. */
export function listAggregates(reader: AggregateReader, input: { domain_id: string }): AggregateSummary[] {
  return reader.aggregatesOf(input.domain_id) ?? refuse('missing', `there is no domain ${input.domain_id}`);
}

/** List the aggregates of a domain (LA-MOD-QRY151). */
export const LIST_AGGREGATES: QueryDefinition<{ domain_id: string }, AggregateSummary[], AggregateReader> = {
  ...LIST_AGGREGATES_IDENTITY,
  input: { domain_id: id('The domain.', 'required') },
  reader: aggregateReader,
  run: listAggregates,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No aggregates.'),
};

/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly string[] = ['aggregate', 'entity', 'invariant', 'data_model', 'rule', 'invariant_test'];

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: one past the highest in use. An
 * aggregate's, an entity's and an invariant's start with their domain's ID; an entity has one data model and an
 * invariant one rule and one test, whose IDs are their parent's with DM, RL and T.
 */
export function nextAggregateId(reader: AggregateReader, input: { kind: string; parent: string }): string {
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Aggregate aggregate; its kinds are ${KINDS.join(', ')}`);
  const kind = input.kind as AggregateKind;
  const shape = reader.idShape(kind);
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== shape.parents[0]) refuse('parent', `${article(kind)} ${kind} sits under ${article(shape.parents[0])} ${shape.parents[0]}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  const only = (id: string) => {
    if (reader.kindOf(id)) refuse('exists', `${input.parent} already has its ${kind.replace('_', ' ')}, ${id}`);
    return id;
  };
  switch (kind) {
    case 'aggregate':
      return onePast(reader, `${input.parent}-${shape.letters}`, shape);
    case 'entity':
      return onePast(reader, `${reader.domainOf(input.parent)}-${shape.letters}`, shape);
    case 'invariant':
      return onePast(reader, `${reader.domainOf(input.parent)}-${shape.letters}`, shape);
    case 'data_model':
      return only(`${input.parent}-${shape.letters}`);
    case 'rule':
      return only(`${input.parent}-${shape.letters}`);
    case 'invariant_test':
      return only(`${input.parent}-${shape.letters}`);
  }
}

/** Get the next ID for a record of the Aggregate aggregate (LA-MOD-QRY152). */
export const NEXT_AGGREGATE_ID: QueryDefinition<{ kind: string; parent: string }, string, AggregateReader> = {
  ...NEXT_AGGREGATE_ID_IDENTITY,
  input: {
    kind: id('The kind: aggregate, entity, invariant, data_model, rule or invariant_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  reader: aggregateReader,
  run: nextAggregateId,
  text: (next) => next,
};

/** An aggregate as text: its row, then each entity with its fields, links and data model, then each invariant with its rule and test, then its events. */
function aggregateText(page: AggregatePage): string {
  const { aggregate: row } = page;
  const lines = [`Aggregate ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, `  identity: ${row.identity}`, `  description: ${row.description}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  if (page.serves.length) lines.push(`  serves: ${page.serves.join(', ')}`);
  for (const e of page.entities) {
    const links = [...e.hasOne.map((x) => `has one ${x}`), ...e.hasMany.map((x) => `has many ${x}`)];
    lines.push(`Entity ${e.entity.id}: ${e.entity.title} (${e.entity.role}${e.entity.in_root_table ? ', in its root\'s table' : ''})${links.length ? ` [${links.join('; ')}]` : ''}`);
    for (const f of e.fields) {
      const type = f.type ?? f.type_value_object_id ?? f.type_aggregate_id;
      lines.push(`  ${f.position}. ${f.name}: ${type}${f.required ? ', required' : ''}${f.column_name ? `, column ${f.column_name}` : ''}`);
    }
    const d = e.dataModel;
    if (d) {
      const extra = [...(d.dataModel.file ? [d.dataModel.file] : []), ...d.meets.map((x) => `meets ${x}`), ...d.packages.map((x) => `uses ${x}`), ...d.helpers.map((x) => `helper file ${x}`)];
      lines.push(`  data model ${d.dataModel.id}: ${d.dataModel.title}${extra.length ? ` [${extra.join('; ')}]` : ''}`);
    }
  }
  for (const i of page.invariants) {
    lines.push(`Invariant ${i.invariant.id}: ${i.invariant.title}`);
    const r = i.rule;
    if (r) {
      const extra = [...(r.rule.file ? [r.rule.file] : []), ...r.meets.map((x) => `meets ${x}`), ...r.packages.map((x) => `uses ${x}`), ...r.helpers.map((x) => `helper file ${x}`)];
      lines.push(`  rule ${r.rule.id}: ${r.rule.title}${extra.length ? ` [${extra.join('; ')}]` : ''}`);
    }
    if (i.test) lines.push(`  invariant test ${i.test.test.id}: ${i.test.test.title} (${i.test.test.state})`);
  }
  for (const e of page.domainEvents) lines.push(`Domain event ${e.event.id}: ${e.event.title}${e.raisedBy.length ? ` [raised by ${e.raisedBy.join(', ')}]` : ''}`);
  return lines.join('\n');
}
