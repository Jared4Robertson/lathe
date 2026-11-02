// The Table aggregate's rules, written once: each command's handler runs them on the instance before it saves, and
// every load and commit runs them over all data (tableRules, listed in AGGREGATE_RULES).
import type { AggregateRules, ReadView, RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { TableRow } from '../../platform/data/tables.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { TABLE_AGGREGATE, tablesFrom, type Table } from './model.ts';

/** Where a table is kept outside a database: it has no keys, and no foreign key points at it. */
const OUTSIDE_DATABASE = ['browser storage', 'file', 'in memory'];

// The domain the table sits in, through its parent: its entity's aggregate's, its read model's, or its own.
function domainOf(view: ReadView, table: TableRow): string | undefined {
  if (table.domain_id) return table.domain_id;
  if (table.read_model_id) {
    const readModel = view.record(table.read_model_id);
    return readModel?.kind === 'read_model' ? String(readModel.row.domain_id) : undefined;
  }
  const entity = table.entity_id ? view.record(table.entity_id) : undefined;
  const aggregate = entity?.kind === 'entity' ? view.record(String(entity.row.aggregate_id)) : undefined;
  return aggregate?.kind === 'aggregate' ? String(aggregate.row.domain_id) : undefined;
}

/**
 * Every rule the table breaks (LA-TEC-INV106 an entity or read model has at most one table; LA-TEC-INV13 an entity
 * stored in its root's table has no table of its own; LA-TEC-INV14 a table has one primary key at most; LA-TEC-INV81 a
 * foreign key points at a table of the same domain; LA-TEC-INV82 keys are asked only of a table in a database, and no
 * foreign key points at one outside). The view gives what the table names outside itself: its entity, the tables its
 * foreign keys point at, and the other tables.
 */
export function tableProblems(table: Table, view: ReadView): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const row = table.table;
  const tableRow = row as unknown as Row;
  const entity = row.entity_id ? view.record(row.entity_id) : undefined;
  if (entity?.kind === 'entity' && entity.row.in_root_table) {
    problems.push({ rule: 'entity-table', table: 'table', row: tableRow, message: `entity ${row.entity_id} is stored in its root's table (in_root_table), so it cannot have table ${row.id} of its own` });
  }
  const primary = table.keys.filter((k) => k.type === 'primary').length;
  if (primary > 1) problems.push({ rule: 'one-primary-key', table: 'table', row: tableRow, message: `table ${row.id} has ${primary} primary keys; a table has one` });
  // The table a foreign key points at: this one, as the command leaves it, or another as the data has it.
  const target = (id: string): TableRow | undefined => (id === row.id ? row : (view.record(id)?.kind === 'table' ? (view.record(id)!.row as unknown as TableRow) : undefined));
  const own = domainOf(view, row);
  table.keys.forEach((key, at) => {
    const keyRow = { table_id: row.id, position: at + 1, ...key } as unknown as Row;
    const pointed = key.target_table_id ? target(key.target_table_id) : undefined;
    if (OUTSIDE_DATABASE.includes(row.storage)) {
      problems.push({ rule: 'key-outside-database', table: 'table_key', row: keyRow, message: `table ${row.id} is kept in ${row.storage}, not in a database, so it has no keys` });
    } else if (pointed && OUTSIDE_DATABASE.includes(pointed.storage)) {
      problems.push({ rule: 'key-outside-database', table: 'table_key', row: keyRow, message: `table ${pointed.id} is kept in ${pointed.storage}, not in a database, so no foreign key can point at it` });
    }
    if (key.type === 'foreign' && pointed) {
      const other = domainOf(view, pointed);
      if (other !== own) {
        problems.push({ rule: 'foreign-key-crosses-domain', table: 'table_key', row: keyRow, message: `table ${row.id} is in domain ${own ?? 'none'}, so its foreign key cannot point at table ${pointed.id}, which is in domain ${other ?? 'none'}` });
      }
    }
  });
  // LA-TEC-INV106: an entity or a read model has at most one table; the table is refused when another already stores it.
  for (const column of ['entity_id', 'read_model_id'] as const) {
    const parent = row[column];
    if (!parent) continue;
    const other = view.rows('table').find((t) => t[column] === parent && t.id !== row.id);
    if (other) {
      problems.push({ rule: 'one-table-each', table: 'table', row: tableRow, message: `${column === 'entity_id' ? 'entity' : 'read model'} ${parent} already has its table, ${String(other.id)}, so ${row.id} cannot be a second: ${column === 'entity_id' ? 'an entity' : 'a read model'} has one` });
    }
  }
  return problems;
}

/** The rules over all data: every table, whole. */
export const tableRules: AggregateRules = {
  aggregate: TABLE_AGGREGATE,
  check: (view) => tablesFrom((table) => view.rows(table)).flatMap((table) => tableProblems(table, view)),
};

/** Refuses the command, with every reason, when the table as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, table: Table): void {
  const problems = tableProblems(table, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message })));
}
