// Data files are deterministic: rows sorted by key, columns in a fixed order, one JSON object per line, UTF-8, with a
// trailing newline. Writing, reloading and writing again gives the same bytes.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openStore, type Command } from '../../src/index.ts';
import { everyKind, removeData, writeData } from './fixture.ts';

afterAll(removeData);

const files = (root: string) =>
  Object.fromEntries(readdirSync(path.join(root, 'data')).sort().map((f) => [f, readFileSync(path.join(root, 'data', f))]));

// The fixture's rows as add and link commands, in the given table order and row order.
function commands(reverse: boolean): Command[] {
  const data = everyKind();
  const declarations = ['product_kind', 'product_kind_field', 'product_relation'];
  const out: Command[] = [];
  for (const table of [...declarations, ...Object.keys(data).filter((t) => !declarations.includes(t))]) {
    const rows = reverse ? [...data[table]].reverse() : data[table];
    for (const row of rows) {
      // Columns given in another order, to show the file's order is the table's.
      const shuffled = reverse ? Object.fromEntries(Object.entries(row).reverse()) : row;
      out.push('source_id' in row ? { op: 'link', relation: table, source: String(row.source_id), target: String(row.target_id) } : { op: 'add', table, row: shuffled });
    }
  }
  return out;
}

describe('data files', () => {
  it('are the same bytes whatever order the rows were written in, and after a reload and a rewrite', async () => {
    const first = writeData({});
    const a = await openStore(first);
    await a.apply(commands(false));
    await a.close();
    const second = writeData({});
    const b = await openStore(second);
    await b.apply(commands(true));
    await b.close();
    expect(files(second)).toEqual(files(first));

    // Reload, change a row and change it back: every file is as it was.
    const before = files(first);
    const c = await openStore(first);
    await c.set('view', 'TL-V01', { title: 'Changed' });
    await c.set('view', 'TL-V01', { title: 'Catalog' });
    await c.close();
    expect(files(first)).toEqual(before);
  });

  it('hold one JSON object per line, sorted by key, columns in table order, with a trailing newline', async () => {
    const root = writeData({});
    const store = await openStore(root);
    await store.apply(commands(true));
    for (const [name, bytes] of Object.entries(files(root))) {
      const text = bytes.toString('utf8');
      expect(text.endsWith('\n'), name).toBe(true);
      expect(text).not.toContain('\r');
      const table = store.schema.tables[name.replace('.jsonl', '')];
      const lines = text.slice(0, -1).split('\n');
      const rows = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
      const order = table.columns.map((c) => c.name);
      for (const row of rows) {
        const keys = Object.keys(row);
        expect(keys, name).toEqual(order.filter((c) => keys.includes(c)));
        expect(Object.values(row)).not.toContain(null);
      }
      const keyOf = (r: Record<string, unknown>) => table.primaryKey.map((c) => r[c]);
      const sorted = [...rows].sort((x, y) => {
        for (const [i, v] of keyOf(x).entries()) {
          const w = keyOf(y)[i];
          if (v === w) continue;
          return typeof v === 'number' && typeof w === 'number' ? v - w : String(v) < String(w) ? -1 : 1;
        }
        return 0;
      });
      expect(rows, name).toEqual(sorted);
    }
    await store.close();
  });

  it('keep text as UTF-8, and drop a table file when its last row goes', async () => {
    const root = writeData(everyKind());
    const store = await openStore(root);
    await store.set('product', 'TL', { icon: '🧰', description: 'Café “quotes”, naïve' });
    expect(readFileSync(path.join(root, 'data', 'product.jsonl'), 'utf8')).toBe(
      '{"id":"TL","title":"Tool Library","description":"Café “quotes”, naïve","icon":"🧰"}\n',
    );
    await store.unlink('meets', 'TL-LEND-CMD01-H', 'TL-STD-CODE-R01');
    expect(readdirSync(path.join(root, 'data'))).not.toContain('meets.jsonl');
    await store.close();
  });
});
