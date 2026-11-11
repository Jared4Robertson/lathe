import type { Stage } from '../../../../lathe/src/platform/data/schema';
import type { StageCounts } from '../../exploring/folder-tree/stage-counts';
import type { RecordIndex } from '../../exploring/record-summaries/record-index';

// The Domains by stage table (LA-TRC-QRY02 and LA-EXP-QRY05): one row per domain and one for Shared, a cell per stage
// counting every record folded under it, with its gaps and tests not automated yet. A gap names a record's kind, so
// it goes to that kind's stage; a gap about a file or a route goes to Technical specification, and every test is in
// Test plan.

export const STAGES: readonly { stage: Stage; label: string; short: string }[] = [
  { stage: 'discovery', label: 'Discovery', short: 'Disc.' },
  { stage: 'domain-model', label: 'Domain model', short: 'Model' },
  { stage: 'use-cases', label: 'Use cases', short: 'Cases' },
  { stage: 'interface-design', label: 'Interface design', short: 'Design' },
  { stage: 'technical-specification', label: 'Technical specification', short: 'Tech' },
  { stage: 'test-plan', label: 'Test plan', short: 'Tests' },
];

const TECHNICAL: Stage = 'technical-specification';
const TESTS: Stage = 'test-plan';

export interface StageCell {
  stage: Stage;
  label: string;
  /** Every record folded under the stage; undefined while it is read. */
  records: number | undefined;
  /** Its gaps and tests not automated yet; undefined while coverage is read. */
  marks: number | undefined;
  /** "DM-SHOP/domain-model": the address of the stage in this domain or Shared. */
  key: string;
  /** How dark to draw it, as a share of the stage's color: darker means more. */
  heat: number;
}

export interface StageRow {
  /** The domain's ID, or the product's for Shared. */
  owner: string;
  shared: boolean;
  title: string;
  cells: StageCell[];
  /** The row's gaps and tests not automated yet, summed. */
  marks: number | undefined;
}

export interface StageTable {
  rows: StageRow[];
  gaps: number | undefined;
  notAutomated: number | undefined;
}

/** How dark a cell is, by its share of the product's fullest cell (on Lathe's spec: under 50 records, 150, 300, more). */
const HEATS = [{ under: 1 / 20, heat: 6 }, { under: 1 / 7, heat: 14 }, { under: 2 / 7, heat: 24 }];
export function heatOf(records: number, most: number): number {
  const share = records / Math.max(most, 1);
  return HEATS.find((h) => share < h.under)?.heat ?? 34;
}

/** Each gap in `gaps` by the stage of its kind; a file's or a route's goes to Technical specification. */
function gapsByStage(index: RecordIndex, gaps: readonly { kind: string }[]): Map<Stage, number> {
  const by = new Map<Stage, number>();
  for (const g of gaps) {
    const stage = index.meta.kinds.get(g.kind)?.stage ?? TECHNICAL;
    by.set(stage, (by.get(stage) ?? 0) + 1);
  }
  return by;
}

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/** The table: `counts` is the builder's answer, undefined while it is read; the marks wait for the coverage read. */
export function stageTable(index: RecordIndex, counts: StageCounts | undefined, covered: boolean): StageTable {
  const owners = [...index.domains.map((d) => ({ owner: d.id, shared: false, title: d.title })), { owner: index.product, shared: true, title: 'Shared' }];
  const most = counts ? Math.max(...Object.values(counts).flatMap((o) => Object.values(o).map((n) => n ?? 0)), 0) : 0;
  const rows = owners.map(({ owner, shared, title }) => {
    const scope = index.coverage.get(owner);
    const gaps = gapsByStage(index, scope?.gaps ?? []);
    const notAutomated = scope?.tests.notAutomated ?? 0;
    const cells = STAGES.map(({ stage, label }): StageCell => {
      const records = counts ? counts[owner]?.[stage] ?? 0 : undefined;
      const marks = covered ? (gaps.get(stage) ?? 0) + (stage === TESTS ? notAutomated : 0) : undefined;
      return { stage, label, records, marks, key: `${owner}/${stage}`, heat: heatOf(records ?? 0, most) };
    });
    return { owner, shared, title, cells, marks: covered ? sum(cells.map((c) => c.marks!)) : undefined };
  });
  const scopes = [...index.coverage.values()];
  return {
    rows,
    gaps: covered ? sum(scopes.map((s) => s.gaps.length)) : undefined,
    notAutomated: covered ? sum(scopes.map((s) => s.tests.notAutomated)) : undefined,
  };
}
