// The Endpoint aggregate (LA-AUT-A13): an endpoint with its API requirements and their endpoint tests (with the test
// data sets each starts from), and its endpoint handler (with the standard rules it meets and the packages it uses).
// An endpoint sits under the one command or query it exposes, outside the aggregate. One instance is one endpoint,
// whole; it holds only the links its own records start.
import type { Slice } from '../../platform/commands/definition.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { ApiRequirementRow, EndpointHandlerRow, EndpointRow, EndpointTestRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const ENDPOINT_AGGREGATE = 'LA-AUT-A13';

/** How the interfaces reach the aggregate's commands: `lathe endpoint`, the endpoint_ tools, /api/endpoint/. */
export const ENDPOINT_SLICE: Slice = { aggregate: ENDPOINT_AGGREGATE, name: 'endpoint' };

/**
 * The row with the changes applied: a value sets its column, null clears it, and a column left out keeps its value.
 * Only the columns named in `columns` are taken from the changes.
 */
export function changed<R extends object>(row: R, changes: object, columns: readonly string[]): R {
  const next = { ...row } as Record<string, unknown>;
  for (const [column, value] of Object.entries(changes)) {
    if (!columns.includes(column) || value === undefined) continue;
    if (value === null) delete next[column];
    else next[column] = value as Value;
  }
  return next as R;
}

/** A technical record with the standard rules it meets and the packages it uses. */
export interface Built<T> {
  row: T;
  meets: string[];
  packages: string[];
}

/** A test with the test data sets it starts from. */
export interface Tested<T> {
  row: T;
  startsFrom: string[];
}

/** One endpoint, whole. */
export interface Endpoint {
  /** The endpoint's ID: the instance's root. */
  readonly root: string;
  endpoint: EndpointRow;
  requirements: ApiRequirementRow[];
  /** The code that serves it, when it has some: an endpoint has at most one handler. */
  handler: Built<EndpointHandlerRow> | null;
  tests: Tested<EndpointTestRow>[];
}

/** The tables the Endpoint aggregate keeps its rows in: its kinds and the relations its records start. */
export const ENDPOINT_TABLES = ['endpoint', 'api_requirement', 'endpoint_handler', 'endpoint_test', 'meets', 'package_use', 'starts_from'] as const;

/** The kinds of the aggregate's records. */
export type EndpointKind = 'endpoint' | 'api_requirement' | 'endpoint_handler' | 'endpoint_test';

/** A new endpoint, with nothing under it yet. */
export function newEndpoint(endpoint: EndpointRow): Endpoint {
  return { root: endpoint.id, endpoint, requirements: [], handler: null, tests: [] };
}

/** The endpoints in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function endpointsFrom(rows: (table: string) => Row[], only?: string): Endpoint[] {
  const endpoints = rows('endpoint').filter((r) => only === undefined || r.id === only) as unknown as EndpointRow[];
  if (!endpoints.length) return [];
  const ids = new Set(endpoints.map((e) => e.id));
  const requirements = (rows('api_requirement') as unknown as ApiRequirementRow[]).filter((r) => ids.has(r.endpoint_id));
  const endpointOf = new Map(requirements.map((r) => [r.id, r.endpoint_id]));
  const requirementsOf = groupBy(requirements, (r) => r.endpoint_id);
  const handlersOf = groupBy((rows('endpoint_handler') as unknown as EndpointHandlerRow[]).filter((h) => ids.has(h.endpoint_id)), (h) => h.endpoint_id);
  const testsOf = groupBy((rows('endpoint_test') as unknown as EndpointTestRow[]).filter((t) => endpointOf.has(t.api_requirement_id)), (t) => endpointOf.get(t.api_requirement_id));
  const meets = bySource(rows('meets'), 'source_id', 'target_id');
  const packages = bySource(rows('package_use'), 'record_id', 'package');
  const startsFrom = bySource(rows('starts_from'), 'source_id', 'target_id');
  return endpoints.map((endpoint) => {
    const handler = groupOf(handlersOf, endpoint.id)[0];
    return {
      root: endpoint.id,
      endpoint,
      requirements: groupOf(requirementsOf, endpoint.id),
      handler: handler ? { row: handler, meets: groupOf(meets, handler.id), packages: groupOf(packages, handler.id) } : null,
      tests: groupOf(testsOf, endpoint.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
    };
  });
}

/** The instance's rows, by table. */
export function endpointRows(endpoint: Endpoint): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  const handler = endpoint.handler;
  return new Map<string, Row[]>([
    ['endpoint', [asRow(endpoint.endpoint)]],
    ['api_requirement', endpoint.requirements.map(asRow)],
    ['endpoint_handler', handler ? [asRow(handler.row)] : []],
    ['endpoint_test', endpoint.tests.map((t) => asRow(t.row))],
    ['meets', handler ? handler.meets.map((target) => ({ source_id: handler.row.id, target_id: target })) : []],
    ['package_use', handler ? handler.packages.map((p) => ({ record_id: handler.row.id, package: p })) : []],
    ['starts_from', endpoint.tests.flatMap((t) => t.startsFrom.map((target) => ({ source_id: t.row.id, target_id: target })))],
  ]);
}

/** The kind of the record with this ID inside the endpoint, or undefined. */
export function kindInside(endpoint: Endpoint, id: string): EndpointKind | undefined {
  if (endpoint.root === id) return 'endpoint';
  if (endpoint.requirements.some((r) => r.id === id)) return 'api_requirement';
  if (endpoint.handler?.row.id === id) return 'endpoint_handler';
  if (endpoint.tests.some((t) => t.row.id === id)) return 'endpoint_test';
  return undefined;
}
