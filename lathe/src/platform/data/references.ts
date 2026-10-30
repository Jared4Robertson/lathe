// What references a set of rows about to go: every other row whose foreign key names one of them, through the
// registry and the supertypes for a record. A removal is refused while anything still does.
import { describeKey, type Row } from './rows.ts';
import type { SchemaDescription } from './schema.ts';

/** A row with its table. */
export interface Located {
  table: string;
  row: Row;
}

/** What still references the rows being removed, as readable lines: a link as its two ends, any other row by its key. */
export function referrers(schema: SchemaDescription, tables: Map<string, Map<string, Row>>, removed: Located[]): string[] {
  const gone = new Set(removed.map((r) => r.row));
  const found: string[] = [];
  const recordTables = new Set<string>();
  for (const r of removed) {
    if (schema.tables[r.table].role === 'kind') {
      recordTables.add('record_id');
      for (const s of schema.kinds[r.table].supertypes) recordTables.add(s);
    }
  }
  for (const t of Object.values(schema.tables)) {
    if (!t.stored) continue;
    for (const fk of t.foreignKeys) {
      const targets = removed.filter((r) => r.table === fk.table || (recordTables.has(fk.table) && schema.tables[r.table].role === 'kind'));
      if (!targets.length) continue;
      for (const row of tables.get(t.name)?.values() ?? []) {
        if (gone.has(row)) continue;
        const hit = targets.find((target) => fk.columns.every((c, i) => row[c] !== undefined && row[c] === target.row[fk.references[i]]));
        if (!hit) continue;
        found.push(t.role === 'link' ? `${row.source_id} ${schema.relations[t.name].forwardLabel.toLowerCase()} ${row.target_id}` : `${t.name} ${describeKey(t, row)} (${fk.columns.join(', ')})`);
      }
    }
  }
  return [...new Set(found)];
}

/** The referrers as the end of a refusal: the first 20, and how many more. */
export const referrersText = (found: string[]): string => `${found.slice(0, 20).join('; ')}${found.length > 20 ? `; and ${found.length - 20} more` : ''}`;
