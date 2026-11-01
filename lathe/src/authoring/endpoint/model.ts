// The Endpoint aggregate (LA-AUT-A13): an endpoint with its API requirements and their endpoint tests (with the test
// data sets each starts from), and its endpoint handler (with the standard rules it meets and the packages it uses).
// An endpoint sits under the one command or query it exposes, outside the aggregate. One instance is one endpoint,
// whole; it holds only the links its own records start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ApiRequirementRow, EndpointHandlerRow, EndpointRow, EndpointTestRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const ENDPOINT_AGGREGATE = 'LA-AUT-A13';

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

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const ENDPOINT_SHAPE = {
  endpoint: { at: 'endpoint' },
  api_requirement: { at: 'requirements' },
  endpoint_handler: { at: 'handler', one: true, lists: { meets: 'meets', packages: 'packages' } },
  endpoint_test: { at: 'tests', lists: { starts_from: 'startsFrom' } },
} as const satisfies AggregateShape;

/** The kinds of the aggregate's records. */
export type EndpointKind = keyof typeof ENDPOINT_SHAPE;

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

