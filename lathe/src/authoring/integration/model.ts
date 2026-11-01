// The Integration aggregate (LA-AUT-A14): an integration with its adapter (with the standard rules it meets and the
// packages it uses) and its integration tests (with the test data sets each starts from). An integration has no
// owner: its product follows from its ID. One instance is one integration, whole; it holds only the links its own
// records start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { AdapterRow, IntegrationRow, IntegrationTestRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const INTEGRATION_AGGREGATE = 'LA-AUT-A14';

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

/** One integration, whole. */
export interface Integration {
  /** The integration's ID: the instance's root. */
  readonly root: string;
  integration: IntegrationRow;
  /** The code that talks to its outside system, when it has some: an integration has at most one adapter. */
  adapter: Built<AdapterRow> | null;
  tests: Tested<IntegrationTestRow>[];
}

/** The tables the Integration aggregate keeps its rows in: its kinds and the relations its records start. */
export const INTEGRATION_TABLES = ['integration', 'adapter', 'integration_test', 'meets', 'package_use', 'starts_from'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const INTEGRATION_SHAPE = {
  integration: { at: 'integration' },
  adapter: { at: 'adapter', one: true, refusedBy: 'oneAdapter', lists: { meets: 'meets', packages: 'packages' } },
  integration_test: { at: 'tests', lists: { starts_from: 'startsFrom' } },
} as const satisfies AggregateShape;

/** The kinds of the aggregate's records. */
export type IntegrationKind = keyof typeof INTEGRATION_SHAPE;

/** The integrations in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function integrationsFrom(rows: (table: string) => Row[], only?: string): Integration[] {
  const integrations = rows('integration').filter((r) => only === undefined || r.id === only) as unknown as IntegrationRow[];
  if (!integrations.length) return [];
  const ids = new Set(integrations.map((i) => i.id));
  const adaptersOf = groupBy((rows('adapter') as unknown as AdapterRow[]).filter((a) => ids.has(a.integration_id)), (a) => a.integration_id);
  const testsOf = groupBy((rows('integration_test') as unknown as IntegrationTestRow[]).filter((t) => ids.has(t.integration_id)), (t) => t.integration_id);
  const meets = bySource(rows('meets'), 'source_id', 'target_id');
  const packages = bySource(rows('package_use'), 'record_id', 'package');
  const startsFrom = bySource(rows('starts_from'), 'source_id', 'target_id');
  return integrations.map((integration) => {
    const adapter = groupOf(adaptersOf, integration.id)[0];
    return {
      root: integration.id,
      integration,
      adapter: adapter ? { row: adapter, meets: meets.get(adapter.id) ?? [], packages: packages.get(adapter.id) ?? [] } : null,
      tests: groupOf(testsOf, integration.id).map((row) => ({ row, startsFrom: startsFrom.get(row.id) ?? [] })),
    };
  });
}

/** The instance's rows, by table. */
export function integrationRows(integration: Integration): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  const adapter = integration.adapter;
  return new Map<string, Row[]>([
    ['integration', [asRow(integration.integration)]],
    ['adapter', adapter ? [asRow(adapter.row)] : []],
    ['integration_test', integration.tests.map((t) => asRow(t.row))],
    ['meets', adapter ? adapter.meets.map((target) => ({ source_id: adapter.row.id, target_id: target })) : []],
    ['package_use', adapter ? adapter.packages.map((p) => ({ record_id: adapter.row.id, package: p })) : []],
    ['starts_from', integration.tests.flatMap((t) => t.startsFrom.map((target) => ({ source_id: t.row.id, target_id: target })))],
  ]);
}

