import { figureText, plural } from '../plural';
import type { ObligationFigures, ScopeCoverage } from '../../../lathe/src/traceability/coverage/read-model';

type TestCounts = ScopeCoverage['tests'];

// Coverage as the engine counts it (designed, built, proved, and tests not automated yet) per obligation kind, and each
// domain's tests by state, from the Coverage read (get-coverage, LA-TRC-RM01). A pattern rule is asked for proof only,
// so its designed and built bars say so. What a product or a domain totals up front is its Key metrics (KeyMetrics).

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
      <Bar label="not automated yet" value={group.notAutomated} total={total} title={NOT_AUTOMATED} notAutomated />
    </div>
  );
}

// ---------- Tests by state ----------

const TEST_STATES = [
  { key: 'automated', mark: 'automated', label: 'automated', title: 'Automated: a file runs it.' },
  { key: 'manual', mark: 'manual', label: 'manual', title: 'Manual: a person runs it by following its steps.' },
  { key: 'notAutomated', mark: 'not_automated', label: 'not automated yet', title: 'Not automated yet: no file runs it. It does not count as proof.' },
] as const;

/** "12 automated, 1 manual, 2 not automated yet". */
function TestCountsLine({ counts }: { counts: TestCounts }) {
  return (
    <p className="test-counts" aria-label="Tests by state">
      <span className="test-counts-label">Tests</span>{' '}
      {TEST_STATES.map((state, i) => (
        <span key={state.key} className={`test-count ${state.mark}`} data-state={state.mark} title={state.title}>
          {i > 0 && ', '}{figureText(counts[state.key])} {state.label}
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
