import type { ServedData } from '../read-view';
import path from 'node:path';
import { loadConfig, readWorkspace } from '../../../lathe/src/index';
import { openStore } from '../../../lathe/src/platform/data/index';
import { joinSchemas } from '../../../lathe/src/server/api';

// This repo's own products as the workspace serves them, for the tests that hold every stage to real data: Lathe's
// (data/) and the Tool Library's (examples/tool-library/), each read through its own store. With `chains`, each
// obligation's chain as the engine works it out from the code files too, for the Trace stage.

export async function repoData({ chains = false } = {}): Promise<ServedData> {
  const repo = path.resolve(import.meta.dirname, '../../..');
  const data: ServedData = { schema: undefined as unknown as ServedData['schema'], sources: [], placements: {}, problems: [], exceptions: [], coverage: [], chains: [] };
  const schemas: ServedData['schema'][] = [];
  for (const root of [repo, path.join(repo, 'examples/tool-library')]) {
    const store = await openStore(root);
    try {
      schemas.push(store.schema);
      const tables: ServedData['sources'][number]['tables'] = {};
      for (const table of store.schema.loadOrder) if (store.rows(table).length) tables[table] = store.rows(table);
      data.sources.push({ dataDir: path.relative(repo, store.dataDir), tables });
      Object.assign(data.placements, await store.placements());
      if (chains) data.chains.push(...(await readWorkspace(store, loadConfig(root))).chains);
    } finally {
      await store.close();
    }
  }
  data.schema = joinSchemas(schemas);
  return data;
}
