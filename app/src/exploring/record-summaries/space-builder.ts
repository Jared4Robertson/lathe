import type { RecordSummaries } from '../../../../lathe/src/exploring/record-summaries/read-model';
import type { FolderTree } from '../../../../lathe/src/exploring/folder-tree/read-model';
import type { StoreProblem } from '../../../../lathe/src/server/contract';
import type { ProductProblems } from '../../../../lathe/src/checking/problems/read-model';
import type { ProductCoverage } from '../../../../lathe/src/traceability/coverage/read-model';
import { indexMetaModel, type MetaIndex } from '../../platform/meta-model/reads';
import { emptyTree, treeChange, treeOf, type Tree } from '../../graph/tree';
import { inputChange, productInput, type MapInput } from '../../graph/layout-input';
import { coverageOf, indexOf, problemsOf, recordsOf, type RecordIndex, type Records } from './record-index';
import { checksChange, EMPTY_RECORDS, foldersChange, keep, recordsChange, type ChecksChange, type MirroredChecks, type SpaceReply, type SpaceRequest } from './space-index';

// The space's index builder (space-index.ts): what the space's index worker runs, and the page runs itself where there is
// no worker. It reads the record summaries and the folder tree, works out the records (recordsOf, by what changed), the
// graph's tree and each map's layout input, and answers each request with the change from what the page holds.

const SUMMARIES = '/api/record-summaries/list-record-summaries';
const FOLDERS = '/api/folder-tree/get-folder-tree';
const PROBLEMS = '/api/problems/list-problems';
const COVERAGE = '/api/coverage/get-coverage';

/** The builder's state for a product: what it worked out last, numbered, and the inputs it sent for each map. */
interface Built { seq: number; meta: number; summaries: RecordSummaries; records: Records; folders: FolderTree; index: RecordIndex; tree: Tree; inputs: Map<string, MapInput> }

const NO_COVERAGE = coverageOf('', null);
const NO_PROBLEMS = problemsOf(null);
/**
 * The builder: reads the space's reads, works out its records, tree and map inputs, and answers each request with the
 * change from what the page holds. `read` reads a query's answer (the worker's own fetch, or the page's).
 */
export function spaceBuilder(read: <R>(address: string) => Promise<{ state: 'read'; answer: R } | { state: 'refused'; error: string; problems: StoreProblem[] }>) {
  const built = new Map<string, Built>();
  let meta: { index: MetaIndex; number: number } | null = null;
  let seq = 0;
  // The problems and the coverage, by product: what was read last, and the lookups worked out from them.
  const checkedFor = new Map<string, { seq: number; problems: ProductProblems | null; coverage: ProductCoverage | null; checks: MirroredChecks }>();
  const check = async (request: Extract<SpaceRequest, { type: 'checked' }>): Promise<ChecksChange> => {
    const was = checkedFor.get(request.product);
    const query = `?${new URLSearchParams({ product_id: request.product })}`;
    // A read refused, or for another product, counts as none, as the index holds none until it is read.
    const of = <R extends { product: string },>(r: Awaited<ReturnType<typeof read<R>>> | null, kept: R | null): R | null => (r === null ? kept : r.state === 'read' && r.answer.product === request.product ? r.answer : null);
    const [problems, coverage] = await Promise.all([
      request.problems || !was ? read<ProductProblems>(`${PROBLEMS}${query}`) : null,
      request.coverage || !was ? read<ProductCoverage>(`${COVERAGE}${query}`) : null,
    ]);
    const answers = { problems: of(problems, was?.problems ?? null), coverage: of(coverage, was?.coverage ?? null) };
    const covered = was && answers.coverage === was.coverage ? was.checks.coverage : coverageOf(request.product, answers.coverage);
    const checks: MirroredChecks = { seq: ++seq, product: request.product, problemsFor: was && answers.problems === was.problems ? was.checks.problemsFor : problemsOf(answers.problems), coverage: covered };
    const from = was && was.seq === request.base ? was.checks : null;
    keep(checkedFor, request.product, { seq: checks.seq, ...answers, checks });
    return checksChange(request.product, checks.seq, from, checks);
  };
  const answer = async (request: SpaceRequest): Promise<SpaceReply | null> => {
    if (request.type === 'meta') { meta = { index: indexMetaModel(request.meta), number: request.number }; return null; }
    if (request.type === 'checked') return { type: 'checked', id: request.id, change: await check(request) };
    const was = built.get(request.product);
    if (request.type === 'input') {
      if (!was || was.seq !== request.seq) return { type: 'input', id: request.id, change: null };
      const key = `${request.view}|${request.measure}|${request.root}`;
      const input = productInput(was.index, request.root, request.view, request.measure);
      const sent = request.held ? was.inputs.get(key) ?? null : null;
      was.inputs.set(key, input);
      return { type: 'input', id: request.id, change: inputChange(sent, input) };
    }
    const query = `?${new URLSearchParams({ product_id: request.product })}`;
    const [summaries, folders] = await Promise.all([
      request.summaries || !was ? read<RecordSummaries>(`${SUMMARIES}${query}`) : null,
      request.folders || !was ? read<FolderTree>(`${FOLDERS}${query}`) : null,
    ]);
    const refused = [summaries, folders].find((r) => r?.state === 'refused');
    if (refused?.state === 'refused') return { type: 'read', id: request.id, change: { refused: { error: refused.error, problems: refused.problems } } };
    const answers = { summaries: summaries?.state === 'read' ? summaries.answer : was!.summaries, folders: folders?.state === 'read' ? folders.answer : was!.folders };
    // What was not read again stands as it was: its records, and the index and tree when nothing they read changed.
    const records = was && answers.summaries === was.summaries ? was.records : recordsOf(answers.summaries, was?.records ?? null);
    const stands = was && was.records === records && was.folders === answers.folders && was.meta === meta!.number;
    const index = stands ? was.index : indexOf(meta!.index, records, answers.folders, NO_PROBLEMS, NO_COVERAGE);
    const tree = stands ? was.tree : treeOf(index);
    const from = was && was.seq === request.base ? was : null;
    const next: Built = { seq: ++seq, meta: meta!.number, summaries: answers.summaries, records, folders: answers.folders, index, tree, inputs: was?.inputs ?? new Map() };
    keep(built, request.product, next);
    return {
      type: 'read', id: request.id, change: {
        product: request.product, seq: next.seq, base: from?.seq ?? null, meta: next.meta,
        records: recordsChange(from?.records ?? EMPTY_RECORDS, records),
        folders: foldersChange(from?.folders ?? null, answers.folders),
        tree: treeChange(from?.tree ?? emptyTree(), tree, records.byId),
      },
    };
  };
  return answer;
}

