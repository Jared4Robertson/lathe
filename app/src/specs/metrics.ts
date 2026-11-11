import type { ScopeCoverage } from '../../../lathe/src/traceability/coverage/read-model';
import type { ListedProblem, ProductProblems } from '../../../lathe/src/checking/problems/read-model';
import { panelHref } from '../views/overlays';

// The key metrics (LA-PAT-APP-UX-R25): each metric's label, unit and meaning written once, and worked out by one
// function from the aggregates' own reads, so a metric reads the same on every page that shows it. Coverage and tests
// are the Coverage read's (get-coverage, LA-TRC-RM01); errors and warnings the Problems read's (list-problems,
// LA-CHK-QRY02), the query the Checks panel reads; outcomes the Product read's (get-product). Every figure is of one
// product, or of one domain in it.

export type MetricKey = 'outcomesServed' | 'designed' | 'built' | 'proved' | 'testsAutomated' | 'errors' | 'warnings' | 'openQuestions' | 'journeysProved' | 'gaps';

interface MetricDefinition {
  label: string;
  /** What its total counts, after "of": "of 7 obligations". None for a plain count. */
  unit?: string;
  /** What it counts, as its tooltip says. */
  meaning: string;
}

export const METRICS: Record<MetricKey, MetricDefinition> = {
  outcomesServed: { label: 'Outcomes served', unit: 'outcomes', meaning: 'Business outcomes that some capability serves.' },
  designed: { label: 'Designed', unit: 'obligations', meaning: 'Obligations whose implementation is specified: a flow step fulfills a UC requirement, a technical record carries out anything else. A pattern rule asks for proof only, so it is not counted here.' },
  built: { label: 'Built', unit: 'obligations', meaning: 'Obligations whose technical record names a file that exists. A pattern rule asks for proof only, so it is not counted here.' },
  proved: { label: 'Proved', unit: 'obligations', meaning: 'Obligations an automated or manual test proves, at a level its test kind allows.' },
  testsAutomated: { label: 'Tests automated', unit: 'tests', meaning: 'Tests a file runs. A manual test is run by a person; a test not automated yet does not count as proof.' },
  errors: { label: 'Errors', meaning: 'Problems the checks report as errors. Open the Checks panel to work through them.' },
  warnings: { label: 'Warnings', meaning: 'Problems the checks report as warnings. Open the Checks panel to work through them.' },
  openQuestions: { label: 'Open questions', meaning: 'Questions still open, each with its owner.' },
  journeysProved: { label: 'Journeys proved', unit: 'journeys', meaning: 'Journeys whose journey test counts and whose every step is proved.' },
  gaps: { label: 'Gaps', meaning: 'Every coverage gap in the product: each obligation not yet designed, built or proved, and each record or file short of a minimum.' },
};

/** One metric as a page shows it: its value, its total when it has one, a line of detail, and where it leads. */
export interface MetricFigure {
  key: MetricKey;
  /** Undefined while its read is on its way: never shown as zero. */
  value: number | undefined;
  total?: number;
  detail?: string;
  to?: string;
  /** Worth a look now (an error), worth a look (a warning), or done (every one of its total). */
  tone?: 'attention' | 'caution' | 'done';
  /** The first tile not complete, read left to right: the one Status names (the Dashboard's tiles only). */
  rung?: boolean;
}

const sum = (values: readonly number[]) => values.reduce((a, v) => a + v, 0);

/** Done when every one of a total there is to count is. */
const done = (value: number, total: number) => (total > 0 && value === total ? 'done' as const : undefined);

/** Designed, built and proved over the scopes' obligations, and their tests automated (with the manual and not automated yet ones). */
export function coverageMetrics(scopes: readonly ScopeCoverage[]): MetricFigure[] {
  const groups = scopes.flatMap((s) => s.obligations);
  const asked = groups.filter((g) => !g.proofOnly);
  const all = sum(groups.map((g) => g.total));
  const askedTotal = sum(asked.map((g) => g.total));
  const designed = sum(asked.map((g) => g.designed));
  const built = sum(asked.map((g) => g.built));
  const proved = sum(groups.map((g) => g.proved));
  const automated = sum(scopes.map((s) => s.tests.automated));
  const manual = sum(scopes.map((s) => s.tests.manual));
  const notAutomated = sum(scopes.map((s) => s.tests.notAutomated));
  return [
    { key: 'designed', value: designed, total: askedTotal, tone: done(designed, askedTotal) },
    { key: 'built', value: built, total: askedTotal, tone: done(built, askedTotal) },
    { key: 'proved', value: proved, total: all, tone: done(proved, all) },
    { key: 'testsAutomated', value: automated, total: automated + manual + notAutomated, detail: `${manual} manual, ${notAutomated} not automated yet` },
  ];
}

/** The errors and warnings among the problems, each leading to the Checks panel; undefined values while they are read. */
export function problemMetrics(problems: readonly ListedProblem[] | undefined): MetricFigure[] {
  const errors = problems?.filter((p) => p.severity === 'error').length;
  const warnings = problems && problems.length - errors!;
  return [
    { key: 'errors', value: errors, to: panelHref('checks'), tone: errors ? 'attention' : undefined },
    { key: 'warnings', value: warnings, to: panelHref('checks'), tone: warnings ? 'caution' : undefined },
  ];
}

/** Every problem of the product as the Checks panel lists it: its own and the workspace's. */
export const productProblems = (read: ProductProblems | null): ListedProblem[] | undefined =>
  read ? [...read.own, ...read.workspace].flatMap((g) => g.problems) : undefined;

/** The product's business outcomes some capability serves, of its outcomes. */
export function outcomesServedMetric(outcomes: readonly { servedBy: readonly string[] }[]): MetricFigure {
  const served = outcomes.filter((o) => o.servedBy.length > 0).length;
  return { key: 'outcomesServed', value: served, total: outcomes.length, tone: done(served, outcomes.length) };
}

/** The open questions of a product or a domain. */
export const openQuestionsMetric = (count: number): MetricFigure => ({ key: 'openQuestions', value: count });

/** The journeys proved of the product's journeys, with the steps proved under them; undefined while they are read. */
export function journeysProvedMetric(journeys: readonly { proved: boolean; status: { steps: number; stepsProved: number } }[] | undefined, to?: string): MetricFigure {
  if (!journeys) return { key: 'journeysProved', value: undefined };
  const proved = journeys.filter((j) => j.proved).length;
  const steps = sum(journeys.map((j) => j.status.steps));
  const stepsProved = sum(journeys.map((j) => j.status.stepsProved));
  return { key: 'journeysProved', value: proved, total: journeys.length, detail: `${stepsProved} of ${steps} steps proved`, to, tone: done(proved, journeys.length) ?? (journeys.length ? 'caution' : undefined) };
}

/** Every coverage gap over the scopes; undefined while coverage is read. */
export function gapsMetric(scopes: readonly ScopeCoverage[] | undefined, to?: string): MetricFigure {
  if (!scopes) return { key: 'gaps', value: undefined };
  const gaps = sum(scopes.map((s) => s.gaps.length));
  return { key: 'gaps', value: gaps, detail: 'Coverage gaps', to, tone: gaps ? 'caution' : undefined };
}
