// The Trace read model (LA-TRC-RM13), shaped for the Trace stage: one row per use case of a product's
// space, from the business outcomes its capability serves to its acceptance tests. Each row holds the use case's UC
// requirements (with their gaps and tests), the aggregates its steps change and the read models they read (from the
// Serves reach, trace/serves.ts), its flow with its steps, each step with what it fulfills, the integrations it
// exchanges with and its technical chain (the UI components rendering the views that present what it invokes, the
// endpoints or the product's own channels of what it invokes, that command's or query's handler, the repository or
// reader behind it, their data store, and the adapters of its integrations), and each offering interface's version of
// the flow (derived by the use case's through.ts: per step, the views with their requirements, the endpoints with
// their API requirements, or the product's own records it is carried out in); the integrations that perform the use
// case on its own; its flow test; the lower obligations its suite rests on (view and API requirements, invariants and
// storage requirements, with their tests); the journeys whose steps carry it out; and a status per stage. Beside the rows, each journey of the product with how far it is proved
// (TraceJourney): a step carrying out a use case is proved when every UC requirement of it and its flow test are, a
// handoff when its policy is, and the journey when its journey test counts and every step is proved. Gaps and
// tests are the checks' run's (`ReadView.checked`: coverage's gaps, the chains' tests), as the Trace read model reads
// them; the rest are the rows'. The projection is the only code that reads them for the query and the only code that
// writes the read model's table; the query handler reads it only through the reader.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { compareIds } from '../../platform/data/ids.ts';
import { inSpace, placementOf } from '../../exploring/placement.ts';
import { useCaseReaches } from '../../trace/serves.ts';
import { interfaceVersions } from '../../use-cases/use-case/through.ts';

/** What an obligation misses, as coverage names it. */
export type TraceGap = 'designed' | 'built' | 'proved';

/** An obligation of a row, with what coverage reports it misses and the tests under it. */
export interface TraceObligation {
  id: string;
  /** Its gaps, in the order designed, built, proved. */
  gaps: TraceGap[];
  /** Its tests, in ID order. */
  tests: string[];
}

/** A step's technical chain, from where it happens to where its data lives: each layer's records in ID order. */
export interface TraceChain {
  /** The UI components that render the views that present what the step invokes. */
  components: string[];
  /** The endpoints, and the product's own interface design records (an IPC channel, a CLI command), of what it invokes. */
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

/** One step of a flow, the same through every interface. */
export interface TraceStep {
  id: string;
  path: string;
  position: number;
  /** The interface it is a variant of, or null when every interface does it. */
  variantOf: string | null;
  /** The UC requirements it fulfills, in ID order. */
  fulfills: string[];
  /** The command or query it invokes, or null. */
  operation: string | null;
  /** The integrations it exchanges with. */
  integrations: string[];
  chain: TraceChain;
}

/** A step as one interface carries it out: where (views with their requirements, endpoints with their API requirements, or the product's own records), derived. */
export interface TraceStepThrough {
  id: string;
  views: { id: string; requirements: TraceObligation[] }[];
  endpoints: { id: string; apiRequirements: TraceObligation[] }[];
  /** The product's own interface design records it is carried out in, such as a CLI command. */
  entries: string[];
  /** It invokes a command or query this interface has no way to reach. */
  unreached: boolean;
}

/** A flow as one interface carries it out, derived: its actor and its steps, the other interfaces' variants left out. */
export interface TraceThrough {
  interface: string;
  kind: string;
  actor: string | null;
  /** The rules of the patterns it follows: how it reaches a step's command or query and shows a refusal. */
  rules: string[];
  steps: TraceStepThrough[];
}

/** A use case's flow: its steps in path and position order, each interface's version, and its flow test. */
export interface TraceFlow {
  id: string;
  steps: TraceStep[];
  /** Each offering interface's version, by interface ID. */
  through: TraceThrough[];
  /** The integrations that perform the use case on its own, with no person and no interface of the product, by ID. */
  performedBy: string[];
  /** Its flow test, or null. */
  test: string | null;
  /** Whether its flow test counts as proof: there is one, automated or manual. */
  proved: boolean;
}

/** A row's status per stage, as its collapsed cells say it. */
export interface TraceStatus {
  /** The interfaces its flow is carried out through and the integrations that perform it (none without a flow), and its UC requirements no step designs. */
  design: { interfaces: number; integrations: number; notDesigned: number };
  /** The handlers its steps' chains reach, and its obligations (UC, view and API requirements) not built. */
  technical: { handlers: number; notBuilt: number };
  /** Its acceptance tests (use case and flow tests), what they owe proof of (each UC requirement and flow), and how many of those are not proved. */
  suite: { tests: number; owed: number; notProved: number };
}

/** One use case's row, from its outcomes to its acceptance tests. */
export interface TraceRow {
  useCase: string;
  /** The business outcomes its capability serves, in ID order. */
  outcomes: string[];
  requirements: TraceObligation[];
  /** The aggregates its steps change and the read models they read, by the Serves reach, in ID order. */
  changes: string[];
  reads: string[];
  /** Its flow, or null. */
  flow: TraceFlow | null;
  /** The lower obligations its acceptance tests rest on: its steps' view and API requirements, its aggregates' invariants and storage requirements. */
  lower: TraceObligation[];
  /** The journey steps that carry it out, by journey then step. */
  journeys: { journey: string; step: string }[];
  status: TraceStatus;
}

/** One step of a journey, with who acts and whether what it carries out is proved. */
export interface TraceJourneyStep {
  id: string;
  path: string;
  position: number;
  /** The use case or policy it carries out, or null while it carries out nothing yet. */
  carriesOut: string | null;
  kind: 'use_case' | 'policy' | null;
  /** The use case's actors, its main actor first; none for a policy, where the product itself acts. */
  actors: string[];
  /** Whether what it carries out is designed: a use case with a flow and every UC requirement designed, a policy with no design gap. */
  designed: boolean;
  /** Whether it is built: a use case with a flow and every requirement its steps carry built, a policy with no build gap. */
  built: boolean;
  /** Whether it is proved: a use case with a flow test that counts and every UC requirement proved, a policy proved by its test. */
  proved: boolean;
}

/** A journey's proof, rolled up from its steps and its journey test on every read, never stored. */
export interface TraceJourney {
  id: string;
  product: string;
  /** The business outcomes it serves, in ID order. */
  outcomes: string[];
  /** Its steps, the main path first, then the other paths by name, each by position. */
  steps: TraceJourneyStep[];
  /** Its journey test, or null. */
  test: string | null;
  /** Whether its journey test counts: automated with a file that exists and names it, or manual, at a level a journey test allows. */
  testProved: boolean;
  /** Whether the journey is proved: its journey test counts and it has steps, each proved. */
  proved: boolean;
  /** Its steps, those carrying out nothing yet, and those proved, designed and built. */
  status: { steps: number; unlinked: number; stepsProved: number; designed: number; built: number };
}

/** A product's trace: its outcomes, a row per use case of its space, each once, in ID order, and its journeys in ID order. */
export interface ProductTrace {
  product: string;
  outcomes: string[];
  rows: TraceRow[];
  journeys: TraceJourney[];
}

/** The read model's table, kept in memory: each product's trace, by product, and each journey's proof, by journey. */
export interface TraceTable {
  products: Map<string, ProductTrace>;
  journeys: Map<string, TraceJourney>;
}

/** The checks whose problem on a test means it is not backed: its file is missing, does not name it, or its level is not allowed. */
const UNBACKED = new Set(['test-file-missing', 'test-file-missing-id', 'test-level-not-allowed']);

const GAPS: readonly TraceGap[] = ['designed', 'built', 'proved'];
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
export function traceTableFrom(view: ReadView): TraceTable {
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
  const obligation = (id: string): TraceObligation => ({ id, gaps: GAPS.filter((g) => gapsOf.get(id)?.has(g)), tests: byId(testsOf.get(id) ?? []) });

  // The rows, read once and indexed.
  const requirementsOf = under('uc_requirement', 'use_case_id');
  const flowRows = rows('flow');
  const stepRows = new Map<string, Row[]>();
  for (const s of rows('flow_step')) stepRows.set(String(s.flow_id), [...(stepRows.get(String(s.flow_id)) ?? []), s]);
  const fulfills = out('fulfills');
  const invokes = out('invokes');
  const presentedIn = into('presents');
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
  // The product's own interface design records under a command or a query (an IPC channel, a CLI command), and those
  // that present it (an invocation that carries out several commands and queries); the views that present it apart.
  const ownEntries = new Map<string, string[]>();
  for (const kind of Object.values(schema.kinds)) {
    if (kind.productId === null || kind.obligation || kind.stage !== 'interface-design') continue;
    for (const parent of kind.parents) {
      if (parent.kind !== 'command' && parent.kind !== 'query') continue;
      for (const [k, v] of under(kind.name, parent.column)) ownEntries.set(k, [...(ownEntries.get(k) ?? []), ...v]);
    }
  }
  const viewsPresenting = new Map<string, string[]>();
  for (const [operation, sources] of presentedIn) {
    const isView = (id: string) => view.record(id)?.kind === 'view';
    viewsPresenting.set(operation, sources.filter(isView));
    const own = sources.filter((id) => !isView(id));
    if (own.length) ownEntries.set(operation, [...new Set([...(ownEntries.get(operation) ?? []), ...own])]);
  }
  const kindOf = (id: string) => view.record(id)?.kind;
  const versionsOf = interfaceVersions(view);
  const performedBy = into('performs');
  const actorsOf = new Map<string, string[]>();
  for (const a of [...rows('use_case_actor')].sort((x, y) => Number(x.position) - Number(y.position))) actorsOf.set(String(a.use_case_id), [...(actorsOf.get(String(a.use_case_id)) ?? []), String(a.role_name)]);

  // Journeys: each step's journey, what it carries out, and the steps carrying out each use case.
  const journeyOfStep = one('journey_step', 'journey_id');
  const carriesOut = new Map(rows('carries_out').map((l) => [String(l.source_id), String(l.target_id)]));
  const journeysOf = into('carries_out');
  const servesOutcomes = out('serves');
  const journeyTestOf = new Map(rows('journey_test').map((t) => [String(t.journey_id), t]));
  const unbacked = new Set((run?.problems ?? []).filter((p) => UNBACKED.has(p.check) && p.record).map((p) => String(p.record)));
  const policies = new Set(rows('policy').map((p) => String(p.id)));

  const reaches = useCaseReaches(view);
  const placed = placementOf(view);
  const space = (id: string, product: string) => { const p = placed.get(id); return !!p && inSpace(p, product); };

  /** A step of a flow, with its design and its technical chain. */
  const stepOf = (s: Row): TraceStep => {
    const id = String(s.id);
    const operation = invokes.get(id)?.[0] ?? null;
    const views = operation ? byId(viewsPresenting.get(operation) ?? []) : [];
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
      variantOf: typeof s.interface_id === 'string' ? s.interface_id : null,
      fulfills: byId(fulfills.get(id) ?? []),
      operation,
      integrations,
      chain: {
        components: byId(views.flatMap((v) => renderedBy.get(v) ?? [])),
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

  const rowOf = (useCase: string, outcomes: readonly string[]): TraceRow => {
    const requirements = byId(requirementsOf.get(useCase) ?? []).map(obligation);
    const f = flowRows.filter((x) => x.use_case_id === useCase).sort((a, b) => compareIds(String(a.id), String(b.id)))[0];
    let flow: TraceFlow | null = null;
    if (f) {
      const id = String(f.id);
      const test = flowTestOf.get(id);
      const steps = [...(stepRows.get(id) ?? [])].sort(stepOrder).map(stepOf);
      const versions = versionsOf(useCase, actorsOf.get(useCase) ?? [], steps.map((s) => ({ id: s.id, path: s.path, position: s.position, variantOf: s.variantOf, operation: s.operation })));
      flow = {
        id,
        steps,
        through: versions.map((v) => ({
          interface: v.interface,
          kind: v.kind,
          actor: v.actor,
          rules: v.rules,
          steps: v.paths.flatMap((p) => p.steps).map((s) => {
            const kind = (r: string) => kindOf(r);
            return {
              id: s.id,
              views: s.reach.filter((r) => kind(r) === 'view').map((v) => ({ id: v, requirements: byId(viewRequirementsOf.get(v) ?? []).map(obligation) })),
              endpoints: s.reach.filter((r) => kind(r) === 'endpoint').map((e) => ({ id: e, apiRequirements: byId(apiRequirementsOf.get(e) ?? []).map(obligation) })),
              entries: s.reach.filter((r) => kind(r) !== 'view' && kind(r) !== 'endpoint' && kind(r) !== 'integration'),
              unreached: s.unreached,
            };
          }),
        })),
        performedBy: byId(performedBy.get(useCase) ?? []),
        test: test ? String(test.id) : null,
        proved: !!test && test.state !== 'not automated yet',
      };
    }
    const reached = [...(reaches.get(useCase)?.reached ?? [])];
    const changes = byId(reached.filter((id) => kindOf(id) === 'aggregate'));
    const reads = byId(reached.filter((id) => kindOf(id) === 'read_model'));
    const steps = flow?.steps ?? [];
    const carried = (flow?.through ?? []).flatMap((t) => t.steps);
    const designObligations = [...carried.flatMap((s) => s.views.flatMap((v) => v.requirements)), ...carried.flatMap((s) => s.endpoints.flatMap((e) => e.apiRequirements))];
    const lower = byId([
      ...designObligations.map((r) => r.id),
      ...changes.flatMap((a) => invariantsOf.get(a) ?? []),
      ...[...changes, ...reads].flatMap((m) => storageOf.get(m) ?? []),
    ]).map(obligation);
    const notBuilt = new Set([...requirements, ...designObligations].filter((r) => r.gaps.includes('built')).map((r) => r.id));
    const flows = flow ? [flow] : [];
    const tests = requirements.reduce((n, r) => n + r.tests.length, 0) + flows.filter((x) => x.test !== null).length;
    return {
      useCase,
      outcomes: [...outcomes],
      requirements,
      changes,
      reads,
      flow,
      lower,
      journeys: (journeysOf.get(useCase) ?? []).map((step) => ({ journey: String(journeyOfStep.get(step)), step })).sort((a, b) => compareIds(a.journey, b.journey) || compareIds(a.step, b.step)),
      status: {
        design: { interfaces: flow?.through.length ?? 0, integrations: flow?.performedBy.length ?? 0, notDesigned: requirements.filter((r) => r.gaps.includes('designed')).length },
        technical: { handlers: new Set(steps.flatMap((s) => s.chain.handlers)).size, notBuilt: notBuilt.size },
        suite: { tests, owed: requirements.length + flows.length, notProved: requirements.filter((r) => r.gaps.includes('proved')).length + flows.filter((x) => !x.proved).length },
      },
    };
  };

  /** A journey's proof, from its steps' rows (or, for a handoff, its policy's gaps) and its journey test. */
  const journeyOf = (j: Row, product: string, outcomes: readonly string[], rowOfUseCase: Map<string, TraceRow>): TraceJourney => {
    const id = String(j.id);
    const steps = rows('journey_step').filter((s) => s.journey_id === id).sort(stepOrder).map((s): TraceJourneyStep => {
      const step = String(s.id);
      const target = carriesOut.get(step) ?? null;
      const base = { id: step, path: String(s.path), position: Number(s.position), carriesOut: target };
      if (target !== null && policies.has(target)) {
        const { gaps } = obligation(target);
        return { ...base, kind: 'policy', actors: [], designed: !gaps.includes('designed'), built: !gaps.includes('built'), proved: !gaps.includes('proved') };
      }
      const row = target === null ? undefined : rowOfUseCase.get(target);
      if (target === null) return { ...base, kind: null, actors: [], designed: false, built: false, proved: false };
      if (!row) return { ...base, kind: 'use_case', actors: actorsOf.get(target) ?? [], designed: false, built: false, proved: false };
      const flow = row.flow !== null;
      return {
        ...base,
        kind: 'use_case',
        actors: actorsOf.get(target) ?? [],
        designed: flow && row.status.design.notDesigned === 0,
        built: flow && row.status.technical.notBuilt === 0,
        proved: !!row.flow?.proved && row.requirements.every((r) => !r.gaps.includes('proved')),
      };
    });
    const test = journeyTestOf.get(id);
    const testProved = !!test && (test.state === 'automated' || test.state === 'manual') && !unbacked.has(String(test.id));
    const stepsProved = steps.filter((s) => s.proved).length;
    return {
      id,
      product,
      outcomes: byId((servesOutcomes.get(id) ?? []).filter((o) => outcomes.includes(o))),
      steps,
      test: test ? String(test.id) : null,
      testProved,
      proved: testProved && steps.length > 0 && stepsProved === steps.length,
      status: {
        steps: steps.length,
        unlinked: steps.filter((s) => s.carriesOut === null).length,
        stepsProved,
        designed: steps.filter((s) => s.designed).length,
        built: steps.filter((s) => s.built).length,
      },
    };
  };

  const products = new Map<string, ProductTrace>();
  const journeys = new Map<string, TraceJourney>();
  for (const row of rows('product')) {
    const product = String(row.id);
    const outcomes = rows('business_outcome').map((o) => String(o.id)).filter((o) => placed.get(o)?.product === product).sort(compareIds);
    const useCases = rows('use_case').map((u) => String(u.id)).filter((u) => space(u, product)).sort(compareIds);
    const traced = useCases.map((u) => rowOf(u, (reaches.get(u)?.outcomes ?? []).filter((o) => outcomes.includes(o))));
    const rowOfUseCase = new Map(traced.map((r) => [r.useCase, r]));
    const own = rows('journey').filter((j) => j.product_id === product).sort((a, b) => compareIds(String(a.id), String(b.id))).map((j) => journeyOf(j, product, outcomes, rowOfUseCase));
    for (const j of own) journeys.set(j.id, j);
    products.set(product, { product, outcomes, rows: traced, journeys: own });
  }
  return { products, journeys };
}
