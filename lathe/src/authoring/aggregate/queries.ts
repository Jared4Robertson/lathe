// The Aggregate aggregate's own reads (read model LA-AUT-RM26): an aggregate whole, the aggregates of a domain, and the
// next free ID for a record of one of its kinds. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { AGGREGATE_KINDS, AGGREGATE_SLICE, aggregatesFrom, type Aggregate, type AggregateKind } from './model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The aggregate that holds the record: the aggregate itself, or one of its entities, invariants, data models or tests. */
export function getAggregate(view: ReadView, input: { id: string }): Aggregate {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (!(record.kind in AGGREGATE_KINDS)) refuse('kind', `${input.id} is ${/^[aeiou]/.test(record.kind) ? 'an' : 'a'} ${record.kind}, not an aggregate or a record in one`);
  let at = record;
  while (at.kind !== 'aggregate') {
    const column = AGGREGATE_KINDS[at.kind as Exclude<AggregateKind, 'aggregate'>];
    at = view.record(String(at.row[column]))!;
  }
  return aggregatesFrom((table) => view.rows(table), String(at.row.id))[0];
}

/** GET an aggregate whole (LA-AUT-QRY150). */
export const GET_AGGREGATE: QueryDefinition<{ id: string }, Aggregate> = {
  id: 'LA-AUT-QRY150',
  slice: AGGREGATE_SLICE,
  name: 'get-aggregate',
  description: 'Reads an aggregate whole, by its ID or the ID of any record in it: its row, its entities with their fields and the entities they hold, their data models, and its invariants with their tests.',
  method: 'GET',
  route: '/api/aggregate/get-aggregate',
  input: { id: id('The aggregate, or an entity, invariant, data model or invariant test in it.', 'required') },
  run: getAggregate,
  text: aggregateText,
};

/** The aggregates of a domain, by ID. */
export function listAggregates(view: ReadView, input: { domain_id: string }): { id: string; title: string }[] {
  if (view.record(input.domain_id)?.kind !== 'domain') refuse('missing', `there is no domain ${input.domain_id}`);
  return view
    .rows('aggregate')
    .filter((a) => a.domain_id === input.domain_id)
    .map((a) => ({ id: String(a.id), title: String(a.title) }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** List the aggregates of a domain (LA-AUT-QRY151). */
export const LIST_AGGREGATES: QueryDefinition<{ domain_id: string }, { id: string; title: string }[]> = {
  id: 'LA-AUT-QRY151',
  slice: AGGREGATE_SLICE,
  name: 'list-aggregates',
  description: 'Lists the aggregates of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/aggregate/list-aggregates',
  input: { domain_id: id('The domain.', 'required') },
  run: listAggregates,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No aggregates.'),
};

// One past the highest number in use after the prefix among the kind's records, padded to the width given.
function onePast(view: ReadView, kind: string, prefix: string, width: number): string {
  const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let highest = 0;
  for (const row of view.rows(kind)) {
    const m = shape.exec(String(row.id));
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `${prefix}${String(highest + 1).padStart(width, '0')}`;
}

/** The kinds of the aggregate, each with the kind of record it sits under. */
const UNDER: Record<AggregateKind, string> = {
  aggregate: 'domain',
  entity: 'aggregate',
  invariant: 'aggregate',
  data_model: 'entity',
  invariant_test: 'invariant',
};

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: one past the highest in use. An
 * aggregate's, an entity's and an invariant's start with their domain's ID; an entity has one data model and an
 * invariant one test, whose IDs are their parent's with DM and T.
 */
export function nextAggregateId(view: ReadView, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Aggregate aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as AggregateKind;
  const parent = view.record(input.parent);
  if (parent?.kind !== UNDER[kind]) refuse('parent', `${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind} sits under ${/^[aeiou]/.test(UNDER[kind]) ? 'an' : 'a'} ${UNDER[kind]}, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  const only = (id: string) => {
    if (view.record(id)) refuse('exists', `${input.parent} already has its ${kind.replace('_', ' ')}, ${id}`);
    return id;
  };
  switch (kind) {
    case 'aggregate':
      return onePast(view, 'aggregate', `${input.parent}-A`, 1);
    case 'entity':
      return onePast(view, 'entity', `${parent!.row.domain_id}-EN`, 2);
    case 'invariant':
      return onePast(view, 'invariant', `${parent!.row.domain_id}-INV`, 2);
    case 'data_model':
      return only(`${input.parent}-DM`);
    case 'invariant_test':
      return only(`${input.parent}-T`);
  }
}

/** Get the next ID for a record of the Aggregate aggregate (LA-AUT-QRY152). */
export const NEXT_AGGREGATE_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
  id: 'LA-AUT-QRY152',
  slice: AGGREGATE_SLICE,
  name: 'next-id',
  description: 'The next free ID for an aggregate (under a domain), an entity or invariant (under an aggregate), a data model (under an entity) or an invariant test (under an invariant): one past the highest in use.',
  method: 'GET',
  route: '/api/aggregate/next-id',
  input: {
    kind: id('The kind: aggregate, entity, invariant, data_model or invariant_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  run: nextAggregateId,
  text: (next) => next,
};

/** An aggregate as text: its row, then each entity with its fields, links and data model, then each invariant and test. */
function aggregateText(aggregate: Aggregate): string {
  const { aggregate: row } = aggregate;
  const lines = [`Aggregate ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, `  identity: ${row.identity}`, `  description: ${row.description}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  for (const e of aggregate.entities) {
    const links = [...e.hasOne.map((x) => `has one ${x}`), ...e.hasMany.map((x) => `has many ${x}`)];
    lines.push(`Entity ${e.row.id}: ${e.row.title} (${e.row.role}${e.row.in_root_table ? ', in its root\'s table' : ''})${links.length ? ` [${links.join('; ')}]` : ''}`);
    for (const f of e.fields) {
      const type = f.type ?? f.type_value_object_id ?? f.type_aggregate_id;
      lines.push(`  ${f.position}. ${f.name}: ${type}${f.required ? ', required' : ''}${f.column_name ? `, column ${f.column_name}` : ''}`);
    }
    for (const d of aggregate.dataModels.filter((x) => x.row.entity_id === e.row.id)) {
      const extra = [...(d.row.file ? [d.row.file] : []), ...d.meets.map((x) => `meets ${x}`), ...d.packages.map((x) => `uses ${x}`)];
      lines.push(`  data model ${d.row.id}: ${d.row.title}${extra.length ? ` [${extra.join('; ')}]` : ''}`);
    }
  }
  for (const i of aggregate.invariants) {
    lines.push(`Invariant ${i.id}: ${i.title}`);
    for (const t of aggregate.invariantTests.filter((x) => x.row.invariant_id === i.id)) lines.push(`  invariant test ${t.row.id}: ${t.row.title} (${t.row.state})`);
  }
  return lines.join('\n');
}

/** The Aggregate aggregate's queries, as the CLI and the MCP server register them. */
export const AGGREGATE_QUERIES: readonly AnyQuery[] = [GET_AGGREGATE, LIST_AGGREGATES, NEXT_AGGREGATE_ID];
