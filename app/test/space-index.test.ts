import { describe, expect, it } from 'vitest';
import type { Row } from '../../lathe/src/server/contract';
import { answerQuery } from '../../lathe/src/platform/commands/run';
import { GET_META_MODEL } from '../../lathe/src/platform/meta-model/queries';
import { LIST_RECORD_SUMMARIES } from '../../lathe/src/exploring/record-summaries/queries';
import { GET_FOLDER_TREE } from '../../lathe/src/exploring/folder-tree/queries';
import { LIST_PROBLEMS } from '../../lathe/src/checking/problems/queries';
import { GET_COVERAGE } from '../../lathe/src/traceability/coverage/queries';
import type { ProductProblems } from '../../lathe/src/checking/problems/read-model';
import type { ProductCoverage } from '../../lathe/src/traceability/coverage/read-model';
import type { MetaModel } from '../../lathe/src/platform/meta-model/read-model';
import type { RecordSummaries } from '../../lathe/src/exploring/record-summaries/read-model';
import type { FolderTree } from '../../lathe/src/exploring/folder-tree/read-model';
import { coverageOf, indexOf, problemsOf, recordsOf, type RecordIndex } from '../src/exploring/record-summaries/record-index';
import { forgetMirrors, putChange, putChecks, type ChecksChange, type SpaceChange } from '../src/exploring/record-summaries/space-index';
import { spaceBuilder } from '../src/exploring/record-summaries/space-builder';
import { putInput } from '../src/graph/map-input';
import { ownerFolders } from '../src/exploring/folder-tree/folders';
import { productInput, type MapInput } from '../src/graph/layout-input';
import { treeOf, type Tree } from '../src/graph/tree';
import { indexMetaModel, type MetaIndex } from '../src/platform/meta-model/reads';
import { readViewOf, type ServedData } from './read-view';
import { addRows, setRow } from './fixtures/load';
import { modelWorkspace } from './fixtures/model';

// The space's index worked out by its builder (the space's index worker's, space-index.ts) and put in by the page's
// mirror from the builder's changes gives what a fresh build from the reads gives, step by step through edits, and keeps
// what did not change as it was (LA-EXP-RM01-SR01).

const PRODUCT = 'P';

/** The builder over the served data: each read answered by its query, as the server answers it. */
function builderOver(data: { now: ServedData }) {
  return spaceBuilder(async <R,>(address: string) => {
    const [route, query = ''] = address.split('?');
    const read = [LIST_RECORD_SUMMARIES, GET_FOLDER_TREE, LIST_PROBLEMS, GET_COVERAGE].find((q) => q.route === route)!;
    return { state: 'read' as const, answer: answerQuery(readViewOf(data.now), read, Object.fromEntries(new URLSearchParams(query))) as R };
  });
}

/** The index a fresh build gives: every read answered afresh, nothing kept. */
function fresh(data: ServedData, meta: MetaIndex) {
  const view = readViewOf(data);
  const summaries = answerQuery(view, LIST_RECORD_SUMMARIES, { product_id: PRODUCT }) as RecordSummaries;
  const folders = answerQuery(view, GET_FOLDER_TREE, { product_id: PRODUCT }) as FolderTree;
  return { meta, folders, index: indexOf(meta, recordsOf(summaries, null), folders, problemsOf(null), coverageOf(PRODUCT, null)) };
}

// The tree's lookups are read by key, never in order: a key the change brings sits at the end.
const sorted = <V,>(map: ReadonlyMap<string, V>) => [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
const treeEntries = (tree: Tree) => ({
  parent: sorted(tree.parent),
  children: sorted(tree.children),
  groups: sorted(tree.groups).map(([id, g]) => [id, { ...g, members: g.members.map((m) => m.id) }]),
});

describe('the space\'s index from its builder\'s changes', () => {
  it('LA-EXP-RM01-SR01-T04 gives the records, folder tree, graph tree and map inputs a fresh build gives, edit after edit', async () => {
    forgetMirrors();
    const data = { now: modelWorkspace() };
    const ask = builderOver(data);
    const model = answerQuery(readViewOf(data.now), GET_META_MODEL, {}) as MetaModel;
    await ask({ type: 'meta', meta: model, number: 1 });
    const meta = indexMetaModel(model);
    const uc = (data.now.sources[0].tables.use_case as Row[])[0];
    const edits: ((d: ServedData) => void)[] = [
      () => undefined,
      (d) => { setRow(d, 'use_case', String(uc.id), { title: 'Renewed title' }); d.problems = [...d.problems, { severity: 'warning', check: 'lone-child', record: String(uc.id), message: 'A new warning.' }]; },
      (d) => { addRows(d, 'use_case', { id: 'P-D-UC09', title: 'A new use case', domain_id: uc.domain_id as string, goal: 'A member does something new.', result_id: uc.result_id as string }); },
      (d) => { setRow(d, 'use_case', 'P-D-UC09', { title: 'A new use case, renamed' }); },
      (d) => { d.sources[0].tables.use_case = (d.sources[0].tables.use_case as Row[]).filter((r) => r.id !== 'P-D-UC09'); d.problems = d.problems.slice(1); },
    ];
    let seq: number | null = null;
    let checkedSeq: number | null = null;
    let before: RecordIndex | null = null;
    for (const edit of edits) {
      edit(data.now);
      const reply = await ask({ type: 'read', id: 1, product: PRODUCT, base: seq, summaries: true, folders: true });
      // What crosses to the page is what a worker can send.
      const change = structuredClone((reply as { change: SpaceChange }).change);
      const mirrored = putChange(change);
      seq = mirrored.seq;
      const want = fresh(data.now, meta);
      const index = indexOf(want.meta, mirrored.records, mirrored.folders, problemsOf(null), coverageOf(PRODUCT, null));
      expect([...index.byId.entries()]).toEqual([...want.index.byId.entries()]);
      expect([...index.children.entries()]).toEqual([...want.index.children.entries()]);
      expect([...index.outgoing.entries()]).toEqual([...want.index.outgoing.entries()]);
      expect([...index.incoming.entries()]).toEqual([...want.index.incoming.entries()]);
      expect(index.domains).toEqual(want.index.domains);
      expect(mirrored.folders).toEqual(want.folders);
      expect(treeEntries(mirrored.tree)).toEqual(treeEntries(treeOf(want.index)));
      for (const r of mirrored.tree.groups.values()) for (const m of r.members) if (index.byId.has(m.id)) expect(m).toBe(index.byId.get(m.id));
      for (const view of ['tree', 'nested', 'map'] as const) {
        const root = view === 'map' ? PRODUCT : PRODUCT;
        const reply = await ask({ type: 'input', id: 2, product: PRODUCT, seq: mirrored.seq, root, view, measure: 'm', held: before !== null });
        const input = putInput(index, root, view, 'm', structuredClone((reply as { change: Parameters<typeof putInput>[4] }).change))!;
        const expected: MapInput = productInput(want.index, root, view, 'm');
        expect(input.packed).toBe(expected.packed);
        expect(input.labels).toEqual(expected.labels);
        expect(input.roles).toEqual(expected.roles);
        const plain = (m: MapInput) => ({ roots: [...m.shape.roots], ids: [...m.shape.ids], parents: [...m.shape.parents], levels: [...m.shape.levels], children: m.shape.children.map((c) => [...c]) });
        expect(plain(input)).toEqual(plain(expected));
      }
      // The problems and the coverage, as their own layer.
      const checked = putChecks(structuredClone((await ask({ type: 'checked', id: 3, product: PRODUCT, base: checkedSeq, problems: true, coverage: true }) as { change: ChecksChange }).change));
      checkedSeq = checked.seq;
      const view = readViewOf(data.now);
      const covered = coverageOf(PRODUCT, answerQuery(view, GET_COVERAGE, { product_id: PRODUCT }) as ProductCoverage);
      expect(sorted(checked.problemsFor)).toEqual(sorted(problemsOf(answerQuery(view, LIST_PROBLEMS, { product_id: PRODUCT }) as ProductProblems)));
      expect(sorted(checked.coverage.gapsFor)).toEqual(sorted(covered.gapsFor));
      expect([...checked.coverage.scopes.entries()]).toEqual([...covered.scopes.entries()]);
      // What did not change stays the very object the page held.
      if (before) {
        for (const [id, r] of index.byId) if (JSON.stringify(before.byId.get(id)) === JSON.stringify(r)) expect(r).toBe(before.byId.get(id));
        const kept = before.folders.domains.filter((d) => index.folders.domains.includes(d));
        expect(kept.length + (index.folders.shared === before.folders.shared ? 1 : 0)).toBeGreaterThan(0);
        for (const d of kept) expect(ownerFolders(index, d.owner)).toBe(ownerFolders(before, d.owner));
      }
      before = index;
    }
  });
});
