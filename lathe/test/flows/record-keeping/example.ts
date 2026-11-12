// What the record-keeping flow tests share: a temporary product that starts as a copy of the tool library example's
// records (journeys, outcomes, a record kind and relation of its own, tables, entry points, tooling, patterns with
// their followers and fills), and a copy of one of its rows under another ID.
import { cpSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LATHE_DIR, add, type Product, type Seed } from '../product.ts';

/** Replaces the product's records with the tool library example's. */
export function copyExample(tl: Product): void {
  cpSync(path.join(LATHE_DIR, '..', 'examples', 'tool-library', 'data'), path.join(tl.root, 'data'), { recursive: true });
}

/** A row of the example's data file, as a seed: the one with the ID, with the fields given in place of its own. */
export function copyRow(table: string, id: string, patch: Record<string, unknown>): Seed {
  const rows = readFileSync(path.join(LATHE_DIR, '..', 'examples', 'tool-library', 'data', `${table}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`the example has no ${table} ${id}`);
  return add(table, { ...row, ...patch });
}
