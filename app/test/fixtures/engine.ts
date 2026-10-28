import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect } from 'vitest';
import { loadWorkspace, SCHEMA_VERSION } from '../../../lathe/src/index';
import type { SpecData } from '../../../lathe/src/server/contract';
import type { Workspace } from '../../../lathe/src/types';

// A fixture's rows, as a test changed them, loaded through the real engine: written to a fresh product folder with
// no code files, and checked with only the fixture's own check rows. For the tests that hold the app to the engine's
// answer, and that keep a fixture's hand-written findings honest.

/** What the engine finds in the data's rows. */
export async function throughEngine(data: SpecData, files: Record<string, string> = {}): Promise<Workspace> {
  const root = await mkdtemp(path.join(tmpdir(), 'lathe-fixture-'));
  try {
    const dataDir = path.join(root, 'data');
    await mkdir(dataDir);
    await writeFile(path.join(root, 'lathe.config.json'), `${JSON.stringify({ schema: SCHEMA_VERSION })}\n`);
    for (const [table, rows] of Object.entries(data.tables)) {
      await writeFile(path.join(dataDir, `${table}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    }
    for (const [file, text] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), text);
    }
    return await loadWorkspace(root, { dataDir, latheDataDir: null });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** The data with the engine's findings in place of the hand-written ones, as GET /api/spec would serve it. */
export async function servedByEngine(data: SpecData, files: Record<string, string> = {}): Promise<SpecData> {
  const ws = await throughEngine(data, files);
  return { ...structuredClone(data), problems: ws.problems, exceptions: ws.exceptions, coverage: ws.coverage };
}

/** Expects a fixture's hand-written pattern rule standings to be the engine's, domain by domain. */
export async function expectStandingsAsEngine(data: SpecData): Promise<void> {
  const ws = await throughEngine(data);
  const standings = (coverage: SpecData['coverage']) =>
    Object.fromEntries(coverage.filter((c) => c.domain !== null && Object.keys(c.pattern_rules).length > 0).map((c) => [c.domain, c.pattern_rules]));
  expect(standings(data.coverage)).toEqual(standings(ws.coverage));
}
