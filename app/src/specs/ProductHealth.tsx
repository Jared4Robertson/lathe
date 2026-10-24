import { Link } from '../router';
import { byIdOrder, recordPath, type Coverage, type SpecIndex, type SpecRecord } from './data';
import { Markdown } from './Markdown';

// Coverage (designed, built, proved, planned) per obligation kind, and a product's fitness with the evidence beside it.

/** The address of the format section that explains fitness records. */
export const FITNESS_FORMAT_PATH = '/format#7-fitness';

/** A count the engine may not report yet (built counts before the engine measures them). */
const measured = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function Bar({ label, value, total, title, planned = false }: { label: string; value: number | null; total: number; title: string; planned?: boolean }) {
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
    <div className={planned ? 'bar planned' : 'bar'} title={title}>
      <span className="bar-label">{label}</span>
      <span className="bar-track" role="img" aria-label={`${label}: ${value} of ${total}`}>
        <span className={`bar-fill ${!planned && total > 0 && value === total ? 'full' : ''}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="bar-value">{value}/{total}</span>
    </div>
  );
}

const DESIGNED = 'Designed: a record designs it, such as a component that satisfies it (its file may not exist yet).';
const BUILT = 'Built: a component whose file exists designs it.';
const PROVED = 'Proved: an automated or manual test proves it.';
const PLANNED = 'Planned: not proved yet, but a planned test is meant to prove it. A planned test is not proof.';

/** One bar group: an obligation kind's counts in a domain. A null count is one the engine does not report. */
export interface ObligationGroup {
  kind: string;
  label: string;
  total: number;
  designed: number;
  built: number | null;
  proved: number;
  planned: number | null;
}

/** "Requirement" -> "Requirements", "Domain rule" -> "Domain rules". */
export const pluralLabel = (label: string) => (/s$/i.test(label) ? label : `${label}s`);

/**
 * A domain's coverage as one group per obligation kind, in meta-model order. Until the engine fills
 * `obligations`, falls back to the older requirement and domain rule fields, with nothing planned shown.
 */
export function obligationGroups(coverage: Coverage): ObligationGroup[] {
  const obligations = (coverage as Partial<Coverage>).obligations;
  if (Array.isArray(obligations) && obligations.length > 0) {
    return obligations.map((o) => ({
      kind: o.kind,
      label: o.label || o.kind.replaceAll('_', ' '),
      total: o.total,
      designed: o.designed,
      built: measured(o.built),
      proved: o.proved,
      planned: measured(o.planned),
    }));
  }
  return [
    { kind: 'requirement', label: 'Requirement', total: coverage.requirements, designed: coverage.requirements_satisfied, built: measured(coverage.requirements_built), proved: coverage.requirements_proved, planned: null },
    { kind: 'domain_rule', label: 'Domain rule', total: coverage.rules, designed: coverage.rules_satisfied, built: measured(coverage.rules_built), proved: coverage.rules_proved, planned: null },
  ];
}

/** True once the engine reports coverage per obligation kind. */
export const countsByKind = (coverage: Coverage) => Array.isArray((coverage as Partial<Coverage>).obligations) && coverage.obligations.length > 0;

function CoverageGroup({ group }: { group: ObligationGroup }) {
  const { total } = group;
  return (
    <div className="coverage-group" data-kind={group.kind}>
      <p className="coverage-heading">{pluralLabel(group.label)} <span>{total}</span></p>
      <Bar label="designed" value={group.designed} total={total} title={DESIGNED} />
      <Bar label="built" value={group.built} total={total} title={BUILT} />
      <Bar label="proved" value={group.proved} total={total} title={PROVED} />
      {group.planned !== null && <Bar label="planned" value={group.planned} total={total} title={PLANNED} planned />}
    </div>
  );
}

/** A domain's coverage: one group per obligation kind, each designed, built, proved and planned. */
export function CoverageBars({ coverage }: { coverage: Coverage | undefined }) {
  if (!coverage) return <p className="hint">No coverage figures for this domain.</p>;
  return (
    <div className="coverage">
      {obligationGroups(coverage).map((g) => <CoverageGroup key={g.kind} group={g} />)}
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
  // Every obligation kind once the engine counts them all; until then, requirements and rules.
  const byKind = coverage.length > 0 && coverage.every(countsByKind);
  const groups = coverage.flatMap(obligationGroups);
  const items = groups.reduce((a, g) => a + g.total, 0);
  const designed = groups.reduce((a, g) => a + g.designed, 0);
  const built = sum(groups.map((g) => g.built));
  const proved = groups.reduce((a, g) => a + g.proved, 0);
  const planned = byKind ? sum(groups.map((g) => g.planned)) : null;
  const noun = byKind ? 'obligations' : 'requirements and rules';
  const questions = index.workspace.records.filter((r) => r.kind === 'question' && r.product === productId).length;
  const problems = index.workspace.problems.filter((p) => p.record && index.byId.get(p.record)?.product === productId);
  const errors = problems.filter((p) => p.severity === 'error').length;
  const of = (n: number | null) => (n === null ? 'not yet measured' : `${n} of ${items}`);
  return (
    <div className="evidence" aria-label="Evidence">
      <p className="hint">Signals Lathe counts. They inform the judgment above; they are not the score.</p>
      <dl className="fields evidence-list">
        <div><dt>Designed</dt><dd>{of(designed)} {noun}</dd></div>
        <div><dt>Built</dt><dd>{built === null ? 'not yet measured' : `${of(built)} ${noun}`}</dd></div>
        <div><dt>Proved</dt><dd>{of(proved)} {noun}</dd></div>
        {planned !== null && <div><dt>Planned</dt><dd>{of(planned)} {noun}, by tests not written yet</dd></div>}
        <div><dt>Open questions</dt><dd>{questions}</dd></div>
        <div><dt>Errors</dt><dd>{errors}</dd></div>
        <div><dt>Warnings</dt><dd>{problems.length - errors}</dd></div>
      </dl>
    </div>
  );
}
