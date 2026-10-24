import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import type { DiagramSummary, Model } from '../src/types';

const sqlPath = (p: string) => p.replaceAll("'", "''");

async function withConnection<T>(work: (connection: DuckDBConnection) => Promise<T>): Promise<T> {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    return await work(connection);
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

async function readCsv(connection: DuckDBConnection, file: string) {
  return (await connection.runAndReadAll(
    `SELECT * FROM read_csv('${sqlPath(file)}', header = true, all_varchar = true)`,
  )).getRowObjectsJson();
}

// Lists the diagrams registered in model/diagrams.csv.
export function listDiagrams(modelDir: string): Promise<DiagramSummary[]> {
  return withConnection(async (c) => (await readCsv(c, path.join(modelDir, 'diagrams.csv'))) as unknown as DiagramSummary[]);
}

// Reads one diagram's CSVs through DuckDB and runs model/checks.sql against them.
export function loadModel(modelDir: string, slug: string): Promise<Model> {
  const diagramDir = path.join(modelDir, slug);
  return withConnection(async (c) => {
    const terms = (await readCsv(c, path.join(diagramDir, 'terms.csv'))) as unknown as Model['terms'];
    const links = (await readCsv(c, path.join(diagramDir, 'links.csv'))) as unknown as Model['links'];

    // checks.sql reads 'terms.csv' and 'links.csv' relative to the diagram folder; point it there.
    const checksSql = (await readFile(path.join(modelDir, 'checks.sql'), 'utf8'))
      .replace(/'(terms|links)\.csv'/g, (_m, name) => `'${sqlPath(path.join(diagramDir, `${name}.csv`))}'`);
    let checks: Model['checks'] = { ok: true, message: 'All checks passed' };
    try {
      await c.run(checksSql);
    } catch (error) {
      checks = { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
    return { terms, links, checks };
  });
}

const csvField = (value: string) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

export function slugify(title: string) {
  return title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// Creates a diagram folder with empty terms and links files, and registers it.
export async function createDiagram(modelDir: string, title: string, description: string): Promise<DiagramSummary> {
  const slug = slugify(title);
  if (!slug) throw new Error('Give the diagram a title with at least one letter or number.');
  const existing = await listDiagrams(modelDir);
  if (existing.some((d) => d.slug === slug) || existsSync(path.join(modelDir, slug))) {
    throw new Error(`A diagram called "${slug}" already exists.`);
  }
  const dir = path.join(modelDir, slug);
  await mkdir(dir);
  await writeFile(path.join(dir, 'terms.csv'), 'name,kind,context,status,definition\n');
  await writeFile(path.join(dir, 'links.csv'), 'source,relation,target,cardinality,status,note\n');
  await appendFile(path.join(modelDir, 'diagrams.csv'), `${[slug, title, description].map(csvField).join(',')}\n`);
  return { slug, title, description };
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

// API: GET /api/diagrams, POST /api/diagrams {title, description}, GET /api/diagrams/<slug>.
// Tells the page to reload whenever a file under model/ changes.
export function modelApi(modelDir: string): Plugin {
  return {
    name: 'lathe-model-api',
    configureServer(server) {
      server.middlewares.use('/api/diagrams', async (req, res) => {
        try {
          const slug = (req.url ?? '/').split('?')[0].replace(/^\/+|\/+$/g, '');
          if (!slug && req.method === 'GET') return send(res, 200, await listDiagrams(modelDir));
          if (!slug && req.method === 'POST') {
            const body = await readBody(req);
            const title = String(body.title ?? '').trim();
            return send(res, 201, await createDiagram(modelDir, title, String(body.description ?? '').trim()));
          }
          if (slug && req.method === 'GET') {
            if (!/^[a-z0-9-]+$/.test(slug) || !(await listDiagrams(modelDir)).some((d) => d.slug === slug)) {
              return send(res, 404, { error: `No diagram called "${slug}".` });
            }
            return send(res, 200, await loadModel(modelDir, slug));
          }
          send(res, 405, { error: 'Method not allowed' });
        } catch (error) {
          send(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      });
      server.watcher.add(modelDir);
      server.watcher.on('all', (_event, changed) => {
        if (changed.startsWith(modelDir)) server.ws.send({ type: 'custom', event: 'model:changed' });
      });
    },
  };
}
