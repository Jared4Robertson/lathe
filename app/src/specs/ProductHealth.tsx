import { plural } from '../plural';
import type { ReactNode } from 'react';
import { Link } from '../router';
import { byIdOrder, type Coverage, type SpecIndex, type SpecRecord } from './data';
import type { TestCounts } from '../../../lathe/src/types';
import { addressOf } from '../views/address';
import { LongList } from '../components/LongList';
import { Markdown } from './Markdown';

// Coverage (designed, built, proved, planned) per obligation kind, proof still owed by planned tests, each domain's
// tests by state, and a product's fitness with the evidence beside it.

/** The address of the format section that explains fitness records. */
export const FITNESS_FORMAT_PATH = '/format#7-fitness';

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

const DESIGNED = 'Designed: a record designs it, such as a component that satisfies it (its file may not exist yet).';
const BUILT = 'Built: a component whose file exists designs it.';
const PROVED = 'Proved: an automated or manual test proves it.';
const PLANNED = 'Planned: not proved yet, but a planned test is meant to prove it. A planned test is not proof.';
const MORE_PLANNED = 'Already proved, but a planned test is meant to prove them too: proof still owed by tests not written yet.';

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
  automated: 'Automated: run by a test runner (a test with no state is automated).',
  manual: 'Manual: a person runs it by following its steps.',
  planned: 'Planned: not written yet. It does not count as proof.',
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

// ---------- Fitness ----------

/** The product's fitness records, newest first. */
export function fitnessOf(index: SpecIndex, productId: string): SpecRecord[] {
  return index.workspace.records
    .filter((r) => r.kind === 'fitness' && r.product === productId)
    .sort((a, b) => (b.fields.date ?? '').localeCompare(a.fields.date ?? '') || byIdOrder(b, a));
}

function Score({ value }: { value: string | undefined }) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 5) return <span className="score invalid">{value || 'no score'}</span>;
  return (
    <span className="score" aria-label={`Score ${score} of 5`}>
      <span className="score-pips" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= score ? 'on' : ''} />)}
      </span>
      <strong>{score}</strong>/5
    </span>
  );
}

export function FitnessPanel({ index, productId }: { index: SpecIndex; productId: string }) {
  const history = fitnessOf(index, productId);
  if (history.length === 0) {
    return (
      <div className="fitness empty-fitness">
        <p>No fitness recorded yet.</p>
        <p className="hint">
          Fitness is the judgment of the person this product serves; Lathe never scores itself. To record it, add a
          {' '}<code>fitness</code> record under the product with a <code>date</code>, a <code>score</code> from 1 to 5 and,
          in its body, the experiences behind the score. See <Link to={FITNESS_FORMAT_PATH}>the format, section 7: Fitness</Link>.
        </p>
      </div>
    );
  }
  const [latest] = history;
  return (
    <div className="fitness">
      <div className="fitness-latest">
        <p className="fitness-score">
          <Score value={latest.fields.score} />
          <span className="meta">judged on <time dateTime={latest.fields.date}>{latest.fields.date}</time> in{' '}
            <Link to={addressOf(latest.id)} className="record-link"><code>{latest.id}</code></Link></span>
        </p>
        <Markdown source={latest.body} />
      </div>
      <h3>History <span className="section-count">{history.length}</span></h3>
      <LongList
        label="Fitness history"
        ordered
        className="record-list fitness-history"
        items={history}
        itemKey={(f) => f.id}
        searchText={(f) => `${f.id} ${f.title} ${f.fields.date ?? ''}`}
        render={(f) => (
          <>
            <time dateTime={f.fields.date}>{f.fields.date}</time>
            <Score value={f.fields.score} />
            <Link to={addressOf(f.id)} className="record-link row-link"><code>{f.id}</code><span>{f.title}</span></Link>
          </>
        )}
      />
    </div>
  );
}

// ---------- Evidence ----------


/** Signals Lathe can count about a product. Evidence for the fitness judgment, never the score. */
export function EvidencePanel({ index, productId }: { index: SpecIndex; productId: string }) {
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
    <div className="evidence" aria-label="Evidence">
      <p className="hint">Signals Lathe counts. They inform the judgment above; they are not the score.</p>
      <dl className="fields evidence-list">
        <div><dt>Designed</dt><dd>{of(designed)}</dd></div>
        <div><dt>Built</dt><dd>{of(built)}</dd></div>
        <div><dt>Proved</dt><dd>{of(proved)}</dd></div>
        <div><dt>Planned</dt><dd>{of(planned)}, by tests not written yet{more ? `; ${more} more planned beside proof` : ''}</dd></div>
        <div><dt>Tests</dt><dd>{testsText}</dd></div>
        <div><dt>Open questions</dt><dd>{questions}</dd></div>
        <div><dt>Errors</dt><dd>{errors}</dd></div>
        <div><dt>Warnings</dt><dd>{problems.length - errors}</dd></div>
      </dl>
    </div>
  );
}
