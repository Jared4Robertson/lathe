import { useEffect } from 'react';
import { LongList } from '../components/LongList';
import { checkPagePath } from '../format/reference';
import { exceptionOwner, isWorkspaceProblem, problemOrder, type Problem, type RecordedException, type SpecIndex, type SpecRecord } from '../specs/data';
import { idText, ProblemList, RecordLink, Section } from '../specs/parts';
import { ToolPanelFrame } from './ToolPanel';

// The Checks panel (LA-V41), Tools › Checks: a tool over the stage (LA-PAT-APP-UX-R19), floating at the
// left of the open space, at `?panel=checks` on whatever focus the stage shows. It lists the space's
// problems by check, errors first, then the workspace's, then the recorded exceptions. A problem's
// row focuses its record on the stage, which the wiki card then shows, and the panel stays open to
// work down the list, the row of the record in focus marked. A workspace problem names no record, so
// its row opens its check's page in the wiki card. On a phone it is a bottom sheet.

/** Problems by check, in the order of their first problem (errors first). */
function byCheck(problems: Problem[]): [string, Problem[]][] {
  const groups = new Map<string, Problem[]>();
  for (const p of [...problems].sort(problemOrder)) groups.set(p.check, [...(groups.get(p.check) ?? []), p]);
  return [...groups.entries()];
}

export interface ChecksPanelProps {
  /** The current space's index, so no other product's problems are in it. */
  index: SpecIndex;
  product: SpecRecord;
  /** The record or group in focus on the stage, whose problems' rows are marked. */
  focus: string | null;
  sheet: boolean;
  onClose: () => void;
}

export function ChecksPanel({ index, product, focus, sheet, onClose }: ChecksPanelProps) {
  const all = index.workspace.problems;
  const workspace = all.filter((p) => isWorkspaceProblem(index, p));
  const own = all.filter((p) => !isWorkspaceProblem(index, p));
  const errors = all.filter((p) => p.severity === 'error').length;
  // The row of the record in focus scrolls into view, so working down the list never loses the place.
  useEffect(() => { document.querySelector('.checks-panel li.problem.is-current')?.scrollIntoView?.({ block: 'nearest' }); }, [focus]);
  const counts = (
    <p className={`checks ${errors ? 'failed' : 'ok'}`}>
      {errors} error{errors === 1 ? '' : 's'} · {all.length - errors} warning{all.length - errors === 1 ? '' : 's'}
    </p>
  );
  return (
    <ToolPanelFrame label="Checks" head={counts} className="checks-panel" sheet={sheet} onClose={onClose}>
      <div className="spec-body">
        {all.length === 0 && <p className="hint">Every check passed in {product.title}.</p>}
        {byCheck(own).map(([check, group]) => (
          <Section key={check} level={3} title={check} titleTo={checkPagePath(check)} count={group.length}>
            <ProblemList index={index} problems={group} showCheck={false} current={focus} />
          </Section>
        ))}
        {workspace.length > 0 && (
          <Section level={3} title="Workspace" count={workspace.length}>
            <p className="hint">Problems that belong to no product, such as in the meta-model or the config. Every space shows them.</p>
            {byCheck(workspace).map(([check, group]) => (
              <Section key={check} level={4} title={check} titleTo={checkPagePath(check)} count={group.length}>
                <ProblemList index={index} problems={group} showCheck={false} current={focus} />
              </Section>
            ))}
          </Section>
        )}
        {index.workspace.exceptions.length > 0 && <RecordedExceptions index={index} exceptions={index.workspace.exceptions} />}
      </div>
    </ToolPanelFrame>
  );
}

/**
 * The recorded exceptions (LA-V41-R04): each command that also changes another aggregate of its
 * domain in the same transaction, and each repository that also persists another aggregate, with the
 * aggregate and the reason. They are deliberate deviations, not problems: listed in a section of
 * their own, never counted or marked as warnings.
 */
function RecordedExceptions({ index, exceptions }: { index: SpecIndex; exceptions: RecordedException[] }) {
  const items = exceptions.map((e) => ({ e, owner: exceptionOwner(e), key: `${exceptionOwner(e)} ${e.aggregate}` }));
  return (
    <Section level={3} title="Recorded exceptions" count={exceptions.length}>
      <p className="hint">Deliberate deviations, each recorded with its reason: a command that also changes another aggregate in the same transaction, or a repository that also persists another aggregate. They are not problems.</p>
      <LongList
        label="Recorded exceptions"
        className="record-list exceptions"
        items={items}
        itemKey={(item) => item.key}
        searchText={({ e, owner }) => `${idText(index, owner)} ${idText(index, e.aggregate)} ${e.reason}`}
        render={({ e, owner }) => (
          <>
            <RecordLink index={index} id={owner} showTitle={false} row />
            <span className="exception-text">
              {'command' in e ? 'also changes' : 'also persists'} <RecordLink index={index} id={e.aggregate} showTitle={false} />
              {'command' in e ? ' in the same transaction' : ''}: {e.reason}
            </span>
          </>
        )}
      />
    </Section>
  );
}
