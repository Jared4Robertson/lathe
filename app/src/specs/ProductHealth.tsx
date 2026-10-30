import { plural } from '../plural';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import type { ObligationFigures, ScopeCoverage } from '../../../lathe/src/traceability/coverage/read-model';

type TestCounts = ScopeCoverage['tests'];

// Coverage as the engine counts it (designed, built, proved, and tests not automated yet) per obligation kind, each
// domain's tests by state, and a product's summary of what Lathe counts across its domains and its records outside
// every domain, all from the Coverage read (get-coverage, LA-TRC-RM01). A pattern rule is asked for proof only, so its
// designed and built bars say so.

const sum = (values: number[]) => values.reduce((a, v) => a + v, 0);

function Bar({ label, value, total, title, notAutomated = false }: { label: string; value: number; total: number; title: string; notAutomated?: boolean }) {
  const percent = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className={notAutomated ? 'bar not-automated' : 'bar'} title={title}>
      <span className="bar-label">{label}</span>
      <span className="bar-track" role="img" aria-label={`${label}: ${value} of ${total}`}>
        <span className={`bar-fill ${!notAutomated && total > 0 && value === total ? 'full' : ''}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="bar-value">{value}/{total}</span>
    </div>
  );
}

const DESIGNED = 'Designed: its implementation is specified: a flow step fulfills a UC requirement, a technical record carries out anything else (its file may not exist yet).';
const BUILT = 'Built: the technical record carrying it out names a file that exists.';
const PROVED = 'Proved: an automated or manual test at a level its test kind allows proves it.';
const NOT_AUTOMATED = 'Not automated yet: not proved yet, but a test of it is not automated yet. It is not proof.';
const PROOF_ONLY = 'Asked for proof only: a pattern rule is proved in each domain that owes it.';

function CoverageGroup({ group }: { group: ObligationFigures }) {
  const { total } = group;
  const label = group.label || group.kind.replaceAll('_', ' ');
  return (
    <div className="coverage-group" data-kind={group.kind}>
      <p className="coverage-heading">{plural(label)} <span>{total}</span></p>
      {group.proofOnly
        ? <p className="hint" title={PROOF_ONLY}>Proof only</p>
        : <>
          <Bar label="designed" value={group.designed} total={total} title={DESIGNED} />
          <Bar label="built" value={group.built} total={total} title={BUILT} />
        </>}
      <Bar label="proved" value={group.proved} total={total} title={PROVED} />
      <Bar label="not automated" value={group.notAutomated} total={total} title={NOT_AUTOMATED} notAutomated />
    </div>
  );
}

// ---------- Tests by state ----------

const TEST_STATES = [
  { key: 'automated', mark: 'automated', label: 'automated', title: 'Automated: a file runs it.' },
  { key: 'manual', mark: 'manual', label: 'manual', title: 'Manual: a person runs it by following its steps.' },
  { key: 'notAutomated', mark: 'not_automated', label: 'not automated yet', title: 'Not automated yet: no file runs it. It does not count as proof.' },
] as const;

/** Sums several domains' test counts. */
function sumTestCounts(counts: TestCounts[]): TestCounts {
  return { automated: sum(counts.map((c) => c.automated)), manual: sum(counts.map((c) => c.manual)), notAutomated: sum(counts.map((c) => c.notAutomated)) };
}

/** "12 automated, 1 manual, 2 not automated yet". */
function TestCountsLine({ counts }: { counts: TestCounts }) {
  return (
    <p className="test-counts" aria-label="Tests by state">
      <span className="test-counts-label">Tests</span>{' '}
      {TEST_STATES.map((state, i) => (
        <span key={state.key} className={`test-count ${state.mark}`} data-state={state.mark} title={state.title}>
          {i > 0 && ', '}{counts[state.key]} {state.label}
        </span>
      ))}
    </p>
  );
}

/** A domain's coverage (or a product's outside every domain): one group per obligation kind that has any, and its tests. */
export function CoverageBars({ coverage }: { coverage: ScopeCoverage | undefined }) {
  if (!coverage) return <p className="hint">No coverage figures for this domain.</p>;
  const groups = coverage.obligations.filter((o) => o.total > 0);
  return (
    <div className="coverage">
      {groups.length === 0 && <p className="hint">No obligations yet.</p>}
      {groups.map((g) => <CoverageGroup key={g.kind} group={g} />)}
      <TestCountsLine counts={coverage.tests} />
    </div>
  );
}

// ---------- Product summary ----------

/** What Lathe counts across a product, its domains and its records outside them: coverage, tests, open questions, errors and warnings. */
export function ProductSummary({ index, productId }: { index: RecordIndex; productId: string }) {
  const coverage = productId === index.product ? [...index.coverage.values()] : [];
  const groups = coverage.flatMap((c) => c.obligations);
  const items = sum(groups.map((g) => g.total));
  const asked = sum(groups.filter((g) => !g.proofOnly).map((g) => g.total));
  const designed = sum(groups.filter((g) => !g.proofOnly).map((g) => g.designed));
  const built = sum(groups.filter((g) => !g.proofOnly).map((g) => g.built));
  const proved = sum(groups.map((g) => g.proved));
  const notAutomated = sum(groups.map((g) => g.notAutomated));
  const tests = sumTestCounts(coverage.map((c) => c.tests));
  const testsText = TEST_STATES.map((s) => `${tests[s.key]} ${s.label}`).join(', ');
  const questions = [...index.byId.values()].filter((r) => r.kind === 'question' && r.product === productId).length;
  const problems = [...index.problemsFor].filter(([id]) => index.byId.get(id)?.product === productId).flatMap(([, list]) => list);
  const errors = problems.filter((p) => p.severity === 'error').length;
  const of = (n: number, total = items) => `${n} of ${total} obligations`;
  return (
    <dl className="fields summary-list">
      <div><dt>Designed</dt><dd>{of(designed, asked)}</dd></div>
      <div><dt>Built</dt><dd>{of(built, asked)}</dd></div>
      <div><dt>Proved</dt><dd>{of(proved)}</dd></div>
      <div><dt>Not automated yet</dt><dd>{of(notAutomated)}, by tests no file runs yet</dd></div>
      <div><dt>Tests</dt><dd>{testsText}</dd></div>
      <div><dt>Open questions</dt><dd>{questions}</dd></div>
      <div><dt>Errors</dt><dd>{errors}</dd></div>
      <div><dt>Warnings</dt><dd>{problems.length - errors}</dd></div>
    </dl>
  );
}
