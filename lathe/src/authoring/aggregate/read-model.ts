// The Aggregate aggregate's read model (LA-AUT-RM26), shaped for its readers: the Aggregate page reads an aggregate
// whole (its entities, root first, each with its fields, the entities it holds, its data model, the commands that
// change it and its tables; its invariants, each with its test; the domain events that happen to it, each with the
// commands that raise it and the policies that hear it) with the record the page is about, a domain's list reads each
// aggregate's ID and title, and the editor's next ID reads the IDs in use. The projection (aggregateTableFrom) is the
// only code that reads the source rows and the only code that writes the read model's table; the query handlers read
// that table only through the reader (reader.ts). Nothing here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { AggregateRow, DataModelRow, DomainEventRow, EntityFieldRow, EntityRow, InvariantRow, InvariantTestRow } from '../../platform/data/tables.ts';
import type { AggregateKind } from './model.ts';

/** A data model as the page shows it: its row, the standard rules it meets and the packages it uses. */
export interface DataModelOnPage {
  dataModel: DataModelRow;
  meets: string[];
  packages: string[];
}

/** An entity as the page shows it: its row, its fields in order, the entities it holds, its data model, and the commands and tables under it by ID. */
export interface EntityOnPage {
  entity: EntityRow;
  fields: EntityFieldRow[];
  /** The entities of its aggregate it holds exactly one of. */
  hasOne: string[];
  /** The entities of its aggregate it holds any number of. */
  hasMany: string[];
  dataModel: DataModelOnPage | null;
  /** The commands that change it (the Command aggregate's roots). */
  commands: string[];
  /** The tables that store it (the Table aggregate's roots). */
  tables: string[];
}

/** An invariant test as the page shows it: its row and the test data sets it starts from. */
export interface InvariantTestOnPage {
  test: InvariantTestRow;
  startsFrom: string[];
}

/** An invariant as the page shows it: its row and its test. */
export interface InvariantOnPage {
  invariant: InvariantRow;
  test: InvariantTestOnPage | null;
}

/** A domain event of the aggregate as its page lists it: the event, the commands that raise it and the policies that hear it. */
export interface EventOnPage {
  event: Pick<DomainEventRow, 'id' | 'title' | 'published'>;
  raisedBy: string[];
  heardBy: string[];
}

/** An aggregate whole, as its page shows it. */
export interface AggregateTree {
  aggregate: AggregateRow;
  /** Its entities, the root first, then by ID. */
  entities: EntityOnPage[];
  /** Its invariants, by ID. */
  invariants: InvariantOnPage[];
  /** The domain events that happen to it (the Domain event aggregate's roots), by ID. */
  domainEvents: EventOnPage[];
}

/** An aggregate as its page reads it, with the record of it the page is about. */
export interface AggregatePage extends AggregateTree {
  record: { id: string; kind: AggregateKind };
}

/** An aggregate as a domain's list reads it. */
export interface AggregateSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface AggregateTable {
  /** Each aggregate whole, by its ID. */
  aggregates: Map<string, AggregateTree>;
  /** Each record inside an aggregate: the aggregate that holds it and its kind there. */
  holding: Map<string, { root: string; kind: AggregateKind }>;
  /** Each domain's aggregates, by ID; a domain with none has an empty list. */
  domains: Map<string, AggregateSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

const byId = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's sources or targets, by the other end, each list sorted. */
function linked(view: ReadView, table: string, by: string, to: string): (id: string) => string[] {
  const found = grouped<Row>(view.rows(table), by);
  return (id) => (found.get(id) ?? []).map((l) => String(l[to])).sort(byId);
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function aggregateTableFrom(view: ReadView): AggregateTable {
  const [hasOne, hasMany, meets, startsFrom] = ['has_one', 'has_many', 'meets', 'starts_from'].map((t) => linked(view, t, 'source_id', 'target_id'));
  const raisedBy = linked(view, 'raises', 'target_id', 'source_id');
  const heardBy = linked(view, 'hears', 'target_id', 'source_id');
  const packages = linked(view, 'package_use', 'record_id', 'package');
  const entities = grouped<EntityRow>(view.rows('entity'), 'aggregate_id');
  const fields = grouped<EntityFieldRow>(view.rows('entity_field'), 'entity_id');
  const dataModels = grouped<DataModelRow>(view.rows('data_model'), 'entity_id');
  const commands = grouped<{ id: string }>(view.rows('command'), 'entity_id');
  const tables = grouped<{ id: string }>(view.rows('table'), 'entity_id');
  const invariants = grouped<InvariantRow>(view.rows('invariant'), 'aggregate_id');
  const tests = grouped<InvariantTestRow>(view.rows('invariant_test'), 'invariant_id');
  const events = grouped<DomainEventRow>(view.rows('domain_event'), 'aggregate_id');

  const aggregates = new Map<string, AggregateTree>();
  const holding = new Map<string, { root: string; kind: AggregateKind }>();
  const domains = new Map<string, AggregateSummary[]>(view.rows('domain').map((d) => [String(d.id), []]));
  for (const aggregate of view.rows('aggregate') as unknown as AggregateRow[]) {
    const root = aggregate.id;
    const hold = (id: string, kind: AggregateKind) => holding.set(id, { root, kind });
    hold(root, 'aggregate');
    const tree: AggregateTree = {
      aggregate,
      entities: [...(entities.get(root) ?? [])]
        .sort((a, b) => Number(b.role === 'root') - Number(a.role === 'root') || byId(a.id, b.id))
        .map((entity) => {
          const dataModel = (dataModels.get(entity.id) ?? [])[0];
          return {
            entity,
            fields: [...(fields.get(entity.id) ?? [])].sort((a, b) => a.position - b.position),
            hasOne: hasOne(entity.id),
            hasMany: hasMany(entity.id),
            dataModel: dataModel ? { dataModel, meets: meets(dataModel.id), packages: packages(dataModel.id) } : null,
            commands: (commands.get(entity.id) ?? []).map((c) => c.id).sort(byId),
            tables: (tables.get(entity.id) ?? []).map((t) => t.id).sort(byId),
          };
        }),
      invariants: [...(invariants.get(root) ?? [])].sort((a, b) => byId(a.id, b.id)).map((invariant) => {
        const test = (tests.get(invariant.id) ?? [])[0];
        return { invariant, test: test ? { test, startsFrom: startsFrom(test.id) } : null };
      }),
      domainEvents: [...(events.get(root) ?? [])].sort((a, b) => byId(a.id, b.id)).map((e) => ({
        event: { id: e.id, title: e.title, published: e.published },
        raisedBy: raisedBy(e.id),
        heardBy: heardBy(e.id),
      })),
    };
    for (const e of tree.entities) {
      hold(e.entity.id, 'entity');
      if (e.dataModel) hold(e.dataModel.dataModel.id, 'data_model');
    }
    for (const i of tree.invariants) {
      hold(i.invariant.id, 'invariant');
      if (i.test) hold(i.test.test.id, 'invariant_test');
    }
    aggregates.set(root, tree);
    domains.get(aggregate.domain_id)?.push({ id: aggregate.id, title: aggregate.title });
  }
  for (const list of domains.values()) list.sort((a, b) => byId(a.id, b.id));
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { aggregates, holding, domains, kinds };
}
