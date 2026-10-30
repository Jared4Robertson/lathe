import { readdirSync } from 'node:fs';
import path from 'node:path';
import type { TestProject } from 'vitest/node';
import { readWorkspace } from '../../../lathe/src/index';
import { openStore } from '../../../lathe/src/platform/data/index';
import type { FixtureRows } from './load';

// Loads every fixture data folder (app/test/fixtures/data/<name>/, one <table>.jsonl per table) through
// the store once per run, so each is checked against the schema as a product's data is, and hands
// the tests its schema, its rows and each obligation's chain as the engine works it out (fixtures/load.ts).
// The files the rows name do not exist, so no chain lists one.

const DATA = path.join(import.meta.dirname, 'data');

export default async function setup(project: TestProject) {
  const fixtures: Record<string, FixtureRows> = {};
  for (const name of readdirSync(DATA).sort()) {
    const dir = path.join(DATA, name);
    // Without Lathe's own checks beside it: a fixture holds the check rows its tests need.
    const store = await openStore(dir, { dataDir: dir, latheDataDir: null });
    try {
      const tables: FixtureRows['sources'][number]['tables'] = {};
      for (const table of store.schema.loadOrder) {
        const rows = store.rows(table);
        if (rows.length > 0) tables[table] = rows;
      }
      const { chains } = await readWorkspace(store, { root: dir, source: [], tests: [], routers: [], packages: [] });
      fixtures[name] = { schema: store.schema, sources: [{ dataDir: 'data', tables }], chains };
    } finally {
      await store.close();
    }
  }
  project.provide('fixtures', fixtures);
}
