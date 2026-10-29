// The Tooling read model (LA-AUT-RM41): what the Tooling aggregate's queries answer with, shaped for their
// readers (the tooling record's page and a list of a domain's tooling) and built from rows by its projection. It
// shares no types with the aggregate's model.
import type { ReadView } from '../../platform/data/rules.ts';
import type { ToolingRow } from '../../platform/data/tables.ts';

/** One tooling record's page: its row, the packages it uses and the standard rules it meets. */
export interface ToolingPage {
  tooling: ToolingRow;
  /** The packages it uses, sorted. */
  packages: string[];
  /** The standard rules it meets, sorted. */
  meets: string[];
}

/** One line of a list of tooling records. */
export interface ToolingSummary {
  id: string;
  title: string;
}

/** The projection: each tooling record's page, from the rows; only the one given, when given. */
export function toolingPagesFrom(view: ReadView, only?: string): ToolingPage[] {
  const found = (view.rows('tooling') as unknown as ToolingRow[]).filter((r) => only === undefined || r.id === only);
  if (!found.length) return [];
  const packages = view.rows('package_use');
  const meets = view.rows('meets');
  return found.map((tooling) => ({
    tooling,
    packages: packages.filter((p) => p.record_id === tooling.id).map((p) => String(p.package)).sort(),
    meets: meets.filter((m) => m.source_id === tooling.id).map((m) => String(m.target_id)).sort(),
  }));
}

/** The projection's list: a domain's tooling records, by ID. */
export function toolingSummariesFrom(view: ReadView, domain: string): ToolingSummary[] {
  return view
    .rows('tooling')
    .filter((r) => r.domain_id === domain)
    .map((r) => ({ id: String(r.id), title: String(r.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
