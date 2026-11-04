// The Endpoint aggregate's read model (LA-IXD-RM33), shaped for its readers: the Endpoint page reads an endpoint whole
// (its handler with the standard rules it meets and the packages it uses, and its API requirements by ID, each with
// its tests) with the record the page is about, a command's or query's list reads each endpoint that exposes it, and
// the editor's next ID reads the IDs in use. The projection (endpointTableFrom) is the only code that reads the source
// rows and the only code that writes the read model's table; the query handlers read that table only through the
// reader (reader.ts). Nothing here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ApiRequirementRow, EndpointHandlerRow, EndpointRow, EndpointTestRow } from '../../platform/data/tables.ts';
import type { EndpointKind } from './model.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** An endpoint test as the page shows it: its row and the test data sets it starts from. */
export interface EndpointTestOnPage {
  test: EndpointTestRow;
  startsFrom: string[];
}

/** An API requirement as the page shows it: its row and its tests by ID. */
export interface ApiRequirementOnPage {
  requirement: ApiRequirementRow;
  tests: EndpointTestOnPage[];
}

/** The endpoint's handler as the page shows it: its row, the standard rules it meets and the packages it uses. */
export interface EndpointHandlerOnPage {
  handler: EndpointHandlerRow;
  meets: string[];
  packages: string[];
  /** Its helper files, sorted. */
  helpers: string[];
}

/** An endpoint whole, as its page shows it: its row, its handler when it has one, and its API requirements by ID. */
export interface EndpointTree {
  endpoint: EndpointRow;
  handler: EndpointHandlerOnPage | null;
  requirements: ApiRequirementOnPage[];
}

/** An endpoint as its page reads it, with the record of it the page is about. */
export interface EndpointPage extends EndpointTree {
  record: { id: string; kind: EndpointKind };
}

/** An endpoint as a command's or query's list reads it. */
export interface EndpointSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface EndpointTable {
  /** Each endpoint whole, by its ID. */
  endpoints: Map<string, EndpointTree>;
  /** Each record inside an endpoint: the endpoint that holds it and its kind there. */
  holding: Map<string, { root: string; kind: EndpointKind }>;
  /** Each command's and query's endpoints, by ID; one with none has an empty list. */
  parents: Map<string, EndpointSummary[]>;
  /** Every domain's ID: what an endpoint's number is counted across. */
  domains: string[];
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's other ends by one end, each list sorted. */
function linked(view: ReadView, table: string, by: string, other: string): (id: string) => string[] {
  const found = grouped<Row>(view.rows(table), by);
  return (id) => (found.get(id) ?? []).map((l) => String(l[other])).sort();
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function endpointTableFrom(view: ReadView): EndpointTable {
  const startsFrom = linked(view, 'starts_from', 'source_id', 'target_id');
  const meets = linked(view, 'meets', 'source_id', 'target_id');
  const packages = linked(view, 'package_use', 'record_id', 'package');
  const helpers = linked(view, 'helper_file', 'record_id', 'file');
  const requirements = grouped<ApiRequirementRow>(view.rows('api_requirement'), 'endpoint_id');
  const tests = grouped<EndpointTestRow>(view.rows('endpoint_test'), 'api_requirement_id');
  const handlers = grouped<EndpointHandlerRow>(view.rows('endpoint_handler'), 'endpoint_id');
  const endpoints = new Map<string, EndpointTree>();
  const holding = new Map<string, { root: string; kind: EndpointKind }>();
  const parents = new Map<string, EndpointSummary[]>([...view.rows('command'), ...view.rows('query')].map((p) => [String(p.id), []]));
  for (const endpoint of view.rows('endpoint') as unknown as EndpointRow[]) {
    const root = endpoint.id;
    holding.set(root, { root, kind: 'endpoint' });
    const handler = handlers.get(root)?.[0];
    const tree: EndpointTree = {
      endpoint,
      handler: handler ? { handler, meets: meets(handler.id), packages: packages(handler.id), helpers: helpers(handler.id) } : null,
      requirements: [...(requirements.get(root) ?? [])].sort(byRecordId).map((requirement) => ({
        requirement,
        tests: [...(tests.get(requirement.id) ?? [])].sort(byRecordId).map((test) => ({ test, startsFrom: startsFrom(test.id) })),
      })),
    };
    if (handler) holding.set(handler.id, { root, kind: 'endpoint_handler' });
    for (const r of tree.requirements) {
      holding.set(r.requirement.id, { root, kind: 'api_requirement' });
      for (const t of r.tests) holding.set(t.test.id, { root, kind: 'endpoint_test' });
    }
    endpoints.set(root, tree);
    parents.get(String(endpoint.command_id ?? endpoint.query_id))?.push({ id: endpoint.id, title: endpoint.title });
  }
  for (const list of parents.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { endpoints, holding, parents, domains: view.rows('domain').map((d) => String(d.id)), kinds };
}
