// CSV diagrams: diagrams.csv lists them, and each has a folder with terms.csv and links.csv.
// Read through DuckDB and checked with the package's diagrams/checks.sql.
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { PACKAGE_DIR } from '../config.ts';
import type { DiagramModel, DiagramSummary } from '../types.ts';

const DIAGRAM_CHECKS = path.join(PACKAGE_DIR, 'diagrams', 'checks.sql');
const DIAGRAMS_HEADER = 'slug,title,description\n';
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

/** Lists the diagrams in diagrams.csv, or none when the folder has no diagrams yet. */
export async function listDiagrams(diagramsDir: string): Promise<DiagramSummary[]> {
  const file = path.join(diagramsDir, 'diagrams.csv');
  if (!existsSync(file) || (await readFile(file, 'utf8')).trim() === DIAGRAMS_HEADER.trim()) return [];
  return withConnection(async (c) => (await readCsv(c, file)) as unknown as DiagramSummary[]);
}

/** Reads one diagram's CSVs and runs the diagram checks against them. */
export function loadDiagram(diagramsDir: string, slug: string): Promise<DiagramModel> {
  const dir = path.join(diagramsDir, slug);
  return withConnection(async (c) => {
    const terms = (await readCsv(c, path.join(dir, 'terms.csv'))) as unknown as DiagramModel['terms'];
    const links = (await readCsv(c, path.join(dir, 'links.csv'))) as unknown as DiagramModel['links'];
    // The checks read 'terms.csv' and 'links.csv' relative to the diagram folder; point them there.
    const checksSql = (await readFile(DIAGRAM_CHECKS, 'utf8'))
      .replace(/'(terms|links)\.csv'/g, (_m, name) => `'${sqlPath(path.join(dir, `${name}.csv`))}'`);
    let checks: DiagramModel['checks'] = { ok: true, message: 'All checks passed' };
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
  return title.toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/** Creates a diagram folder with empty terms and links files, and registers it. */
export async function createDiagram(diagramsDir: string, title: string, description: string): Promise<DiagramSummary> {
  const slug = slugify(title);
  if (!slug) throw new Error('Give the diagram a title with at least one letter or number.');
  const existing = await listDiagrams(diagramsDir);
  if (existing.some((d) => d.slug === slug) || existsSync(path.join(diagramsDir, slug))) {
    throw new Error(`A diagram called "${slug}" already exists.`);
  }
  const dir = path.join(diagramsDir, slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'terms.csv'), 'name,kind,context,status,definition\n');
  await writeFile(path.join(dir, 'links.csv'), 'source,relation,target,cardinality,status,note\n');
  const registry = path.join(diagramsDir, 'diagrams.csv');
  if (!existsSync(registry)) await writeFile(registry, DIAGRAMS_HEADER);
  await appendFile(registry, `${[slug, title, description].map(csvField).join(',')}\n`);
  return { slug, title, description };
}
