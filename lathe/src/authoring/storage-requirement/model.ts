// The Storage requirement aggregate (LA-AUT-A22): what the business needs kept of one aggregate or read model, and how
// well, with its storage requirement tests (each with the test data sets it starts from). A storage requirement sits under the one
// aggregate or read model whose data it is about, outside the aggregate. One instance is one storage requirement,
// whole; it holds only the links its own records start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { StorageRequirementRow, StorageRequirementTestRow } from '../../platform/data/tables.ts';
import { compareIds } from '../../platform/data/ids.ts';

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

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const STORAGE_REQUIREMENT_SHAPE = {
  storage_requirement: { at: 'requirement' },
  storage_requirement_test: { at: 'tests', lists: { starts_from: 'startsFrom' } },
} as const satisfies AggregateShape;

export type StorageRequirementKind = keyof typeof STORAGE_REQUIREMENT_SHAPE;

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

