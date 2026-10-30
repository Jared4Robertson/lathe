// What a rule or a read model's projection read: the tables it asked for, so a change to other tables leaves its
// result standing. A reload reruns only the aggregates' rules whose tables changed, and only the projections whose
// tables changed are built again (LA-PLT-UC03-R03).
//
// The tables are learned by running the code, not declared beside it, so they cannot drift from it: each run reads
// the data through a view that notes every table it asks for. A record looked up by its ID reads each kind's table it
// looks in, up to the one that holds it (a change to an earlier kind's table could give it the ID). What a run read is
// added to everything it read before, so a run that reads more on other data only ever widens the set.
import type { ReadView } from './rules.ts';
import type { Row } from './rows.ts';
import type { SchemaDescription, TableDescription } from './schema.ts';
import type { Tables } from './transaction.ts';

/**
 * A view of the tables that notes each table read into `reads`. Rows come as `rowsOf` gives them. A record looked up
 * once is kept for the view's life: the tables it reads never change, and the lookup noted the kinds it looked in.
 */
export function trackedView(schema: SchemaDescription, tables: Tables, reads: Set<string>, rowsOf: (table: string) => Row[]): ReadView {
  const kinds = Object.keys(schema.kinds);
  const found = new Map<string, { kind: string; row: Row } | undefined>();
  return {
    schema,
    rows: (table) => {
      reads.add(table);
      return rowsOf(table);
    },
    record: (id) => {
      if (found.has(id)) return found.get(id);
      let record: { kind: string; row: Row } | undefined;
      for (const kind of kinds) {
        reads.add(kind);
        const row = tables.get(kind)?.get(id);
        if (row) { record = { kind, row }; break; }
      }
      found.set(id, record);
      return record;
    },
  };
}

/** The tables each piece of code read, by the code (a rule set, a reader's factory), added to over every run. */
export class ReadSets<K> {
  private readonly sets = new Map<K, Set<string>>();

  /** Adds what one run read. */
  add(key: K, reads: Iterable<string>): void {
    const known = this.sets.get(key) ?? new Set<string>();
    for (const table of reads) known.add(table);
    this.sets.set(key, known);
  }

  /** What the code has read so far, or undefined when it never ran. */
  of(key: K): ReadonlySet<string> | undefined {
    return this.sets.get(key);
  }

  /** Whether a change to these tables can change what the code gives: it read one of them, or it never ran. */
  touched(key: K, changed: ReadonlySet<string>): boolean {
    const reads = this.sets.get(key);
    if (!reads) return true;
    for (const table of reads) if (changed.has(table)) return true;
    return false;
  }
}

// The rows of a table the keys read, by the columns of the key: the registry and the supertypes from the kinds' rows.
function keyIndex(schema: SchemaDescription, tables: Tables, target: string, columns: string[], cache: Map<string, Set<string>>): Set<string> | null {
  const id = `${target}(${columns.join(',')})`;
  const known = cache.get(id);
  if (known) return known;
  const description = schema.tables[target];
  let rows: Iterable<Row>;
  if (description.role === 'registry') rows = Object.keys(schema.kinds).flatMap((kind) => [...(tables.get(kind)?.values() ?? [])].map((row) => ({ id: row.id, kind })));
  else if (description.role === 'supertype') rows = schema.supertypes[target].flatMap((kind) => [...(tables.get(kind)?.values() ?? [])].map((row) => ({ id: row.id, kind })));
  else if (description.stored) rows = tables.get(target)?.values() ?? [];
  else return null;
  const index = new Set<string>();
  for (const row of rows) index.add(columns.map((c) => String(row[c])).join('\u0000'));
  cache.set(id, index);
  return index;
}

// Whether a foreign key's target is one a change to these tables can touch: the table itself, or for a kind, the
// registry and its supertypes.
function targetChanged(schema: SchemaDescription, target: TableDescription, changed: ReadonlySet<string>): boolean {
  if (changed.has(target.name)) return true;
  if (target.role === 'registry') return [...changed].some((t) => schema.kinds[t]);
  if (target.role === 'supertype') return schema.supertypes[target.name].some((kind) => changed.has(kind));
  return false;
}

/**
 * Whether the keys still hold after the changed tables were read again: each of their rows' foreign keys names a row
 * that is there, every row that points into them still finds its target, and no two rows of a changed table share a
 * unique key. Only the database's own CHECK constraints and keys into the meta-model are left to the full build.
 */
export function keysHold(schema: SchemaDescription, tables: Tables, changed: ReadonlySet<string>): boolean {
  const cache = new Map<string, Set<string>>();
  for (const table of Object.values(schema.tables)) {
    if (!table.stored) continue;
    const own = changed.has(table.name);
    for (const fk of table.foreignKeys) {
      const target = schema.tables[fk.table];
      if (!own && !targetChanged(schema, target, changed)) continue;
      const index = keyIndex(schema, tables, fk.table, fk.references, cache);
      if (!index) continue;
      for (const row of tables.get(table.name)?.values() ?? []) {
        const values = fk.columns.map((c) => row[c]);
        if (values.some((v) => v === undefined)) continue;
        if (!index.has(values.map(String).join('\u0000'))) return false;
      }
    }
    if (!own) continue;
    for (const unique of table.unique) {
      const seen = new Set<string>();
      for (const row of tables.get(table.name)?.values() ?? []) {
        const values = unique.map((c) => row[c]);
        if (values.some((v) => v === undefined)) continue;
        const key = values.map(String).join('\u0000');
        if (seen.has(key)) return false;
        seen.add(key);
      }
    }
  }
  return true;
}
