// The shape every aggregate's repository has: load an instance whole by its root's ID, save it (only its own tables,
// exactly the rows that changed since it was loaded), and remove it whole, refused while anything else references
// what is in it. Each aggregate's repository extends it with how its rows make an instance and back.
import { DataFiles } from './data-files.ts';
import { describeKey, rowKey, type Row } from './rows.ts';
import type { Located } from './references.ts';
import type { Renames } from './renames.ts';
import type { Transaction } from './transaction.ts';

/** An instance's rows, by table. */
export type InstanceRows = Map<string, Row[]>;

/**
 * How one of an aggregate's kinds sits in an instance: the instance's property that holds its records (`at`), whether
 * it has at most one (`one`: the property then holds it or null), its lists by input field with the property that holds
 * each (`lists`: the links it starts, and its parts as rows, owned and numbered), its parts held as the input gives
 * them (`given`: owned and numbered only as its rows are written) and its single links (`links`: the one record it
 * names, or null). A kind with any of them is held as its `row` beside them; the root's sit on the instance. Its parent
 * inside the aggregate is the schema's. `refusedBy` names the rule, exported by the aggregate's rules.ts, that a
 * command adding or changing one of the kind's records refuses with, over the kind's rows as it would save them: the
 * one each rule of a kind held at most once (a second is refused), or a rule over a kind's list (one test per domain).
 */
export interface KindShape {
  at: string;
  one?: true;
  lists?: Readonly<Record<string, string>>;
  given?: Readonly<Record<string, string>>;
  links?: Readonly<Record<string, string>>;
  refusedBy?: string;
}

/**
 * An aggregate's shape: each of its kinds by table name, the root first. `npm run generate` writes the aggregate's
 * repository and the handlers of its pattern commands (Add, Change and Remove of one kind) from it.
 */
export type AggregateShape = Readonly<Record<string, KindShape>>;

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
    if (instance) this.loaded.set(instance, this.keyed(this.storedRows(this.rowsOf(instance))));
    return instance;
  }

  /**
   * The instance's rows as they are stored. A part table's rows are taken from its file, every row its instance's
   * records own, not as the instance writes them back: an instance numbers its parts from 1 in order, so parts stored
   * with gaps in their positions (1, 3, 6) would otherwise be saved over by key and the ones past the end kept, beside
   * their renumbered copies.
   */
  private storedRows(rows: InstanceRows): InstanceRows {
    const owners = new Set<string>();
    for (const list of rows.values()) for (const row of list) if (typeof row.id === 'string') owners.add(row.id);
    const stored: InstanceRows = new Map();
    for (const [table, list] of rows) {
      const owner = this.tx.schema.tables[table]?.ownerColumn;
      if (!owner || this.tx.schema.tables[table].role !== 'part') { stored.set(table, list); continue; }
      for (const row of list) if (typeof row[owner] === 'string') owners.add(row[owner] as string);
      stored.set(table, this.files.rows(table).filter((row) => owners.has(row[owner] as string)));
    }
    return stored;
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
    const after = this.keyed(this.rowsOf(instance), true);
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

  /**
   * Carries the new IDs a move gave the instance's records, and the records under them, into every row that names
   * them, in any table (DataFiles.carryRenames); the instance is not saved again after.
   */
  carryRenames(renames: Renames): void {
    this.files.carryRenames(renames);
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

  // The rows by table and key. Saving, an instance holding two rows with one key is refused: an Add that reuses a key
  // its own instance already holds is a duplicate, never a change.
  private keyed(rows: InstanceRows, saving = false): Map<string, Map<string, Row>> {
    const keyed = new Map<string, Map<string, Row>>();
    for (const [table, list] of rows) {
      const description = this.tx.schema.tables[table];
      const byKey = new Map<string, Row>();
      for (const row of list) {
        const key = rowKey(description, row);
        if (saving && byKey.has(key)) this.tx.refuse('primary-key', `${table} ${describeKey(description, row)} already exists`);
        byKey.set(key, row);
      }
      keyed.set(table, byKey);
    }
    return keyed;
  }
}
