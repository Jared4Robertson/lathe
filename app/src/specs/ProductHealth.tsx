import { plural } from '../plural';
import type { ReactNode } from 'react';
import type { Coverage, SpecIndex } from './data';
import type { TestCounts } from '../../../lathe/src/types';

// Coverage (designed, built, proved, planned) per obligation kind, proof still owed by planned tests, each domain's
// tests by state, and a product's summary of what Lathe counts across its domains.

const sum = (values: number[]) => values.reduce((a, v) => a + v, 0);

function Bar({ label, value, total, title, planned = false, children }: { label: string; value: number; total: number; title: string; planned?: boolean; children?: ReactNode }) {
  const percent = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className={planned ? 'bar planned' : 'bar'} title={title}>
      <span className="bar-label">{label}</span>
      <span className="bar-track" role="img" aria-label={`${label}: ${value} of ${total}`}>
        <span className={`bar-fill ${!planned && total > 0 && value === total ? 'full' : ''}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="bar-value">{value}/{total}</span>
      {children}
    </div>
  );
}

const DESIGNED = 'Designed: its implementation is specified: a flow step fulfills a UC requirement, a technical record carries out anything else (its file may not exist yet).';
const BUILT = 'Built: a technical record carrying it out names a file that exists.';
const PROVED = 'Proved: an automated or manual test proves it.';
const PLANNED = 'Not automated yet: not proved yet, but a test not automated yet is meant to prove it. It is not proof.';
const MORE_PLANNED = 'Already proved, but a test not automated yet is meant to prove them too: proof still owed.';

/** One bar group: an obligation kind's counts in a domain. */
export interface ObligationGroup {
  kind: string;
  label: string;
  total: number;
  designed: number;
  built: number;
  proved: number;
  planned: number;
  /** Has a planned test meant to prove it, proved or not. */
  plannedAny: number;
}

/** "UC requirement" -> "UC requirements", "Domain rule" -> "Domain rules". */
export const pluralLabel = (label: string) => plural(label);

/** A domain's coverage as one group per obligation kind, in meta-model order. */
export function obligationGroups(coverage: Coverage): ObligationGroup[] {
  return coverage.obligations.map((o) => ({
    kind: o.kind,
    label: o.label || o.kind.replaceAll('_', ' '),
    total: o.total,
    designed: o.designed,
    built: o.built,
    proved: o.proved,
    planned: o.planned,
    plannedAny: o.planned_any,
  }));
}

function CoverageGroup({ group }: { group: ObligationGroup }) {
  const { total } = group;
  return (
    <div className="coverage-group" data-kind={group.kind}>
      <p className="coverage-heading">{pluralLabel(group.label)} <span>{total}</span></p>
      <Bar label="designed" value={group.designed} total={total} title={DESIGNED} />
      <Bar label="built" value={group.built} total={total} title={BUILT} />
      <Bar label="proved" value={group.proved} total={total} title={PROVED} />
      <Bar label="planned" value={group.planned} total={total} title={PLANNED} planned>
        <MorePlanned group={group} />
      </Bar>
    </div>
  );
}

/** Obligations already proved that a planned test is still meant to prove. */
export const morePlanned = (group: ObligationGroup) => Math.max(0, group.plannedAny - group.planned);

/** "2 more planned" beside the planned bar: proof still owed for obligations other tests already prove. */
function MorePlanned({ group }: { group: ObligationGroup }) {
  const more = morePlanned(group);
  if (!more) return null;
  return <span className="bar-more" title={MORE_PLANNED} data-more={more}>{more} more planned</span>;
}

// ---------- Tests by state ----------

const TEST_STATES = ['automated', 'manual', 'planned'] as const;

/** Sums several domains' test counts. */
export function sumTestCounts(counts: TestCounts[]): TestCounts {
  const add = (state: (typeof TEST_STATES)[number]) => sum(counts.map((c) => c[state]));
  return { automated: add('automated'), manual: add('manual'), planned: add('planned') };
}

const TEST_TITLES: Record<(typeof TEST_STATES)[number], string> = {
  automated: 'Automated: a file runs it.',
  manual: 'Manual: a person runs it by following its steps.',
  planned: 'Not automated yet: no file runs it. It does not count as proof.',
};

/** "12 automated, 1 manual, 2 planned". */
export function TestCountsLine({ counts }: { counts: TestCounts }) {
  return (
    <p className="test-counts" aria-label="Tests by state">
      <span className="test-counts-label">Tests</span>{' '}
      {TEST_STATES.map((state, i) => (
        <span key={state} className={`test-count ${state}`} data-state={state} title={TEST_TITLES[state]}>
          {i > 0 && ', '}{counts[state]} {state}
        </span>
      ))}
    </p>
  );
}

/** A domain's coverage: one group per obligation kind, each designed, built, proved and planned. */
export function CoverageBars({ coverage }: { coverage: Coverage | undefined }) {
  if (!coverage) return <p className="hint">No coverage figures for this domain.</p>;
  return (
    <div className="coverage">
      {obligationGroups(coverage).map((g) => <CoverageGroup key={g.kind} group={g} />)}
      <TestCountsLine counts={coverage.tests} />
    </div>
  );
}

// ---------- Product summary ----------

/** What Lathe counts across a product: its coverage, tests, open questions, errors and warnings. */
export function ProductSummary({ index, productId }: { index: SpecIndex; productId: string }) {
  const domains = index.domainsOf.get(productId) ?? [];
  const coverage = domains.map((d) => index.coverage.get(d.id)).filter((c): c is Coverage => !!c);
  const groups = coverage.flatMap(obligationGroups);
  const items = sum(groups.map((g) => g.total));
  const designed = sum(groups.map((g) => g.designed));
  const built = sum(groups.map((g) => g.built));
  const proved = sum(groups.map((g) => g.proved));
  const planned = sum(groups.map((g) => g.planned));
  const more = sum(groups.map(morePlanned));
  const tests = sumTestCounts(coverage.map((c) => c.tests));
  const testsText = TEST_STATES.map((s) => `${tests[s]} ${s}`).join(', ');
  const questions = index.workspace.records.filter((r) => r.kind === 'question' && r.product === productId).length;
  const problems = index.workspace.problems.filter((p) => p.record && index.byId.get(p.record)?.product === productId);
  const errors = problems.filter((p) => p.severity === 'error').length;
  const of = (n: number) => `${n} of ${items} obligations`;
  return (
    <dl className="fields summary-list">
      <div><dt>Designed</dt><dd>{of(designed)}</dd></div>
      <div><dt>Built</dt><dd>{of(built)}</dd></div>
      <div><dt>Proved</dt><dd>{of(proved)}</dd></div>
      <div><dt>Planned</dt><dd>{of(planned)}, by tests not written yet{more ? `; ${more} more planned beside proof` : ''}</dd></div>
      <div><dt>Tests</dt><dd>{testsText}</dd></div>
      <div><dt>Open questions</dt><dd>{questions}</dd></div>
      <div><dt>Errors</dt><dd>{errors}</dd></div>
      <div><dt>Warnings</dt><dd>{problems.length - errors}</dd></div>
    </dl>
  );
}
