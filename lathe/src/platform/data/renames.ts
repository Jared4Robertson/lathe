// A record's ID starts with its scope's (meta_kind.id_scope): its parent's, its domain's or its product's. So a move
// that changes a record's domain, or the parent its ID starts with, changes the IDs of the record and every record
// under it. These are the new IDs such a move gives, and each row as it reads with them: the store carries a new ID into
// every row that names the old one (a key, a foreign key, an item of a list, or a mention in text), as a foreign key
// with ON UPDATE CASCADE would, so nothing is left naming an ID that is gone (DataFiles.carryRenames).
import type { ReadView } from './rules.ts';
import type { Row, Value } from './rows.ts';
import type { Transaction } from './transaction.ts';

/** New IDs by old. */
export type Renames = ReadonlyMap<string, string>;

/** The record and every record under it, down every kind's parents (a product's own kinds' too). */
export function recordsUnder(view: Pick<ReadView, 'schema' | 'rows'>, rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const kind of Object.values(view.schema.kinds)) {
    if (!kind.parents.length) continue;
    for (const row of view.rows(kind.name)) {
      for (const parent of kind.parents) {
        const id = row[parent.column];
        if (typeof id !== 'string') continue;
        const list = children.get(id) ?? [];
        list.push(String(row.id));
        children.set(id, list);
      }
    }
  }
  const found: string[] = [];
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    found.push(id);
    queue.push(...(children.get(id) ?? []));
  }
  return found;
}

/**
 * The new IDs of the record and those under it whose IDs start with `from` (the old scope's ID, or the record's own
 * ID) and a hyphen: `to` takes the place of `from`, and the rest of each ID is kept.
 */
export function renamesUnder(view: Pick<ReadView, 'schema' | 'rows'>, rootId: string, from: string, to: string): Map<string, string> {
  const renames = new Map<string, string>();
  if (from === to) return renames;
  for (const id of recordsUnder(view, rootId)) {
    if (id === from || id.startsWith(`${from}-`)) renames.set(id, `${to}${id.slice(from.length)}`);
  }
  return renames;
}

// An ID as it can appear in a value: capitals and digits in hyphen-joined parts, such as LA-MOD-UC02-R01.
const ID_TOKEN = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g;

function renamedValue(value: Value, renames: Renames): Value {
  if (typeof value === 'string') return renames.get(value) ?? value.replace(ID_TOKEN, (token) => renames.get(token) ?? token);
  if (Array.isArray(value)) return value.map((item) => renamedValue(item, renames) as string);
  return value;
}

/** The row with every old ID it names replaced by its new one, or the row itself when it names none. */
export function renamedRow(row: Row, renames: Renames): Row {
  let changed: Row | null = null;
  for (const [column, value] of Object.entries(row)) {
    const renamed = renamedValue(value, renames);
    if (renamed === value || (Array.isArray(value) && JSON.stringify(renamed) === JSON.stringify(value))) continue;
    changed ??= { ...row };
    changed[column] = renamed;
  }
  return changed ?? row;
}

/**
 * The new IDs of a record a command moves from its domain to another of its product, with the records under it: each
 * ID that starts with the old domain's starts with the new one's. Refused when the record is already in that domain,
 * or the domain is not one of its product's.
 */
export function toDomain(tx: Transaction, record: { id: string; label: string; domainId: string }, domainId: string): Map<string, string> {
  if (record.domainId === domainId) tx.refuse('parent', `${record.id} is already in ${domainId}`);
  const target = tx.record(domainId);
  if (target?.kind !== 'domain') tx.refuse('missing', `there is no domain ${domainId} to move ${record.label} ${record.id} to`);
  const from = tx.record(record.domainId)?.row.product_id;
  if (from !== undefined && target.row.product_id !== from) tx.refuse('parent', `${domainId} is a domain of ${String(target.row.product_id)}, not of ${String(from)}: ${record.id} moves only to a domain of its own product`);
  return renamesUnder(tx, record.id, record.domainId, domainId);
}
