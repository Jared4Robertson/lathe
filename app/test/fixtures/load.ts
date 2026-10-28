import { inject } from 'vitest';
import type { Row, SpecData, Value } from '../../../lathe/src/server/contract';
import { buildWorkspace, indexWorkspace, type SpecIndex } from '../../src/specs/data';

// The fixtures: each a data folder under fixtures/data/, written with the store and loaded through
// it by fixtures/global-setup.ts, plus the problems, recorded exceptions and coverage the engine
// would find, which each fixture module gives (no recorded exceptions unless it says so). A test may change a fixture's rows for its case with the helpers here.

/** What the global setup loads of a fixture: what GET /api/spec serves, with the engine's chains but without the checks' findings (one source, data). */
export type FixtureRows = Omit<SpecData, 'problems' | 'exceptions' | 'coverage'>;

declare module 'vitest' {
  export interface ProvidedContext {
    fixtures: Record<string, FixtureRows>;
  }
}

/** A fixture's data with the engine's findings, as GET /api/spec would serve it: a fresh copy each time. */
export function fixture(name: string, found: Pick<SpecData, 'problems' | 'coverage'> & Partial<Pick<SpecData, 'exceptions'>>): SpecData {
  const rows = inject('fixtures')[name];
  if (!rows) throw new Error(`No fixture data folder ${name}.`);
  return structuredClone({ exceptions: [], ...rows, ...found });
}

/** The index the app builds from the data. */
export const indexOf = (data: SpecData): SpecIndex => indexWorkspace(buildWorkspace(data));

/** Adds rows to a table. */
export function addRows(data: SpecData, table: string, ...rows: Row[]): SpecData {
  const { tables } = data.sources[0];
  tables[table] = [...(tables[table] ?? []), ...rows];
  return data;
}

/** Changes a record's columns (null clears one). */
export function setRow(data: SpecData, table: string, id: string, changes: Record<string, Value | null>): SpecData {
  const row = (data.sources[0].tables[table] ?? []).find((r) => r.id === id);
  if (!row) throw new Error(`No ${table} row ${id}.`);
  for (const [column, value] of Object.entries(changes)) {
    if (value === null) delete row[column];
    else row[column] = value;
  }
  return data;
}

/** Removes the rows of a table that match. */
export function removeRows(data: SpecData, table: string, matches: (row: Row) => boolean): SpecData {
  const { tables } = data.sources[0];
  tables[table] = (tables[table] ?? []).filter((r) => !matches(r));
  return data;
}

/** Every record ID in the data, by its kind's table. */
export function recordIds(data: SpecData): string[] {
  return Object.keys(data.schema.kinds).flatMap((kind) => data.sources.flatMap((source) => source.tables[kind] ?? []).map((r) => String(r.id)));
}
