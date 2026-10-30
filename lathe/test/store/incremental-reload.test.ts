// LA-PLT-UC03-R03-T01: a reload of only the changed files gives the same state as a load from scratch. Random change
// sets (a record retitled, a row removed or brought back, a key given twice, a line that is not JSON, a title the
// integrity queries refuse, a file touched) are written to a product's data files; after each, one store reloads only
// what changed and builds the result whole in the background, and a second store loads every file afresh. Both must
// hold the same rows on the same lines, refuse with the same problems, answer every read the same, and find the same
// problems, coverage and chains.
import { readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ALL_QUERIES } from '../../src/commands.ts';
import { formatProblem, loadConfig, openStore, readWorkspace, StoreError, type Row, type Store } from '../../src/index.ts';
import { AGGREGATE_RULES } from '../../src/aggregate-rules.ts';
import { answerQuery } from '../../src/platform/commands/run.ts';
import { everyKind, removeData, writeData } from './fixture.ts';

afterAll(removeData);

// A fixed-seed generator (mulberry32), so a failing run fails the same way again.
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What a store holds, as plain data: each stored table's rows with the file and line each came from. */
function stateOf(store: Store): Record<string, { row: Row; at: string }[]> {
  const state: Record<string, { row: Row; at: string }[]> = {};
  for (const table of Object.values(store.schema.tables)) {
    if (!table.stored) continue;
    const rows = store.rows(table.name);
    if (rows.length) state[table.name] = rows.map((row) => ({ row, at: JSON.stringify(store.origin(row) ?? null) }));
  }
  return state;
}

/** Every read that needs no record named, and the product's own, answered over the store (its kept readers, for the reloaded one). */
function readsOf(store: Store, product: string): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (const query of ALL_QUERIES) {
    if (query.checked || query.baseline) continue;
    const required = Object.entries(query.input).filter(([, field]) => (field as { presence?: string }).presence === 'required').map(([name]) => name);
    const input = required.length === 0 ? {} : required.length === 1 && required[0] === 'product_id' ? { product_id: product } : null;
    if (!input) continue;
    try {
      answers[query.route] = answerQuery(store, query, input);
    } catch (error) {
      answers[query.route] = { refused: (error as Error).message };
    }
  }
  return answers;
}

type Outcome = { refused: string[] } | { state: ReturnType<typeof stateOf>; reads: Record<string, unknown>; checked: unknown };

const refusalOf = (error: unknown): { refused: string[] } => {
  if (!(error instanceof StoreError)) throw error;
  return { refused: error.problems.map(formatProblem) };
};

/** The data loaded from scratch: refused, or its state, reads and checks' run. */
async function fromScratch(root: string): Promise<Outcome> {
  let store: Store;
  try {
    store = await openStore(root);
  } catch (error) {
    return refusalOf(error);
  }
  try {
    const { problems, coverage, chains } = await readWorkspace(store, loadConfig(root));
    return { state: stateOf(store), reads: readsOf(store, 'TL'), checked: { problems, coverage, chains } };
  } finally {
    await store.close();
  }
}

/** The kept store reloaded and then built whole, as the server does: refused, or its state, reads and checks' run. */
async function reloaded(store: Store, root: string): Promise<Outcome> {
  try {
    await store.reload();
    // Reads answered before the whole build, from the readers it kept, are the ones a page sees first.
    const reads = readsOf(store, 'TL');
    const built = await store.whole((data) => readWorkspace(data, loadConfig(root)));
    const { problems, coverage, chains } = built!.value;
    return { state: stateOf(store), reads, checked: { problems, coverage, chains } };
  } catch (error) {
    return refusalOf(error);
  }
}

/** The data files as lines, by table. */
const filesOf = (dir: string) => new Map(readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => [f.slice(0, -'.jsonl'.length), readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean)]));

describe('LA-PLT-UC03-R03-T01 a reload of only the changed files gives the same state, problems and coverage as a load from scratch', () => {
  it('applies random change sets both ways and compares them', async () => {
    const root = writeData(everyKind());
    const dir = path.join(root, 'data');
    const next = random(190);
    const pick = <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)];
    const store = await openStore(root);
    // Rows a change removed, to bring back later.
    const removed: { table: string; line: string }[] = [];
    // Each row's title as first written, by table and key, which mending gives back.
    const titles = new Map<string, unknown>();
    const keyOf = (table: string, row: Row) => `${table}\u0000${store.schema.tables[table].primaryKey.map((c) => String(row[c])).join('\u0000')}`;
    for (const [table, lines] of filesOf(dir)) for (const line of lines) titles.set(keyOf(table, JSON.parse(line) as Row), (JSON.parse(line) as Row).title);
    const seen = { refused: 0, served: 0 };
    try {
      // The readers are made once on the data as loaded, so the reloads show which they keep.
      readsOf(store, 'TL');
      for (let round = 0; round < 24; round++) {
        const files = filesOf(dir);
        const tables = [...files.keys()].sort();
        const changes = 1 + Math.floor(next() * 3);
        for (let c = 0; c < changes; c++) {
          const table = pick(tables);
          const lines = files.get(table)!;
          const at = Math.floor(next() * lines.length);
          const row = JSON.parse(lines[at] ?? '{}') as Row;
          switch (pick(['retitle', 'retitle', 'remove', 'restore', 'restore', 'twice', 'not json', 'period', 'touch'] as const)) {
            case 'retitle':
              if (typeof row.title === 'string') lines[at] = JSON.stringify({ ...row, title: `${row.title} ${round}` });
              break;
            case 'remove':
              removed.push({ table, line: lines.splice(at, 1)[0] });
              break;
            case 'restore': {
              const back = removed.pop();
              if (back) files.set(back.table, [...(files.get(back.table) ?? []), back.line]);
              break;
            }
            case 'twice':
              if (lines.length) lines.push(lines[at]);
              break;
            case 'not json':
              lines.push('{"id": ');
              break;
            case 'period':
              // A title ending in a period: refused only by the integrity queries, so by the whole build.
              if (typeof row.title === 'string') lines[at] = JSON.stringify({ ...row, title: `${row.title}.` });
              break;
            case 'touch':
              utimesSync(path.join(dir, `${table}.jsonl`), new Date(), new Date(Date.now() + 1000 * (round + 1)));
              continue;
          }
        }
        for (const [table, lines] of files) writeFileSync(path.join(dir, `${table}.jsonl`), lines.map((l) => `${l}\n`).join(''));
        const scratch = await fromScratch(root);
        const incremental = await reloaded(store, root);
        expect(incremental, `round ${round}`).toEqual(scratch);
        seen['refused' in scratch ? 'refused' : 'served']++;
        // After a refused round, the data is mended more often than not, so the next rounds start from data that loads:
        // the lines that are not JSON go, titles are as first written, removed rows come back, and a key given twice is kept once.
        if ('refused' in scratch && next() < 0.8) {
          const fresh = filesOf(dir);
          for (const { table, line } of removed.splice(0)) fresh.set(table, [...(fresh.get(table) ?? []), line]);
          for (const [table, lines] of fresh) {
            const kept = new Map<string, string>();
            for (const line of lines) {
              if (line === '{"id": ') continue;
              const row = JSON.parse(line) as Row;
              const id = keyOf(table, row);
              if (typeof titles.get(id) === 'string') row.title = titles.get(id) as string;
              if (!kept.has(id)) kept.set(id, JSON.stringify(row));
            }
            writeFileSync(path.join(dir, `${table}.jsonl`), [...kept.values()].map((l) => `${l}\n`).join(''));
          }
        }
      }
      // Both ways were taken: some rounds refused, some served.
      expect(seen.refused).toBeGreaterThan(0);
      expect(seen.served).toBeGreaterThan(0);
    } finally {
      await store.close();
    }
  }, 240_000);
});

describe('LA-PLT-UC03-R03-T02 a reload reads only the changed tables, reruns only the rules that read them and rebuilds only the read models that read them', () => {
  it('keeps the rest, and leaves the database to the whole build', async () => {
    const root = writeData(everyKind());
    const file = path.join(root, 'data', 'question.jsonl');
    const steps: Record<string, number> = {};
    const store = await openStore(root, { steps });
    try {
      const factory = (route: string) => ALL_QUERIES.find((q) => q.route === route)!.reader;
      const [meta, useCases] = [factory('/api/meta-model/get-meta-model'), factory('/api/use-case/get-use-case')];
      const metaReader = store.readerOf(meta);
      const useCaseReader = store.readerOf(useCases);
      expect(store.readerOf(meta)).toBe(metaReader);

      // A file touched, or written back as it was, changes nothing.
      utimesSync(file, new Date(), new Date(Date.now() + 5000));
      expect(await store.reload()).toMatchObject({ tables: [], full: false });
      expect(store.readerOf(useCases)).toBe(useCaseReader);

      writeFileSync(file, readFileSync(file, 'utf8').replace('"title":"', '"title":"Still: '));
      for (const name of Object.keys(steps)) delete steps[name];
      expect(await store.reload()).toEqual({ files: [file], tables: ['question'], full: false });
      expect(store.record('TL-LEND-Q01')?.row.title).toMatch(/^Still: /);
      // Only the Product aggregate's rules (which read questions), and the rules that look records up by ID, ran again.
      const reran = Object.keys(steps).filter((s) => s.startsWith('reload rules of ')).map((s) => s.slice('reload rules of '.length));
      expect(reran).toContain('LA-AUT-A1');
      expect(reran.length).toBeLessThan(AGGREGATE_RULES.length);
      // The meta model reads no question, so its reader stands; the use case's reads every kind's IDs, so it is made again.
      expect(store.readerTouched(meta, new Set(['question']))).toBe(false);
      expect(store.readerOf(meta)).toBe(metaReader);
      expect(store.readerOf(useCases)).not.toBe(useCaseReader);
      // The database holds the state last built whole, which whole() builds again in a database of its own.
      expect(() => store.connection).toThrow(/reloaded in part/);
      const titles = await store.whole((built) => built.query<{ title: string }>("SELECT title FROM question WHERE id = 'TL-LEND-Q01'"));
      expect(titles?.value[0].title).toMatch(/^Still: /);
    } finally {
      await store.close();
    }
  });
});
