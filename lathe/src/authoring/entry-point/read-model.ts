// The Entry point read model (LA-AUT-RM40): what the Entry point aggregate's queries answer with, shaped for their
// readers (the entry point's page and a list of a domain's entry points) and built from rows by its projection. It
// shares no types with the aggregate's model.
import type { ReadView } from '../../platform/data/rules.ts';
import type { EntryPointRow } from '../../platform/data/tables.ts';

/** One entry point's page: its row, the packages it uses and the standard rules it meets. */
export interface EntryPointPage {
  entryPoint: EntryPointRow;
  /** The packages it uses, sorted. */
  packages: string[];
  /** The standard rules it meets, sorted. */
  meets: string[];
}

/** One line of a list of entry points. */
export interface EntryPointSummary {
  id: string;
  title: string;
}

/** The projection: each entry point's page, from the rows; only the one given, when given. */
export function entryPointPagesFrom(view: ReadView, only?: string): EntryPointPage[] {
  const found = (view.rows('entry_point') as unknown as EntryPointRow[]).filter((r) => only === undefined || r.id === only);
  if (!found.length) return [];
  const packages = view.rows('package_use');
  const meets = view.rows('meets');
  return found.map((entryPoint) => ({
    entryPoint,
    packages: packages.filter((p) => p.record_id === entryPoint.id).map((p) => String(p.package)).sort(),
    meets: meets.filter((m) => m.source_id === entryPoint.id).map((m) => String(m.target_id)).sort(),
  }));
}

/** The projection's list: a domain's entry points, by ID. */
export function entryPointSummariesFrom(view: ReadView, domain: string): EntryPointSummary[] {
  return view
    .rows('entry_point')
    .filter((r) => r.domain_id === domain)
    .map((r) => ({ id: String(r.id), title: String(r.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
