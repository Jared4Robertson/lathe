// The Integration read model (LA-AUT-RM34): an integration as its readers see it, with its adapter and its tests, and
// the integrations of a product in a list. Its projection builds them from the rows; it shares no type with the
// aggregate.
import type { Row } from '../../platform/data/rows.ts';

/** An integration test, as a reader sees it. */
export interface IntegrationTestLine {
  id: string;
  title: string;
  level: string;
  state: string;
  file: string | null;
  /** The test data sets it starts from. */
  startsFrom: string[];
}

/** The code that talks to the outside system. */
export interface AdapterLine {
  id: string;
  title: string;
  file: string | null;
  description: string;
  meets: string[];
  packages: string[];
}

/** One integration, whole. */
export interface IntegrationPage {
  id: string;
  title: string;
  system: string | null;
  description: string;
  adapter: AdapterLine | null;
  tests: IntegrationTestLine[];
}

/** An integration in a list. */
export interface IntegrationSummary {
  id: string;
  title: string;
}

const text = (v: unknown): string | null => (v === undefined || v === null ? null : String(v));
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, undefined, { numeric: true });
const targets = (links: Row[], from: string, source: string, target: string) => links.filter((l) => l[source] === from).map((l) => String(l[target])).sort();

/** The page of the integration with the ID, from the rows (the projection, LA-AUT-RM34-PJ); undefined when there is none. */
export function integrationPageFrom(rows: (table: string) => Row[], id: string): IntegrationPage | undefined {
  const integration = rows('integration').find((r) => r.id === id);
  if (!integration) return undefined;
  const adapter = rows('adapter').find((a) => a.integration_id === id);
  const startsFrom = rows('starts_from');
  return {
    id,
    title: String(integration.title),
    system: text(integration.system),
    description: String(integration.description),
    adapter: adapter
      ? { id: String(adapter.id), title: String(adapter.title), file: text(adapter.file), description: String(adapter.description), meets: targets(rows('meets'), String(adapter.id), 'source_id', 'target_id'), packages: targets(rows('package_use'), String(adapter.id), 'record_id', 'package') }
      : null,
    tests: rows('integration_test')
      .filter((t) => t.integration_id === id)
      .map((t) => ({ id: String(t.id), title: String(t.title), level: String(t.level), state: String(t.state), file: text(t.file), startsFrom: targets(startsFrom, String(t.id), 'source_id', 'target_id') }))
      .sort(byId),
  };
}

/** The integrations of the product, by ID: those whose ID starts with the product's. */
export function integrationSummariesFrom(rows: (table: string) => Row[], productId: string): IntegrationSummary[] {
  return rows('integration')
    .filter((i) => String(i.id).startsWith(`${productId}-`))
    .map((i) => ({ id: String(i.id), title: String(i.title) }))
    .sort(byId);
}
