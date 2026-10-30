import type { ReactNode } from 'react';
import type { CheckPage as Check } from '../../../../lathe/src/checking/check/read-model';
import { Refusal, problemText } from '../../edit/fields';
import { ORIGIN_TEXT, type CheckReference } from '../../format/reference';
import { type ListedProblem, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { Markdown } from '../../specs/Markdown';
import { ProblemList, Section } from '../../specs/parts';
import { CheckEditor } from './CheckEditor';
import { useCheck } from './reads';

// The Check page (LA-CHK-A1's page, LA-V03): a check in the wiki card over the stage, at ?page=format/checks/<check>.
// A check with a row (Lathe's or the product's own) is read whole through the aggregate's own query (GET
// /api/check/get-check) and shows its summary, explanation, severity, where it comes from, its query and the kinds it
// concerns; the product's own is changed only through the aggregate's own commands (CheckEditor), and Lathe's are
// read-only. A check the engine reports itself has no row, so its page says so from the format reference. The
// problems it reports now still come from the workspace's index until the Checks panel's read lands.

/** The severities a check's rows report: error_or_warning reports either. */
const severitiesOf = (severity: Check['severity']): string[] => (severity === 'error_or_warning' ? ['error', 'warning'] : [severity]);

const SeverityTags = ({ severities }: { severities: readonly string[] }) => <>{severities.map((s) => <span key={s} className={`severity-tag ${s}`}>{s}</span>)}</>;

/** The problems the check reports now, or a hint when it reports none. */
function ProblemsNow({ index, problems }: { index: RecordIndex; problems: ListedProblem[] }) {
  return (
    <Section title="Problems now" count={problems.length}>
      {problems.length === 0 ? <p className="hint">This check reports nothing now.</p> : <ProblemList index={index} problems={problems} showCheck={false} />}
    </Section>
  );
}

/** A check the engine reports itself: it has no row, so the page says what the format reference knows of it. */
function EngineCheck({ index, check, problems }: { index: RecordIndex; check: CheckReference; problems: ListedProblem[] }) {
  return (
    <>
      <p className="hint">The engine reports this itself: it has no row in the check table.</p>
      <dl className="fields format-facts">
        <div><dt>Severity</dt><dd><SeverityTags severities={check.severities} /></dd></div>
        <div><dt>From</dt><dd>{ORIGIN_TEXT.engine}</dd></div>
      </dl>
      <ProblemsNow index={index} problems={problems} />
    </>
  );
}

/** A check with a row, read whole through its own query, with its editor's actions. */
function RowCheck({ index, name, problems, kindRows }: { index: RecordIndex; name: string; problems: ListedProblem[]; kindRows: (kinds: readonly string[]) => ReactNode }) {
  const read = useCheck(name, index);
  if (read.state === 'refused') return <Refusal title={`${name} could not be read.`} reasons={read.problems.length ? read.problems.map(problemText) : [read.error]} focusKey={0} />;
  if (read.state !== 'read' || read.answer.name !== name) return <p className="hint" role="status">Reading {name}…</p>;
  const page = read.answer;
  return (
    <CheckEditor index={index} page={page}>
      <div data-aggregate="check">
        <Markdown source={page.summary} />
        {page.explanation && <Markdown source={page.explanation} />}
        <dl className="fields format-facts">
          <div><dt>Severity</dt><dd><SeverityTags severities={severitiesOf(page.severity)} /></dd></div>
          <div><dt>From</dt><dd>{ORIGIN_TEXT[page.product === null ? 'lathe' : 'product']}</dd></div>
          <div><dt>Runs</dt><dd>{page.product === null ? `${ordinal(page.position)} of Lathe's checks` : `${ordinal(page.position)} of the product's own, after Lathe's`}</dd></div>
        </dl>
        {page.query && (
          <Section title="Query">
            <div className="markdown"><pre className="check-query" tabIndex={0}><code>{page.query}</code></pre></div>
          </Section>
        )}
        {page.kinds.length > 0 && <Section title="Kinds it concerns" count={page.kinds.length}>{kindRows(page.kinds)}</Section>}
        <ProblemsNow index={index} problems={problems} />
      </div>
    </CheckEditor>
  );
}

/** A position in the run order in words: 1st, 2nd, 3rd, 11th. */
function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/**
 * A check's page body in the wiki card: read through its own query when it has a row, from the format reference when
 * the engine reports it itself. The format page draws the kinds it concerns as its own rows (`kindRows`).
 */
export function CheckPage({ index, check, problems, kindRows }: { index: RecordIndex; check: CheckReference; problems: ListedProblem[]; kindRows: (kinds: readonly string[]) => ReactNode }) {
  return check.origin === 'engine'
    ? <EngineCheck index={index} check={check} problems={problems} />
    : <RowCheck index={index} name={check.check} problems={problems} kindRows={kindRows} />;
}
