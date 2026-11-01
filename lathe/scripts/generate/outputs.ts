// Every output of `npm run generate`, in the order it writes them.
import { DuckDBInstance } from '@duckdb/node-api';
import { applyMigrations, describeSchema, type SchemaDescription } from '../../src/platform/data/schema.ts';
import { aggregateFiles } from './aggregates.ts';
import { fieldFiles } from './fields.ts';
import { identityFiles, identityScaffolds } from './identities.ts';
import type { Generated, Output } from './output.ts';

export const OUTPUTS: readonly Output[] = [
  { name: 'command and query identities', files: identityFiles, scaffolds: identityScaffolds },
  { name: 'the app\'s form fields', files: fieldFiles },
  { name: 'aggregates\' repositories and pattern commands\' handlers', files: aggregateFiles },
];

/** Lathe's schema, described from its migrations. */
async function lathesSchema(): Promise<SchemaDescription> {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    await applyMigrations(connection);
    return await describeSchema(connection);
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

/** Every generated file of every output. */
export async function generatedFiles(repo: string): Promise<Generated> {
  const schema = await lathesSchema();
  return new Map(OUTPUTS.flatMap((o) => [...o.files(repo, schema)]));
}

/** Every scaffold of every output: the files to start, or to add a definition to. */
export function scaffoldFiles(repo: string): Generated {
  return new Map(OUTPUTS.flatMap((o) => [...(o.scaffolds?.(repo) ?? [])]));
}
