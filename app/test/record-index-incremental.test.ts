import { describe, expect, it } from 'vitest';
import type { RecordSummaries, SummaryLink } from '../../lathe/src/exploring/record-summaries/read-model';
import type { FolderTree } from '../../lathe/src/exploring/folder-tree/read-model';
import { compareIds, coverageOf, indexOf, problemsOf, recordsOf, type Records } from '../src/exploring/record-summaries/record-index';
import { ownerFolders } from '../src/exploring/folder-tree/folders';
import { indexMetaModel } from '../src/platform/meta-model/reads';
import type { MetaModel } from '../src/platform/meta-model/reads';

// The record index worked out by what changed (record-index.ts recordsOf, the Folder tree look-up) gives what building
// it afresh gives, and keeps what did not change as it was (LA-EXP-RM01-SR01).

const COLUMNS = ['id', 'kind', 'title', 'parent', 'product', 'domain', 'group', 'testState', 'names', 'level', 'file', 'line', 'digest'] as const;

/** A small space of one product P: two domains of 6 use cases each, each under a capability, and a link from each use case to the next. */
function space(): { records: Record<string, unknown>[]; links: SummaryLink[] } {
  const records: Record<string, unknown>[] = [];
  const add = (id: string, kind: string, parent: string | null, domain: string | null, title = id) =>
    records.push({ id, kind, title, parent, product: 'P', domain, group: null, testState: null, names: null, level: null, file: `${kind}.jsonl`, line: records.length + 1, digest: `${id}:${title}` });
  add('P', 'product', null, null);
  for (const d of ['P-D1', 'P-D2']) {
    add(d, 'domain', 'P', null);
    add(`${d}-CAP1`, 'capability', d, d);
    for (let n = 1; n <= 6; n++) add(`${d}-UC${n}`, 'use_case', `${d}-CAP1`, d);
  }
  const ucs = records.filter((r) => r.kind === 'use_case').map((r) => r.id as string);
  return { records, links: ucs.slice(1).map((target, at) => ({ source: ucs[at], relation: 'follows', target })) };
}

const answerOf = (records: Record<string, unknown>[], links: SummaryLink[]): RecordSummaries =>
  ({ product: 'P', columns: COLUMNS, records: records.map((r) => COLUMNS.map((c) => r[c])) as RecordSummaries['records'], links });

// A tiny seeded generator, so a failing set can be run again.
function random(seed: number) {
  let state = seed;
  return (n: number) => { state = (state * 1664525 + 1013904223) % 4294967296; return Math.floor((state / 4294967296) * n); };
}

const same = (a: Records, b: Records) => {
  expect([...a.byId.keys()]).toEqual([...b.byId.keys()]);
  expect([...a.byId.values()]).toEqual([...b.byId.values()]);
  expect([...a.children.entries()]).toEqual([...b.children.entries()]);
  expect([...a.outgoing.entries()]).toEqual([...b.outgoing.entries()]);
  expect([...a.incoming.entries()]).toEqual([...b.incoming.entries()]);
  expect(a.domains).toEqual(b.domains);
};

describe('the record index by what changed', () => {
  it('LA-EXP-RM01-SR01-T01 gives what a fresh build gives, over random change sets', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const next = random(seed);
      let { records, links } = space();
      let held = recordsOf(answerOf(records, links), null);
      for (let step = 0; step < 6; step++) {
        records = records.map((r) => ({ ...r }));
        for (let k = next(4); k >= 0; k--) {
          const at = next(records.length);
          const r = records[at];
          switch (next(5)) {
            case 0: r.title = `${r.title}+`; r.digest = `${r.id}:${r.title}`; break;
            case 1: if (r.kind === 'use_case') records.splice(at, 1); break;
            case 2: records.push({ ...records[next(records.length)], id: `P-NEW${next(1000)}${step}`, kind: 'use_case', parent: 'P-D1-CAP1', domain: 'P-D1' }); break;
            case 3: if (r.kind === 'use_case') r.parent = r.parent === 'P-D1-CAP1' ? 'P-D2-CAP1' : 'P-D1-CAP1'; break;
            default: r.line = (r.line as number) + 1;
          }
        }
        // Records in ID order, as the answer gives them; the unique IDs the generator makes.
        records = [...new Map(records.map((r) => [r.id as string, r])).values()].sort((a, b) => compareIds(a.id as string, b.id as string));
        if (next(3) === 0 && links.length > 0) links = links.slice(1);
        const answer = answerOf(records, links);
        held = recordsOf(answer, held);
        same(held, recordsOf(answer, null));
      }
    }
  });

  it('LA-EXP-RM01-SR01-T02 returns the very records when nothing changed, and reuses every record that did not', () => {
    const { records, links } = space();
    const first = recordsOf(answerOf(records, links), null);
    expect(recordsOf(answerOf(records.map((r) => ({ ...r })), links.map((l) => ({ ...l }))), first)).toBe(first);
    const edited = records.map((r) => (r.id === 'P-D1-UC2' ? { ...r, title: 'Renamed', digest: 'x' } : r));
    const second = recordsOf(answerOf(edited, links), first);
    expect(second.byId.get('P-D1-UC2')!.title).toBe('Renamed');
    expect(second.children.get('P-D1-CAP1')!.find((r) => r.id === 'P-D1-UC2')).toBe(second.byId.get('P-D1-UC2'));
    for (const [id, record] of first.byId) if (id !== 'P-D1-UC2') expect(second.byId.get(id)).toBe(record);
    expect(second.outgoing).toBe(first.outgoing);
    expect(first.byId.get('P-D1-UC2')!.title).toBe('P-D1-UC2');
  });

  it('LA-EXP-RM01-SR01-T03 keeps each owner of the folder tree looked up while the records it reads are the very ones it was looked up with', () => {
    const { records, links } = space();
    const meta = indexMetaModel({ stages: [], kinds: [], relations: [] } as unknown as MetaModel);
    const folder = (owner: string, id: string) => ({ owner, stages: [{ key: `${owner}/use-cases`, stage: 'use-cases', folders: [{ key: `${owner}/use-cases/use_case`, kind: 'use_case', entries: [{ id, kind: 'use_case', title: id, folded: [] }], count: 1 }], direct: true, count: 1 }], loose: [] });
    const tree = { product: 'P', shared: { owner: 'P', stages: [], loose: [] }, domains: [{ ...folder('P-D1', 'P-D1-UC2'), title: 'D1' }, { ...folder('P-D2', 'P-D2-UC1'), title: 'D2' }] } as unknown as FolderTree;
    const held = recordsOf(answerOf(records, links), null);
    const one = indexOf(meta, held, tree, problemsOf(null), coverageOf('P', null));
    const other = indexOf(meta, held, tree, problemsOf(null), coverageOf('P', null));
    expect(ownerFolders(other, 'P-D1')).toBe(ownerFolders(one, 'P-D1'));
    const moved = indexOf(meta, recordsOf(answerOf(records.map((r) => (r.id === 'P-D1-UC2' ? { ...r, title: 'Renamed', digest: 'x' } : r)), links), held), tree, problemsOf(null), coverageOf('P', null));
    // The owner that reads the renamed record is looked up again; the one that does not is kept.
    expect(ownerFolders(moved, 'P-D1')).not.toBe(ownerFolders(one, 'P-D1'));
    expect(ownerFolders(moved, 'P-D1').stages[0].folders[0].records[0].title).toBe('Renamed');
    expect(ownerFolders(moved, 'P-D2')).toBe(ownerFolders(one, 'P-D2'));
  });
});

