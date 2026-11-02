// An aggregate's rows in a transaction's draft, scoped to the tables its repository owns: it reads and writes those
// tables and no other, and a write to any other is refused when it is made; only the new IDs a move gives are carried
// into every table (carryRenames). Only a repository (*/repository.ts)
// imports this module; a test holds every other file to that.
import { normalizeRow, rowKey, describeKey, type Row } from './rows.ts';
import type { TableDescription } from './schema.ts';
import { referrers, referrersText, type Located } from './references.ts';
import { renamedRow, type Renames } from './renames.ts';
import { draftOf, editableTable, type Transaction } from './transaction.ts';

/** A repository's tables in a transaction: rows read, put and deleted only there. */
export class DataFiles {
  private readonly tx: Transaction;
  /** The repository's name, for its refusals. */
  private readonly owner: string;
  private readonly owned: ReadonlySet<string>;

  constructor(tx: Transaction, owner: string, tables: readonly string[]) {
    this.tx = tx;
    this.owner = owner;
    this.owned = new Set(tables);
  }

  // The table, when the repository owns it; any other is refused.
  private table(name: string): TableDescription {
    if (!this.owned.has(name)) {
      this.tx.refuse('repository-scope', `${this.owner} loads and saves only its own tables (${[...this.owned].sort().join(', ')}); ${name} is not one of them`);
    }
    return this.tx.schema.tables[name] ?? this.tx.refuse('unknown-table', `there is no table ${name}`);
  }

  /** The table's rows. */
  rows(table: string): Row[] {
    this.table(table);
    return this.tx.rows(table);
  }

  /** The row of the table with this key, or undefined. */
  find(table: string, key: Row): Row | undefined {
    const description = this.table(table);
    return draftOf(this.tx).tables.get(table)?.get(rowKey(description, key));
  }

  /** Puts the row in its table, in its normal form, in place of the row with its key. */
  put(table: string, row: Row): void {
    const description = this.table(table);
    const result = normalizeRow(description, row);
    if ('problem' in result) this.tx.refuse(result.problem.includes('is required') ? 'required' : 'column', `${table}: ${result.problem}`);
    const normal = (result as { row: Row }).row;
    editableTable(this.tx, table).set(rowKey(description, normal), normal);
  }

  /** Deletes the row with the row's key from its table. */
  delete(table: string, row: Row): void {
    const description = this.table(table);
    const key = rowKey(description, row);
    if (!draftOf(this.tx).tables.get(table)?.has(key)) return;
    editableTable(this.tx, table).delete(key);
  }

  /**
   * Carries the new IDs a move gave the repository's records into every stored row of every table, its own and every
   * other: a key, a foreign key, an item of a list or a mention in text that names an old ID names the new one, as a
   * foreign key with ON UPDATE CASCADE would (renames.ts). The one write outside the repository's own tables, and it
   * changes only IDs. A new ID another record already has is refused.
   */
  carryRenames(renames: Renames): void {
    if (!renames.size) return;
    for (const [from, to] of renames) {
      const taken = this.tx.record(to);
      if (taken && !renames.has(to)) this.tx.refuse('id-taken', `${from} cannot become ${to}: ${this.tx.schema.kinds[taken.kind].label} ${to} already has that ID`);
    }
    const { tables, renamed: renamedRows } = draftOf(this.tx);
    for (const [name, rows] of [...tables]) {
      const description = this.tx.schema.tables[name];
      if (!description?.stored) continue;
      const changed = [...rows].flatMap(([key, row]) => {
        if (this.tx.isBuiltIn(row)) return [];
        const renamed = renamedRow(row, renames);
        return renamed === row ? [] : [{ key, renamed }];
      });
      if (!changed.length) continue;
      const editable = editableTable(this.tx, name);
      for (const { key } of changed) editable.delete(key);
      for (const { renamed } of changed) {
        editable.set(rowKey(description, renamed), renamed);
        renamedRows.add(renamed);
      }
    }
  }

  /**
   * Refuses the removal of these rows, already deleted, while anything left in the draft references one of them. The
   * refusal names the first record removed, or the first row.
   */
  refuseWhileReferenced(removed: Located[]): void {
    if (!removed.length) return;
    const found = referrers(this.tx.schema, draftOf(this.tx).tables, removed);
    if (!found.length) return;
    const first = removed.find((r) => this.tx.schema.kinds[r.table]) ?? removed[0];
    const kind = this.tx.schema.kinds[first.table];
    const what = kind ? `${kind.label} ${first.row.id}` : `${first.table} ${describeKey(this.tx.schema.tables[first.table], first.row)}`;
    this.tx.refuse('referenced', `${what} is referenced, so it stays: ${referrersText(found)}`);
  }
}
