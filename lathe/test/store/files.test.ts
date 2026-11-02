// Data files are deterministic: rows sorted by key, columns in a fixed order, one JSON object per line, UTF-8, with a
// trailing newline. Writing, reloading and writing again gives the same bytes.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openStore, type Store } from '../../src/index.ts';
import { run } from '../helpers.ts';
import { everyKind, removeData, writeData } from './fixture.ts';

afterAll(removeData);

const files = (root: string) =>
  Object.fromEntries(readdirSync(path.join(root, 'data')).sort().map((f) => [f, readFileSync(path.join(root, 'data', f))]));

// Commands that add records to several tables (each record's links and parts with it), in the given order, each
// input's fields given in that order too, so the files' order is shown to be the tables' own. Returns the files written.
async function writeSome(store: Store, reverse: boolean): Promise<string[]> {
  const steps: [string, Record<string, unknown>][] = [
    ...[2, 3, 4].map((n): [string, Record<string, unknown>] => ['view add-view', { id: `TL-V0${n}`, title: `View ${n}`, description: 'A page of the desk app.', route: `/v${n}` }]),
    ...[2, 3, 4].map((n): [string, Record<string, unknown>] => ['use-case add-uc-requirement', { id: `TL-LEND-UC01-R0${n}`, title: `Rule ${n}`, use_case_id: 'TL-LEND-UC01', statement: 'The library MUST do it.' }]),
    ['value-object add-value-object', { id: 'TL-VO02', title: 'Postcode', description: 'Where a member lives.', fields: [{ name: 'Code', meaning: 'The code.', type: 'text', required: true }] }],
    ['domain add-term', { id: 'TL-LEND-TM03', title: 'Return', domain_id: 'TL-LEND', meaning: 'A tool coming back.', builds_on: ['TL-LEND-TM01'] }],
    ['domain add-term', { id: 'TL-LEND-TM04', title: 'Late return', domain_id: 'TL-LEND', meaning: 'A loan back after the due date.', builds_on: ['TL-LEND-TM02', 'TL-LEND-TM01'] }],
  ];
  const written = new Set<string>();
  for (const [command, input] of reverse ? [...steps].reverse() : steps) {
    const ordered = reverse ? Object.fromEntries(Object.entries(input).reverse()) : input;
    for (const file of (await run(store, command, ordered)).files) written.add(file);
  }
  return [...written].sort();
}

describe('data files', () => {
  it('LA-PRD-UC39-R02-T02 are the same bytes whatever order the rows were written in, and after a reload and a rewrite', async () => {
    const first = writeData(everyKind());
    const a = await openStore(first);
    await writeSome(a, false);
    await a.close();
    const second = writeData(everyKind());
    const b = await openStore(second);
    await writeSome(b, true);
    await b.close();
    expect(files(second)).toEqual(files(first));

    // Reload, change a row and change it back: every file is as it was.
    const before = files(first);
    const c = await openStore(first);
    await run(c, 'view change-view', { id: 'TL-V01', title: 'Changed' });
    await run(c, 'view change-view', { id: 'TL-V01', title: 'Catalog' });
    await c.close();
    expect(files(first)).toEqual(before);
  });

  it('LA-PRD-UC39-R01-T02 hold one JSON object per line, sorted by key, columns in table order, with a trailing newline', async () => {
    const root = writeData(everyKind());
    const store = await openStore(root);
    const written = await writeSome(store, true);
    expect(written).toEqual(['builds_on.jsonl', 'term.jsonl', 'uc_requirement.jsonl', 'value_object.jsonl', 'value_object_field.jsonl', 'view.jsonl']);
    for (const [name, bytes] of Object.entries(files(root)).filter(([f]) => written.includes(f))) {
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

  it('LA-PRD-UC39-R01-T03 keep text as UTF-8, and drop a table file when its last row goes', async () => {
    const root = writeData(everyKind());
    const store = await openStore(root);
    await run(store, 'product change-product', { id: 'TL', icon: '🧰', description: 'Café “quotes”, naïve' });
    expect(readFileSync(path.join(root, 'data', 'product.jsonl'), 'utf8')).toBe(
      '{"id":"TL","title":"Tool Library","description":"Café “quotes”, naïve","icon":"🧰"}\n',
    );
    await run(store, 'command change-command-handler', { id: 'TL-LEND-CMD01-H', meets: [] });
    expect(readdirSync(path.join(root, 'data'))).not.toContain('meets.jsonl');
    await store.close();
  });
});
