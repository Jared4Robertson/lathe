// Serves reach (LA-TRC-DS06): the outcomes each record serves, worked out from the rows and never stored. A record
// serves a business outcome when a use case whose capability serves that outcome reaches it. A use case reaches:
// - itself, its UC requirements, its flows and their steps;
// - what its steps invoke: a command, and through it its entity's aggregate, the specifications it checks, the domain
//   services it calls and the events it raises, with each policy that hears one and that policy's command, reached in
//   turn; a query, and through it its read model, the specifications it selects by and the domain services it calls;
// - the views that present what its steps invoke, their view requirements and the UI components that render the view or build one of
//   its requirements; the integrations its steps exchange with;
// - the endpoints that expose a reached command or query, and their API requirements;
// - the rules of the patterns it follows, its domain follows, or an interface that offers it follows;
// and from what that reaches: an aggregate's entities, invariants and storage requirements and the value objects its
// fields hold (with their constraints); a read model's storage requirements, the aggregates it reads and the value
// objects its fields hold; the aggregate a reached specification reads; the technical records that implement each
// reached record (its handler, repository, data model, table, projection, reader, rule, predicate, event handler,
// service, value type, event type, adapter); the standard rules those meet; the tests under each reached record; a
// product's own records under a reached one, a product's own obligation a reached record designs or builds, what a
// reached record links to through one of the product's own relations, and the product's own records that link to a
// reached one through one (a component listed in an aggregate, a CLI command exposing a command).
// The capability serves its outcomes directly. The engine fills record_serves with it before the checks run (the
// serves-no-outcome check reads it), and the Serves read model's projection (LA-TRC-RM12-PJ) answers from it.
import type { ReadView } from '../platform/data/rules.ts';
import type { Row } from '../platform/data/rows.ts';
import { compareIds } from '../platform/data/ids.ts';

/** What a record serves: the outcomes, and the use cases through which it serves them. */
export interface Served {
  outcomes: string[];
  useCases: string[];
}

const byId = (ids: Iterable<string>) => [...ids].sort(compareIds);

/** Rows grouped by one column's value: each key's values of another column. */
function index(rows: readonly Row[], key: string, value: string): Map<string, string[]> {
  const by = new Map<string, string[]>();
  for (const row of rows) {
    const k = row[key];
    const v = row[value];
    if (typeof k !== 'string' || typeof v !== 'string') continue;
    const list = by.get(k);
    if (list) list.push(v);
    else by.set(k, [v]);
  }
  return by;
}

/** What a use case reaches (itself included), and the outcomes its capability serves: none when it serves none. */
export interface UseCaseReach {
  outcomes: readonly string[];
  reached: ReadonlySet<string>;
}

/** Each record any use case reaches, with the outcomes it serves and the use cases through which it serves them. */
export function servesOf(view: Pick<ReadView, 'schema' | 'rows'>): Map<string, Served> {
  const served = new Map<string, { outcomes: Set<string>; useCases: Set<string> }>();
  const mark = (id: string, outcomes: readonly string[], useCase: string | null) => {
    const entry = served.get(id) ?? { outcomes: new Set<string>(), useCases: new Set<string>() };
    for (const o of outcomes) entry.outcomes.add(o);
    if (useCase) entry.useCases.add(useCase);
    served.set(id, entry);
  };
  // A capability serves its own outcomes.
  const rows = (table: string): Row[] => (view.schema.tables[table] ? view.rows(table) : []);
  const capabilities = new Set(rows('capability').map((c) => String(c.id)));
  for (const [capability, outcomes] of index(rows('serves'), 'source_id', 'target_id')) if (capabilities.has(capability)) mark(capability, outcomes, null);
  for (const [useCase, { outcomes, reached }] of useCaseReaches(view)) {
    if (outcomes.length === 0) continue;
    for (const id of reached) mark(id, outcomes, useCase);
  }
  return new Map([...served].map(([id, s]) => [id, { outcomes: byId(s.outcomes), useCases: byId(s.useCases) }]));
}

/** What each use case reaches by the Serves reach, with the outcomes its capability serves: every use case, serving an outcome or not. */
export function useCaseReaches(view: Pick<ReadView, 'schema' | 'rows'>): Map<string, UseCaseReach> {
  const { schema } = view;
  const rows = (table: string): Row[] => (schema.tables[table] ? view.rows(table) : []);
  const links = (relation: string) => rows(relation);
  const out = (relation: string) => index(links(relation), 'source_id', 'target_id');
  const into = (relation: string) => index(links(relation), 'target_id', 'source_id');
  const under = (table: string, column: string) => index(rows(table), column, 'id');
  const one = (table: string, column: string) => new Map(rows(table).filter((r) => typeof r[column] === 'string').map((r) => [String(r.id), String(r[column])]));

  // The rows, read once and indexed.
  const servesOutcomes = out('serves');
  const capabilityOf = one('use_case', 'capability_id');
  const domainOf = one('capability', 'domain_id');
  const requirementsOf = under('uc_requirement', 'use_case_id');
  const flowsOf = under('flow', 'use_case_id');
  const stepsOf = under('flow_step', 'flow_id');
  const invokes = out('invokes');
  const presentedIn = into('presents');
  const exchangesWith = out('exchanges_with');
  const entityOfCommand = one('command', 'entity_id');
  const aggregateOfEntity = one('entity', 'aggregate_id');
  const readModelOfQuery = one('query', 'read_model_id');
  const checks = out('checks');
  const selectsBy = out('selects_by');
  const calls = out('calls');
  const raises = out('raises');
  const heardBy = into('hears');
  const commandOfPolicy = one('policy', 'command_id');
  const reads = out('reads');
  const entitiesOf = under('entity', 'aggregate_id');
  const invariantsOf = under('invariant', 'aggregate_id');
  const storageOfAggregate = under('storage_requirement', 'aggregate_id');
  const storageOfReadModel = under('storage_requirement', 'read_model_id');
  const valueObjectsOf = new Map<string, string[]>();
  for (const [table, owner] of [['entity_field', 'entity_id'], ['read_model_field', 'read_model_id'], ['value_object_field', 'value_object_id']] as const) {
    for (const [k, v] of index(rows(table), owner, 'type_value_object_id')) valueObjectsOf.set(k, [...(valueObjectsOf.get(k) ?? []), ...v]);
  }
  const constraintsOf = under('constraint', 'value_object_id');
  const endpointsOf = new Map<string, string[]>();
  for (const column of ['command_id', 'query_id']) for (const [k, v] of under('endpoint', column)) endpointsOf.set(k, [...(endpointsOf.get(k) ?? []), ...v]);
  const apiRequirementsOf = under('api_requirement', 'endpoint_id');
  const viewRequirementsOf = under('view_requirement', 'view_id');
  const renderedBy = into('renders');
  const builtBy = into('builds');
  const follows = out('follows');
  const offeredBy = into('offers');
  const rulesOf = under('pattern_rule', 'pattern_id');
  const meets = out('meets');
  // The technical records that implement a design record, each by the column naming it, and the repository by persists.
  const implementations = new Map<string, string[]>();
  const implement = (from: Map<string, string[]>) => {
    for (const [k, v] of from) implementations.set(k, [...(implementations.get(k) ?? []), ...v]);
  };
  for (const [table, column] of [
    ['command_handler', 'command_id'], ['query_handler', 'query_id'], ['endpoint_handler', 'endpoint_id'], ['adapter', 'integration_id'],
    ['data_model', 'entity_id'], ['table', 'entity_id'], ['table', 'read_model_id'], ['projection', 'read_model_id'], ['reader', 'read_model_id'],
    ['rule', 'invariant_id'], ['predicate', 'specification_id'], ['event_handler', 'policy_id'], ['service', 'domain_service_id'],
    ['value_type', 'value_object_id'], ['event_type', 'domain_event_id'],
  ] as const) implement(under(table, column));
  implement(into('persists'));
  // The records under each record of the kinds a reached record carries with it: tests, and a product's own kinds.
  const carried = new Map<string, string[]>();
  for (const [name, kind] of Object.entries(schema.kinds)) {
    const test = kind.stage === 'test-plan' && !!schema.tables[name]?.columns.some((c) => c.name === 'state' && c.required);
    if (!test && (kind.productId === null || kind.obligation)) continue;
    for (const parent of kind.parents) for (const [k, v] of under(name, parent.column)) carried.set(k, [...(carried.get(k) ?? []), ...v]);
  }
  // A product's own relations: from a reached record, what it links to through one; and the product's own records that
  // link to a reached record through one, as a repository is reached through persists (a product's record links to
  // what is defined before it: the aggregate it is listed in, the command it exposes).
  const ownRecords = new Set(Object.values(schema.kinds).filter((k) => k.productId !== null).flatMap((k) => rows(k.name).map((r) => String(r.id))));
  const ownLinksOut = new Map<string, string[]>();
  const ownLinksInto = new Map<string, string[]>();
  for (const relation of Object.values(schema.relations)) {
    if (relation.productId === null) continue;
    for (const [k, v] of out(relation.name)) ownLinksOut.set(k, [...(ownLinksOut.get(k) ?? []), ...v]);
    for (const [k, v] of into(relation.name)) {
      const own = v.filter((id) => ownRecords.has(id));
      if (own.length > 0) ownLinksInto.set(k, [...(ownLinksInto.get(k) ?? []), ...own]);
    }
  }
  // A product's own obligation: the records that design or build it.
  const ownObligations = new Set(Object.values(schema.kinds).filter((k) => k.productId !== null && k.obligation).flatMap((k) => rows(k.name).map((r) => String(r.id))));
  const designsOwn = new Map<string, string[]>();
  for (const relation of Object.values(schema.relations)) {
    if (relation.role !== 'design' && relation.role !== 'build') continue;
    for (const link of links(relation.name)) {
      const [source, target] = [String(link.source_id), String(link.target_id)];
      if (ownObligations.has(target)) designsOwn.set(source, [...(designsOwn.get(source) ?? []), target]);
    }
  }

  const reaches = new Map<string, UseCaseReach>();
  for (const useCase of rows('use_case').map((u) => String(u.id))) {
    const capability = capabilityOf.get(useCase);
    const outcomes = byId(capability ? (servesOutcomes.get(capability) ?? []) : []);
    const reached = new Set<string>();
    const queue: string[] = [];
    const reach = (ids: readonly (string | undefined)[] | undefined) => {
      for (const id of ids ?? []) {
        if (!id || reached.has(id)) continue;
        reached.add(id);
        queue.push(id);
      }
    };
    reach([useCase]);
    reach(requirementsOf.get(useCase));
    for (const flow of flowsOf.get(useCase) ?? []) {
      reach([flow]);
      for (const step of stepsOf.get(flow) ?? []) {
        reach([step]);
        reach(invokes.get(step));
        reach(exchangesWith.get(step));
        for (const v of (invokes.get(step) ?? []).flatMap((operation) => presentedIn.get(operation) ?? [])) {
          reach([v]);
          reach(viewRequirementsOf.get(v));
          reach(renderedBy.get(v));
          for (const r of viewRequirementsOf.get(v) ?? []) reach(builtBy.get(r));
        }
      }
    }
    const followed = [useCase, domainOf.get(capability ?? '') ?? '', ...(offeredBy.get(useCase) ?? [])].flatMap((follower) => follows.get(follower) ?? []);
    for (const pattern of followed) reach(rulesOf.get(pattern));
    // What each reached record reaches in turn.
    for (let at = 0; at < queue.length; at++) {
      const id = queue[at];
      const entity = entityOfCommand.get(id);
      if (entity !== undefined) {
        reach([aggregateOfEntity.get(entity)]);
        reach(checks.get(id));
        reach(raises.get(id));
        for (const event of raises.get(id) ?? []) for (const policy of heardBy.get(event) ?? []) reach([policy, commandOfPolicy.get(policy)]);
      }
      const readModel = readModelOfQuery.get(id);
      if (readModel !== undefined) {
        reach([readModel]);
        reach(selectsBy.get(id));
      }
      reach(calls.get(id));
      reach(reads.get(id));
      reach(endpointsOf.get(id));
      reach(apiRequirementsOf.get(id));
      reach(entitiesOf.get(id));
      reach(invariantsOf.get(id));
      reach(storageOfAggregate.get(id));
      reach(storageOfReadModel.get(id));
      reach(valueObjectsOf.get(id));
      reach(constraintsOf.get(id));
      reach(implementations.get(id));
      reach(meets.get(id));
      reach(carried.get(id));
      reach(designsOwn.get(id));
      reach(ownLinksOut.get(id));
      reach(ownLinksInto.get(id));
    }
    reaches.set(useCase, { outcomes, reached });
  }
  return reaches;
}
