// The Endpoint read model (LA-AUT-RM33): an endpoint as its readers see it, with its handler and its API requirements,
// each holding its tests, and the endpoints of a command or query in a list. Its projection builds them from the
// rows; it shares no type with the aggregate.
import type { Row } from '../../platform/data/rows.ts';

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

const text = (v: unknown): string | null => (v === undefined || v === null ? null : String(v));
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, undefined, { numeric: true });
const targets = (links: Row[], from: string, source: string, target: string) => links.filter((l) => l[source] === from).map((l) => String(l[target])).sort();

/** The page of the endpoint with the ID, from the rows (the projection, LA-AUT-RM33-PJ); undefined when there is none. */
export function endpointPageFrom(rows: (table: string) => Row[], id: string): EndpointPage | undefined {
  const endpoint = rows('endpoint').find((r) => r.id === id);
  if (!endpoint) return undefined;
  const startsFrom = rows('starts_from');
  const tests = rows('endpoint_test');
  const handler = rows('endpoint_handler').find((h) => h.endpoint_id === id);
  return {
    id,
    title: String(endpoint.title),
    method: String(endpoint.method),
    route: String(endpoint.route),
    exposes: String(endpoint.command_id ?? endpoint.query_id),
    description: String(endpoint.description),
    notes: text(endpoint.notes),
    handler: handler
      ? { id: String(handler.id), title: String(handler.title), file: text(handler.file), description: String(handler.description), meets: targets(rows('meets'), String(handler.id), 'source_id', 'target_id'), packages: targets(rows('package_use'), String(handler.id), 'record_id', 'package') }
      : null,
    requirements: rows('api_requirement')
      .filter((r) => r.endpoint_id === id)
      .map((r) => ({
        id: String(r.id),
        title: String(r.title),
        statement: String(r.statement),
        group: text(r.group_name),
        tests: tests
          .filter((t) => t.api_requirement_id === r.id)
          .map((t) => ({ id: String(t.id), title: String(t.title), level: String(t.level), state: String(t.state), file: text(t.file), startsFrom: targets(startsFrom, String(t.id), 'source_id', 'target_id') }))
          .sort(byId),
      }))
      .sort(byId),
  };
}

/** The endpoints that expose the command or query, by ID. */
export function endpointSummariesFrom(rows: (table: string) => Row[], parent: string): EndpointSummary[] {
  return rows('endpoint')
    .filter((e) => e.command_id === parent || e.query_id === parent)
    .map((e) => ({ id: String(e.id), title: String(e.title) }))
    .sort(byId);
}
