// What the engine's tests share: fixture folders (each a product root with data/*.jsonl written by the store), loading
// them with Lathe's built-in checks, and building a small product from rows to see what the store refuses.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorkspace, openStore, StoreError, type Problem, type StoreProblem, type Workspace } from '../src/index.ts';
import { writeData, type Data } from './store/fixture.ts';

export { everyKind, removeData, withTable, writeData, type Data } from './store/fixture.ts';

/** A fixture folder's path: lathe/test/fixtures/<name>, a product root with its data/ folder. */
export const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);

/** Loads a fixture with Lathe's built-in checks. */
export const load = (name: string): Promise<Workspace> => loadWorkspace(fixture(name));

/** The problems one check found. */
export const ofCheck = (ws: Workspace, check: string): Problem[] => ws.problems.filter((p) => p.check === check);

/** The records a list of problems is about, sorted. */
export const records = (problems: Problem[]) => problems.map((p) => p.record).sort();

/** Writes the rows as a fresh product's data files and loads them with Lathe's built-in checks. */
export const loadData = (data: Data): Promise<Workspace> => loadWorkspace(writeData(data));

/** What the store refuses when the rows are loaded, or [] when they load. */
export async function refusals(data: Data): Promise<StoreProblem[]> {
  try {
    const store = await openStore(writeData(data), { latheDataDir: null });
    await store.close();
    return [];
  } catch (error) {
    if (error instanceof StoreError) return error.problems;
    throw error;
  }
}
