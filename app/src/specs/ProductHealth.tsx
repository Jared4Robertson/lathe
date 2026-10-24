import { Link } from '../router';
import { byIdOrder, recordPath, type Coverage, type SpecIndex, type SpecRecord } from './data';
import { Markdown } from './Markdown';

// Coverage (designed, built, proved) and a product's fitness with the evidence beside it.

/** The address of the format section that explains fitness records. */
export const FITNESS_FORMAT_PATH = '/format#7-fitness';

/** A count the engine may not report yet (built counts before the engine measures them). */
const measured = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function Bar({ label, value, total, title }: { label: string; value: number | null; total: number; title: string }) {
  if (value === null) {
    return (
      <div className="bar unmeasured" title={title}>
        <span className="bar-label">{label}</span>
        <span className="bar-unknown">not yet measured</span>
      </div>
    );
  }
  const percent = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="bar" title={title}>
      <span className="bar-label">{label}</span>
      <span className="bar-track" role="img" aria-label={`${label}: ${value} of ${total}`}>
        <span className={`bar-fill ${total > 0 && value === total ? 'full' : ''}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="bar-value">{value}/{total}</span>
    </div>
  );
}

const DESIGNED = 'Designed: a component satisfies it (its file may not exist yet).';
const BUILT = 'Built: a component whose file exists satisfies it.';
const PROVED = 'Proved: a test proves it.';

function CoverageGroup({ heading, total, designed, built, proved }: { heading: string; total: number; designed: number; built: number | null; proved: number }) {
  return (
    <>
      <p className="coverage-heading">{heading} <span>{total}</span></p>
      <Bar label="designed" value={designed} total={total} title={DESIGNED} />
      <Bar label="built" value={built} total={total} title={BUILT} />
      <Bar label="proved" value={proved} total={total} title={PROVED} />
    </>
  );
}

/** A domain's coverage: requirements and domain rules, each designed, built and proved. */
export function CoverageBars({ coverage }: { coverage: Coverage | undefined }) {
  if (!coverage) return <p className="hint">No coverage figures for this domain.</p>;
  return (
    <div className="coverage">
      <CoverageGroup heading="Requirements" total={coverage.requirements} designed={coverage.requirements_satisfied} built={measured(coverage.requirements_built)} proved={coverage.requirements_proved} />
      <CoverageGroup heading="Domain rules" total={coverage.rules} designed={coverage.rules_satisfied} built={measured(coverage.rules_built)} proved={coverage.rules_proved} />
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
            <Link to={recordPath(latest.id)} className="record-link"><code>{latest.id}</code></Link></span>
        </p>
        <Markdown source={latest.body} />
      </div>
      <h3>History <span className="section-count">{history.length}</span></h3>
      <ol className="record-list fitness-history">
        {history.map((f) => (
          <li key={f.id}>
            <time dateTime={f.fields.date}>{f.fields.date}</time>
            <Score value={f.fields.score} />
            <Link to={recordPath(f.id)} className="record-link"><code>{f.id}</code><span>{f.title}</span></Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------- Evidence ----------

const sum = (values: (number | null)[]) => (values.some((v) => v === null) ? null : values.reduce<number>((a, v) => a + (v ?? 0), 0));

/** Signals Lathe can count about a product. Evidence for the fitness judgment, never the score. */
export function EvidencePanel({ index, productId }: { index: SpecIndex; productId: string }) {
  const domains = index.domainsOf.get(productId) ?? [];
  const coverage = domains.map((d) => index.coverage.get(d.id)).filter((c): c is Coverage => !!c);
  const total = (pick: (c: Coverage) => number) => coverage.reduce((a, c) => a + pick(c), 0);
  const items = total((c) => c.requirements + c.rules);
  const designed = total((c) => c.requirements_satisfied + c.rules_satisfied);
  const built = sum(coverage.map((c) => {
    const r = measured(c.requirements_built);
    const d = measured(c.rules_built);
    return r === null || d === null ? null : r + d;
  }));
  const proved = total((c) => c.requirements_proved + c.rules_proved);
  const questions = index.workspace.records.filter((r) => r.kind === 'question' && r.product === productId).length;
  const problems = index.workspace.problems.filter((p) => p.record && index.byId.get(p.record)?.product === productId);
  const errors = problems.filter((p) => p.severity === 'error').length;
  const of = (n: number | null) => (n === null ? 'not yet measured' : `${n} of ${items}`);
  return (
    <div className="evidence" aria-label="Evidence">
      <p className="hint">Signals Lathe counts. They inform the judgment above; they are not the score.</p>
      <dl className="fields evidence-list">
        <div><dt>Designed</dt><dd>{of(designed)} requirements and rules</dd></div>
        <div><dt>Built</dt><dd>{built === null ? 'not yet measured' : `${of(built)} requirements and rules`}</dd></div>
        <div><dt>Proved</dt><dd>{of(proved)} requirements and rules</dd></div>
        <div><dt>Open questions</dt><dd>{questions}</dd></div>
        <div><dt>Errors</dt><dd>{errors}</dd></div>
        <div><dt>Warnings</dt><dd>{problems.length - errors}</dd></div>
      </dl>
    </div>
  );
}
