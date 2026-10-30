// The Storage requirement aggregate (LA-AUT-A22): what the business needs kept of one aggregate or read model, and how
// well, with its storage requirement tests (each with the test data sets it starts from). A storage requirement sits under the one
// aggregate or read model whose data it is about, outside the aggregate. One instance is one storage requirement,
// whole; it holds only the links its own records start.
import type { Slice } from '../../platform/commands/definition.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { StorageRequirementRow, StorageRequirementTestRow } from '../../platform/data/tables.ts';
import { compareIds } from '../../platform/data/ids.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const STORAGE_REQUIREMENT_AGGREGATE = 'LA-AUT-A22';

/** How the interfaces reach the aggregate's commands: `lathe storage-requirement`, the storage_requirement_ tools, /api/storage-requirement/. */
export const STORAGE_REQUIREMENT_SLICE: Slice = { aggregate: STORAGE_REQUIREMENT_AGGREGATE, name: 'storage-requirement' };

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

/** A storage requirement test with the test data sets it starts from. */
export interface StorageRequirementTest {
  row: StorageRequirementTestRow;
  startsFrom: string[];
}

/** One storage requirement, whole. */
export interface StorageRequirement {
  /** The storage requirement's ID: the aggregate's root. */
  readonly root: string;
  requirement: StorageRequirementRow;
  /** Its storage requirement tests, by ID. */
  tests: StorageRequirementTest[];
}

/** The tables the Storage requirement aggregate keeps its rows in: its kinds and the relation its tests start. */
export const STORAGE_REQUIREMENT_TABLES = ['storage_requirement', 'storage_requirement_test', 'starts_from'] as const;

/** The kinds of the aggregate's records, each with the column that names its parent inside the aggregate. */
export const STORAGE_REQUIREMENT_KINDS = {
  storage_requirement: null,
  storage_requirement_test: 'storage_requirement_id',
} as const;

export type StorageRequirementKind = keyof typeof STORAGE_REQUIREMENT_KINDS;

/** A new storage requirement, with no tests yet. */
export function newStorageRequirement(requirement: StorageRequirementRow): StorageRequirement {
  return { root: requirement.id, requirement, tests: [] };
}

const byId = (a: { row: { id: string } }, b: { row: { id: string } }) => compareIds(a.row.id, b.row.id);

/** The storage requirements in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function storageRequirementsFrom(rows: (table: string) => Row[], only?: string): StorageRequirement[] {
  const requirements = rows('storage_requirement').filter((r) => only === undefined || r.id === only) as unknown as StorageRequirementRow[];
  if (!requirements.length) return [];
  const ids = new Set(requirements.map((r) => r.id));
  const testsOf = groupBy((rows('storage_requirement_test') as unknown as StorageRequirementTestRow[]).filter((t) => ids.has(t.storage_requirement_id)), (t) => t.storage_requirement_id);
  const startsFrom = bySource(rows('starts_from'));
  return requirements.map((requirement) => ({
    root: requirement.id,
    requirement,
    tests: groupOf(testsOf, requirement.id)
      .map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) }))
      .sort(byId),
  }));
}

/** The instance's rows, by table. */
export function storageRequirementRows(requirement: StorageRequirement): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  return new Map<string, Row[]>([
    ['storage_requirement', [asRow(requirement.requirement)]],
    ['storage_requirement_test', requirement.tests.map((t) => asRow(t.row))],
    ['starts_from', requirement.tests.flatMap((t) => t.startsFrom.map((target) => ({ source_id: t.row.id, target_id: target })))],
  ]);
}

/** The kind of the record with this ID inside the storage requirement, or undefined. */
export function kindInside(requirement: StorageRequirement, id: string): StorageRequirementKind | undefined {
  if (requirement.root === id) return 'storage_requirement';
  if (requirement.tests.some((t) => t.row.id === id)) return 'storage_requirement_test';
  return undefined;
}
