// The Delivery read model (LA-TRC-RM13), shaped for the Trace stage's Delivery view: one row per use case of a product's
// space, from the business outcomes its capability serves to its acceptance tests. Each row holds the use case's UC
// requirements (with their gaps and tests), the aggregates its steps change and the read models they read (from the
// Serves reach, trace/serves.ts), its flows (one per interface) with their steps, each step with what it fulfills,
// the view it happens in and that view's requirements, the endpoints of what it invokes and their API requirements, the
// integrations it exchanges with, and its technical chain (the UI components rendering its view, the endpoints or the
// product's own channels of what it invokes, that command's or query's handler, the repository or reader behind it,
// their data store, and the adapters of its integrations); its flow tests; the lower obligations its suite rests on
// (view and API requirements, invariants and storage requirements, with their tests); and a status per stage. Gaps and
// tests are the checks' run's (`ReadView.checked`: coverage's gaps, the chains' tests), as the Trace read model reads
// them; the rest are the rows'. The projection is the only code that reads them for the query and the only code that
// writes the read model's table; the query handler reads it only through the reader.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { compareIds } from '../../platform/data/ids.ts';
import { inSpace, placementOf } from '../../exploring/placement.ts';
import { useCaseReaches } from '../../trace/serves.ts';

/** What an obligation misses, as coverage names it. */
export type DeliveryGap = 'designed' | 'built' | 'proved';

/** An obligation of a row, with what coverage reports it misses and the tests under it. */
export interface DeliveryObligation {
  id: string;
  /** Its gaps, in the order designed, built, proved. */
  gaps: DeliveryGap[];
  /** Its tests, in ID order. */
  tests: string[];
}

/** A step's technical chain, from where it happens to where its data lives: each layer's records in ID order. */
export interface DeliveryChain {
  /** The UI components that render the view the step happens in. */
  components: string[];
  /** The endpoints, and the product's own interaction design records (an IPC channel, a CLI command), of what it invokes. */
  entries: string[];
  /** The command or query handler of what it invokes. */
  handlers: string[];
  /** The repository of the command's aggregate, or the reader of the query's read model. */
  stores: string[];
  /** The data stores those keep their data in. */
  dataStores: string[];
  /** The adapters of the integrations it exchanges with. */
  adapters: string[];
}

/** One step of a flow. */
export interface DeliveryStep {
  id: string;
  path: string;
  position: number;
  /** The UC requirements it fulfills, in ID order. */
  fulfills: string[];
  /** The command or query it invokes, or null. */
  operation: string | null;
  /** The view it happens in, or null, and that view's requirements. */
  view: string | null;
  viewRequirements: DeliveryObligation[];
  /** The endpoints exposing what it invokes, each with its API requirements. */
  endpoints: { id: string; apiRequirements: DeliveryObligation[] }[];
  /** The integrations it exchanges with. */
  integrations: string[];
  chain: DeliveryChain;
}

/** One flow of a use case: through one interface, its steps in path and position order, and its flow test. */
export interface DeliveryFlow {
  id: string;
  interface: string;
  steps: DeliveryStep[];
  /** Its flow test, or null. */
  test: string | null;
  /** Whether its flow test counts as proof: there is one, automated or manual. */
  proved: boolean;
}

/** A row's status per stage, as its collapsed cells say it. */
export interface DeliveryStatus {
  /** Its flows, and its UC requirements no step designs. */
  design: { flows: number; notDesigned: number };
  /** The handlers its steps' chains reach, and its obligations (UC, view and API requirements) not built. */
  technical: { handlers: number; notBuilt: number };
  /** Its acceptance tests (use case and flow tests), what they owe proof of (each UC requirement and flow), and how many of those are not proved. */
  suite: { tests: number; owed: number; notProved: number };
}

/** One use case's row, from its outcomes to its acceptance tests. */
export interface DeliveryRow {
  useCase: string;
  /** The business outcomes its capability serves, in ID order. */
  outcomes: string[];
  requirements: DeliveryObligation[];
  /** The aggregates its steps change and the read models they read, by the Serves reach, in ID order. */
  changes: string[];
  reads: string[];
  flows: DeliveryFlow[];
  /** The lower obligations its acceptance tests rest on: its steps' view and API requirements, its aggregates' invariants and storage requirements. */
  lower: DeliveryObligation[];
  status: DeliveryStatus;
}

/** A product's Delivery: its outcomes, and a row per use case of its space, each once, in ID order. */
export interface ProductDelivery {
  product: string;
  outcomes: string[];
  rows: DeliveryRow[];
}

/** The read model's table, kept in memory: each product's Delivery, by product. */
export interface DeliveryTable {
  products: Map<string, ProductDelivery>;
}

const GAPS: readonly DeliveryGap[] = ['designed', 'built', 'proved'];
const byId = (ids: Iterable<string>) => [...new Set(ids)].sort(compareIds);

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

/** The projection: the read model's table, built from the rows and the checks' run on each read (in memory; nothing keeps it). */
export function deliveryTableFrom(view: ReadView): DeliveryTable {
  const { schema } = view;
  const rows = (table: string): Row[] => (schema.tables[table] ? view.rows(table) : []);
  const out = (relation: string) => index(rows(relation), 'source_id', 'target_id');
  const into = (relation: string) => index(rows(relation), 'target_id', 'source_id');
  const under = (table: string, column: string) => index(rows(table), column, 'id');
  const one = (table: string, column: string) => new Map(rows(table).filter((r) => typeof r[column] === 'string').map((r) => [String(r.id), String(r[column])]));
  const merge = (...maps: Map<string, string[]>[]) => {
    const all = new Map<string, string[]>();
    for (const m of maps) for (const [k, v] of m) all.set(k, [...(all.get(k) ?? []), ...v]);
    return all;
  };

  // The checks' run: each obligation's gaps and tests.
  const run = view.checked;
  const gapsOf = new Map<string, Set<string>>();
  for (const c of run?.coverage ?? []) for (const g of c.gaps) if ((GAPS as readonly string[]).includes(g.missing)) gapsOf.set(g.id, (gapsOf.get(g.id) ?? new Set()).add(g.missing));
  const testsOf = new Map<string, string[]>();
  for (const c of run?.chains ?? []) testsOf.set(c.obligation, [...c.tests]);
  const obligation = (id: string): DeliveryObligation => ({ id, gaps: GAPS.filter((g) => gapsOf.get(id)?.has(g)), tests: byId(testsOf.get(id) ?? []) });

  // The rows, read once and indexed.
  const requirementsOf = under('uc_requirement', 'use_case_id');
  const flowRows = rows('flow');
  const stepRows = new Map<string, Row[]>();
  for (const s of rows('flow_step')) stepRows.set(String(s.flow_id), [...(stepRows.get(String(s.flow_id)) ?? []), s]);
  const fulfills = out('fulfills');
  const invokes = out('invokes');
  const happensIn = out('happens_in');
  const exchangesWith = out('exchanges_with');
  const viewRequirementsOf = under('view_requirement', 'view_id');
  const endpointsOf = merge(under('endpoint', 'command_id'), under('endpoint', 'query_id'));
  const apiRequirementsOf = under('api_requirement', 'endpoint_id');
  const renderedBy = into('renders');
  const handlersOf = merge(under('command_handler', 'command_id'), under('query_handler', 'query_id'));
  const entityOfCommand = one('command', 'entity_id');
  const aggregateOfEntity = one('entity', 'aggregate_id');
  const readModelOfQuery = one('query', 'read_model_id');
  const repositoryOf = into('persists');
  const readersOf = under('reader', 'read_model_id');
  const storedIn = out('stored_in');
  const adaptersOf = under('adapter', 'integration_id');
  const invariantsOf = under('invariant', 'aggregate_id');
  const storageOf = merge(under('storage_requirement', 'aggregate_id'), under('storage_requirement', 'read_model_id'));
  const flowTestOf = new Map(rows('flow_test').map((t) => [String(t.flow_id), t]));
  // The product's own interaction design records under a command or a query (an IPC channel, a CLI command).
  const ownEntries = new Map<string, string[]>();
  for (const kind of Object.values(schema.kinds)) {
    if (kind.productId === null || kind.obligation || kind.stage !== 'interaction-design') continue;
    for (const parent of kind.parents) {
      if (parent.kind !== 'command' && parent.kind !== 'query') continue;
      for (const [k, v] of under(kind.name, parent.column)) ownEntries.set(k, [...(ownEntries.get(k) ?? []), ...v]);
    }
  }
  const kindOf = (id: string) => view.record(id)?.kind;

  const reaches = useCaseReaches(view);
  const placed = placementOf(view);
  const space = (id: string, product: string) => { const p = placed.get(id); return !!p && inSpace(p, product); };

  /** A step of a flow, with its design and its technical chain. */
  const stepOf = (s: Row): DeliveryStep => {
    const id = String(s.id);
    const operation = invokes.get(id)?.[0] ?? null;
    const viewId = happensIn.get(id)?.[0] ?? null;
    const integrations = byId(exchangesWith.get(id) ?? []);
    const endpoints = operation ? byId(endpointsOf.get(operation) ?? []) : [];
    const command = operation ? entityOfCommand.get(operation) : undefined;
    const readModel = operation ? readModelOfQuery.get(operation) : undefined;
    const aggregate = command ? aggregateOfEntity.get(command) : undefined;
    const stores = byId([...(aggregate ? repositoryOf.get(aggregate) ?? [] : []), ...(readModel ? readersOf.get(readModel) ?? [] : [])]);
    return {
      id,
      path: String(s.path),
      position: Number(s.position),
      fulfills: byId(fulfills.get(id) ?? []),
      operation,
      view: viewId,
      viewRequirements: byId(viewId ? viewRequirementsOf.get(viewId) ?? [] : []).map(obligation),
      endpoints: endpoints.map((e) => ({ id: e, apiRequirements: byId(apiRequirementsOf.get(e) ?? []).map(obligation) })),
      integrations,
      chain: {
        components: byId(viewId ? renderedBy.get(viewId) ?? [] : []),
        entries: byId([...endpoints, ...(operation ? ownEntries.get(operation) ?? [] : [])]),
        handlers: byId(operation ? handlersOf.get(operation) ?? [] : []),
        stores,
        dataStores: byId(stores.flatMap((r) => storedIn.get(r) ?? [])),
        adapters: byId(integrations.flatMap((i) => adaptersOf.get(i) ?? [])),
      },
    };
  };
  /** Steps on the main path first, then the other paths by name, each by position. */
  const stepOrder = (a: Row, b: Row) => (a.path === 'main' ? 0 : 1) - (b.path === 'main' ? 0 : 1) || compareIds(String(a.path), String(b.path)) || Number(a.position) - Number(b.position);

  const rowOf = (useCase: string, outcomes: readonly string[]): DeliveryRow => {
    const requirements = byId(requirementsOf.get(useCase) ?? []).map(obligation);
    const flows = flowRows.filter((f) => f.use_case_id === useCase).sort((a, b) => compareIds(String(a.id), String(b.id))).map((f): DeliveryFlow => {
      const id = String(f.id);
      const test = flowTestOf.get(id);
      return {
        id,
        interface: String(f.interface_id),
        steps: [...(stepRows.get(id) ?? [])].sort(stepOrder).map(stepOf),
        test: test ? String(test.id) : null,
        proved: !!test && test.state !== 'not automated yet',
      };
    });
    const reached = [...(reaches.get(useCase)?.reached ?? [])];
    const changes = byId(reached.filter((id) => kindOf(id) === 'aggregate'));
    const reads = byId(reached.filter((id) => kindOf(id) === 'read_model'));
    const steps = flows.flatMap((f) => f.steps);
    const lower = byId([
      ...steps.flatMap((s) => s.viewRequirements.map((r) => r.id)),
      ...steps.flatMap((s) => s.endpoints.flatMap((e) => e.apiRequirements.map((r) => r.id))),
      ...changes.flatMap((a) => invariantsOf.get(a) ?? []),
      ...[...changes, ...reads].flatMap((m) => storageOf.get(m) ?? []),
    ]).map(obligation);
    const notBuilt = new Set([
      ...requirements.filter((r) => r.gaps.includes('built')).map((r) => r.id),
      ...steps.flatMap((s) => [...s.viewRequirements, ...s.endpoints.flatMap((e) => e.apiRequirements)]).filter((r) => r.gaps.includes('built')).map((r) => r.id),
    ]);
    const tests = requirements.reduce((n, r) => n + r.tests.length, 0) + flows.filter((f) => f.test !== null).length;
    return {
      useCase,
      outcomes: [...outcomes],
      requirements,
      changes,
      reads,
      flows,
      lower,
      status: {
        design: { flows: flows.length, notDesigned: requirements.filter((r) => r.gaps.includes('designed')).length },
        technical: { handlers: new Set(steps.flatMap((s) => s.chain.handlers)).size, notBuilt: notBuilt.size },
        suite: { tests, owed: requirements.length + flows.length, notProved: requirements.filter((r) => r.gaps.includes('proved')).length + flows.filter((f) => !f.proved).length },
      },
    };
  };

  const products = new Map<string, ProductDelivery>();
  for (const row of rows('product')) {
    const product = String(row.id);
    const outcomes = rows('business_outcome').map((o) => String(o.id)).filter((o) => placed.get(o)?.product === product).sort(compareIds);
    const useCases = rows('use_case').map((u) => String(u.id)).filter((u) => space(u, product)).sort(compareIds);
    products.set(product, {
      product,
      outcomes,
      rows: useCases.map((u) => rowOf(u, (reaches.get(u)?.outcomes ?? []).filter((o) => outcomes.includes(o)))),
    });
  }
  return { products };
}
