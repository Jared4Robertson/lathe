// The Integration read model (LA-AUT-RM34): an integration as its readers see it, with its adapter and its tests, and
// the integrations of a product in a list. Its projection builds them from the rows; it shares no type with the
// aggregate.
import type { Row } from '../../platform/data/rows.ts';
import type { ReadView } from '../../platform/data/rules.ts';

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

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface IntegrationTable {
  /** Each integration whole, by its ID, in ID order. */
  integrations: Map<string, IntegrationPage>;
  /** Each record inside an integration: the integration that holds it. */
  holding: Map<string, string>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

const text = (v: unknown): string | null => (v === undefined || v === null ? null : String(v));
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true });
const targets = (links: Row[], from: string, source: string, target: string) => links.filter((l) => l[source] === from).map((l) => String(l[target])).sort();

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function integrationTableFrom(view: ReadView): IntegrationTable {
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const r of view.rows(kind)) kinds.set(String(r.id), kind);
  const [startsFrom, meets, packages, adapters, tests] = ['starts_from', 'meets', 'package_use', 'adapter', 'integration_test'].map((t) => view.rows(t));
  const integrations = new Map<string, IntegrationPage>();
  const holding = new Map<string, string>();
  for (const integration of [...view.rows('integration')].sort((a, b) => byId({ id: String(a.id) }, { id: String(b.id) }))) {
    const id = String(integration.id);
    holding.set(id, id);
    const adapter = adapters.find((a) => a.integration_id === id);
    if (adapter) holding.set(String(adapter.id), id);
    integrations.set(id, {
      id,
      title: String(integration.title),
      system: text(integration.system),
      description: String(integration.description),
      adapter: adapter
        ? { id: String(adapter.id), title: String(adapter.title), file: text(adapter.file), description: String(adapter.description), meets: targets(meets, String(adapter.id), 'source_id', 'target_id'), packages: targets(packages, String(adapter.id), 'record_id', 'package') }
        : null,
      tests: tests
        .filter((t) => t.integration_id === id)
        .map((t) => {
          holding.set(String(t.id), id);
          return { id: String(t.id), title: String(t.title), level: String(t.level), state: String(t.state), file: text(t.file), startsFrom: targets(startsFrom, String(t.id), 'source_id', 'target_id') };
        })
        .sort(byId),
    });
  }
  return { integrations, holding, kinds };
}
