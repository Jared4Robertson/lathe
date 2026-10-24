import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';
import { DuckDBInstance } from '@duckdb/node-api';
import type { Model } from '../src/types';

// Reads the model CSVs through DuckDB and runs model/checks.sql against them.
export async function loadModel(modelDir: string): Promise<Model> {
  const file = (name: string) => path.join(modelDir, name).replaceAll("'", "''");
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    const read = async (name: string) =>
      (await connection.runAndReadAll(
        `SELECT * FROM read_csv('${file(name)}', header = true, all_varchar = true)`,
      )).getRowObjectsJson();

    const terms = (await read('terms.csv')) as unknown as Model['terms'];
    const links = (await read('links.csv')) as unknown as Model['links'];

    // checks.sql refers to 'model/...' relative to the repo root; point it at the real folder.
    const checksSql = (await readFile(path.join(modelDir, 'checks.sql'), 'utf8'))
      .replaceAll("'model/", `'${file('')}${path.sep}`);
    let checks: Model['checks'] = { ok: true, message: 'All checks passed' };
    try {
      await connection.run(checksSql);
    } catch (error) {
      checks = { ok: false, message: error instanceof Error ? error.message : String(error) };
    }

    return { terms, links, checks };
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

// Serves the model at /api/model and tells the page to reload it when a model file changes.
export function modelApi(modelDir: string): Plugin {
  return {
    name: 'lathe-model-api',
    configureServer(server) {
      server.middlewares.use('/api/model', async (_req, res) => {
        res.setHeader('content-type', 'application/json');
        try {
          res.end(JSON.stringify(await loadModel(modelDir)));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        }
      });
      server.watcher.add(modelDir);
      server.watcher.on('change', (changed) => {
        if (changed.startsWith(modelDir)) server.ws.send({ type: 'custom', event: 'model:changed' });
      });
    },
  };
}
