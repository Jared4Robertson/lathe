// The shape every aggregate's repository has: load an instance whole by its root's ID, save it (only its own tables,
// exactly the rows that changed since it was loaded), and remove it whole, refused while anything else references
// what is in it. Each aggregate's repository extends it with how its rows make an instance and back.
import { DataFiles } from './data-files.ts';
import { describeKey, rowKey, type Row } from './rows.ts';
import type { Located } from './references.ts';
import type { Transaction } from './transaction.ts';

/** An instance's rows, by table. */
export type InstanceRows = Map<string, Row[]>;

/** One aggregate's repository over a transaction: it loads and saves that aggregate's instances and nothing else. */
export abstract class AggregateRepository<M extends { readonly root: string }> {
  protected readonly tx: Transaction;
  protected readonly files: DataFiles;
  /** The repository's name, such as UseCaseRepository. */
  private readonly name: string;
  /** Each loaded instance's rows as they were loaded, by table and key. */
  private readonly loaded = new WeakMap<M, Map<string, Map<string, Row>>>();

  constructor(tx: Transaction, name: string, tables: readonly string[]) {
    this.tx = tx;
    this.name = name;
    this.files = new DataFiles(tx, name, tables);
  }

  /** The instance whose root has this ID, built from its rows, or undefined. */
  protected abstract read(rootId: string): M | undefined;

  /** The instance's rows, by table: its root, its entities, their parts and the links they start. */
  protected abstract rowsOf(instance: M): InstanceRows;

  /** Loads the instance whole, by its root's ID. */
  load(rootId: string): M | undefined {
    const instance = this.read(rootId);
    if (instance) this.loaded.set(instance, this.keyed(this.rowsOf(instance)));
    return instance;
  }

  /** A new instance, not saved yet: its save adds every row it has. */
  create(instance: M): M {
    this.loaded.set(instance, new Map());
    return instance;
  }

  /**
   * Saves the instance: puts the rows added or changed since it was loaded and deletes those it no longer has. A row
   * whose key another instance already holds is refused, and so is a removal while anything else references the row.
   */
  save(instance: M): void {
    const before = this.loaded.get(instance) ?? this.tx.refuse('repository', `${this.name} saves only an instance it loaded or created`);
    const after = this.keyed(this.rowsOf(instance));
    const removed: Located[] = [];
    for (const [table, rows] of before) {
      for (const [key, row] of rows) {
        if (after.get(table)?.has(key)) continue;
        this.files.delete(table, row);
        removed.push({ table, row });
      }
    }
    for (const [table, rows] of after) {
      for (const [key, row] of rows) {
        const was = before.get(table)?.get(key);
        if (was && JSON.stringify(was) === JSON.stringify(row)) continue;
        if (!was) {
          const taken = this.files.find(table, row);
          if (taken) this.tx.refuse('primary-key', `${table} ${describeKey(this.tx.schema.tables[table], row)} already exists`);
        }
        this.files.put(table, row);
      }
    }
    this.files.refuseWhileReferenced(removed);
    this.loaded.set(instance, after);
  }

  /** Removes the instance whole: every row it has. Refused, naming what does, while anything else references them. */
  remove(instance: M): void {
    const before = this.loaded.get(instance) ?? this.tx.refuse('repository', `${this.name} removes only an instance it loaded`);
    const removed: Located[] = [];
    for (const [table, rows] of before) {
      for (const row of rows.values()) {
        this.files.delete(table, row);
        removed.push({ table, row });
      }
    }
    this.files.refuseWhileReferenced(removed);
    this.loaded.delete(instance);
  }

  // The rows by table and key.
  private keyed(rows: InstanceRows): Map<string, Map<string, Row>> {
    const keyed = new Map<string, Map<string, Row>>();
    for (const [table, list] of rows) {
      const description = this.tx.schema.tables[table];
      keyed.set(table, new Map(list.map((row) => [rowKey(description, row), row])));
    }
    return keyed;
  }
}
