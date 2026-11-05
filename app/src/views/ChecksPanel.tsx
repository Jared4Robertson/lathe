import { useEffect } from 'react';
import { useProblems } from '../checking/problems/reads';
import { useLimits } from '../checking/product-setting/reads';
import { strictnessText } from '../checking/product-setting/LimitsSection';
import { checkPagePath } from '../format/reference';
import { readState } from '../record/page-parts';
import { type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';
import { ProblemList, Section } from '../specs/parts';
import { ToolPanelFrame } from './ToolPanel';

// The Checks panel (LA-V41), Tools › Checks: a tool over the stage (LA-PAT-APP-UX-R20), floating at the
// left of the open space, at `?panel=checks` on whatever focus the stage shows. It lists the space's
// problems by check, errors first, then the workspace's. A problem's
// row focuses its record on the stage, which the wiki card then shows, and the panel stays open to
// work down the list, the row of the record in focus marked. A workspace problem names no record, so
// its row opens its check's page in the wiki card. On a phone it is a bottom sheet. The problems are the
// Problems read model's (list-problems, LA-CHK-QRY02), read again after every reload. When the product's check is strict,
// the panel says so above the problems, with any warnings it accepts as a recorded deviation (get-limits, LA-CHK-QRY12).

export interface ChecksPanelProps {
  /** The current space's index, so no other product's problems are in it. */
  index: RecordIndex;
  product: RecordSummary;
  /** The record or group in focus on the stage, whose problems' rows are marked. */
  focus: string | null;
  sheet: boolean;
  onClose: () => void;
}

export function ChecksPanel({ index, product, focus, sheet, onClose }: ChecksPanelProps) {
  const read = readState(index, product.id, useProblems(product.id, index), (answer) => answer.product === product.id, false);
  const problems = 'answer' in read ? read.answer : null;
  // The row of the record in focus scrolls into view, so working down the list never loses the place.
  useEffect(() => { document.querySelector('.checks-panel li.problem.is-current')?.scrollIntoView?.({ block: 'nearest' }); }, [focus, problems]);
  const limits = useLimits(product.id, index);
  const strict = limits.state === 'read' && limits.answer.product === product.id && limits.answer.strictCheck ? limits.answer : null;
  const counts = problems && (
    <p className={`checks ${problems.errors ? 'failed' : 'ok'}`}>
      {problems.errors} error{problems.errors === 1 ? '' : 's'} · {problems.warnings} warning{problems.warnings === 1 ? '' : 's'}
    </p>
  );
  const workspace = problems?.workspace.reduce((n, g) => n + g.problems.length, 0) ?? 0;
  return (
    <ToolPanelFrame label="Checks" head={counts} className="checks-panel" sheet={sheet} onClose={onClose}>
      {'shown' in read ? read.shown : null}
      {problems && (
        <div className="spec-body">
          {strict && <p className="hint checks-strictness">{strictnessText(strict)}.</p>}
          {problems.errors + problems.warnings === 0 && <p className="hint">Every check passed in {product.title}.</p>}
          {problems.own.map(({ check, problems: group }) => (
            <Section key={check} level={3} title={check} titleTo={checkPagePath(check)} count={group.length}>
              <ProblemList index={index} problems={group} showCheck={false} current={focus} />
            </Section>
          ))}
          {workspace > 0 && (
            <Section level={3} title="Workspace" count={workspace}>
              <p className="hint">Problems that belong to no product, such as in the meta-model or the config. Every space shows them.</p>
              {problems.workspace.map(({ check, problems: group }) => (
                <Section key={check} level={4} title={check} titleTo={checkPagePath(check)} count={group.length}>
                  <ProblemList index={index} problems={group} showCheck={false} current={focus} />
                </Section>
              ))}
            </Section>
          )}
        </div>
      )}
    </ToolPanelFrame>
  );
}
