// The Endpoint read model (LA-AUT-RM33): an endpoint as its readers see it, with its handler and its API requirements,
// each holding its tests, and the endpoints of a command or query in a list. Its projection builds its table from
// the rows; it shares no type with the aggregate.
import type { Row } from '../../platform/data/rows.ts';
import type { ReadView } from '../../platform/data/rules.ts';

/** An endpoint test, as a reader sees it. */
export interface EndpointTestLine {
  id: string;
  title: string;
  level: string;
  state: string;
  file: string | null;
  /** The test data sets it starts from. */
  startsFrom: string[];
}

/** An API requirement with its tests. */
export interface ApiRequirementLine {
  id: string;
  title: string;
  statement: string;
  group: string | null;
  tests: EndpointTestLine[];
}

/** The code that serves the endpoint. */
export interface EndpointHandlerLine {
  id: string;
  title: string;
  file: string | null;
  description: string;
  meets: string[];
  packages: string[];
}

/** One endpoint, whole. */
export interface EndpointPage {
  id: string;
  title: string;
  method: string;
  route: string;
  /** The command or query it exposes. */
  exposes: string;
  description: string;
  notes: string | null;
  handler: EndpointHandlerLine | null;
  requirements: ApiRequirementLine[];
}

/** An endpoint in a list. */
export interface EndpointSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface EndpointTable {
  /** Each endpoint whole, by its ID, in ID order. */
  endpoints: Map<string, EndpointPage>;
  /** Each record inside an endpoint: the endpoint that holds it. */
  holding: Map<string, string>;
  /** Every domain's ID. */
  domains: string[];
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

const text = (v: unknown): string | null => (v === undefined || v === null ? null : String(v));
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true });
const targets = (links: Row[], from: string, source: string, target: string) => links.filter((l) => l[source] === from).map((l) => String(l[target])).sort();

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function endpointTableFrom(view: ReadView): EndpointTable {
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const r of view.rows(kind)) kinds.set(String(r.id), kind);
  const [startsFrom, meets, packages] = [view.rows('starts_from'), view.rows('meets'), view.rows('package_use')];
  const [requirements, tests, handlers] = [view.rows('api_requirement'), view.rows('endpoint_test'), view.rows('endpoint_handler')];
  const endpoints = new Map<string, EndpointPage>();
  const holding = new Map<string, string>();
  for (const endpoint of [...view.rows('endpoint')].sort((a, b) => byId({ id: String(a.id) }, { id: String(b.id) }))) {
    const id = String(endpoint.id);
    const hold = (inside: unknown) => holding.set(String(inside), id);
    hold(id);
    const handler = handlers.find((h) => h.endpoint_id === id);
    if (handler) hold(handler.id);
    endpoints.set(id, {
      id,
      title: String(endpoint.title),
      method: String(endpoint.method),
      route: String(endpoint.route),
      exposes: String(endpoint.command_id ?? endpoint.query_id),
      description: String(endpoint.description),
      notes: text(endpoint.notes),
      handler: handler
        ? { id: String(handler.id), title: String(handler.title), file: text(handler.file), description: String(handler.description), meets: targets(meets, String(handler.id), 'source_id', 'target_id'), packages: targets(packages, String(handler.id), 'record_id', 'package') }
        : null,
      requirements: requirements
        .filter((r) => r.endpoint_id === id)
        .map((r) => {
          hold(r.id);
          return {
            id: String(r.id),
            title: String(r.title),
            statement: String(r.statement),
            group: text(r.group_name),
            tests: tests
              .filter((t) => t.api_requirement_id === r.id)
              .map((t) => {
                hold(t.id);
                return { id: String(t.id), title: String(t.title), level: String(t.level), state: String(t.state), file: text(t.file), startsFrom: targets(startsFrom, String(t.id), 'source_id', 'target_id') };
              })
              .sort(byId),
          };
        })
        .sort(byId),
    });
  }
  return { endpoints, holding, domains: view.rows('domain').map((d) => String(d.id)), kinds };
}
