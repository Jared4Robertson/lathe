import { Fragment } from 'react';
import { TreeList } from '../components/TreeList';
import { textOf, type SpecIndex, type SpecRecord } from './data';
import { RecordLink, recordText } from './parts';
import { appliesWhenOf, appliesWhenText, patternsFollowedBy, ruleStatus, rulesOf, type RuleStatus } from './patterns';

// The patterns a domain follows ("Patterns we follow" on the domain page), each with its rules and the domain's proof
// status per rule, and a rule's status mark, which the Pattern page shows per following domain.

const list = (ids: string[]) => ids.join(', ');

/** What a rule's row says of its setting and its condition: "setting audit", "applies when scope is not single". */
function RuleTags({ rule }: { rule: SpecRecord }) {
  const condition = appliesWhenOf(rule);
  return (
    <>
      {textOf(rule.row, 'setting') && <small className="meta"> setting {textOf(rule.row, 'setting')}</small>}
      {condition && <small className="meta"> applies when {appliesWhenText(condition)}</small>}
    </>
  );
}

/** A rule's proved mark in one domain, or Not applicable with its reasons, or Waived here. */
export function RuleMarks({ index, status }: { index: SpecIndex; status: RuleStatus }) {
  if (!status.applies && status.why === 'waived') {
    const { setting } = status.condition;
    return (
      <span className="rule-marks">
        <span className="rule-mark na" data-mark="waived" title={`Waived: it applies only when ${appliesWhenText(status.condition)}, and no follower here meets that`}>
          Waived here: {setting} is {status.given.length > 0 ? status.given.join(' or ') : 'not given'}
        </span>
      </span>
    );
  }
  if (!status.applies) {
    return (
      <span className="rule-marks">
        <span className="rule-mark na" title={`Not applicable: every following use case marks ${status.setting} Not applicable`}>not applicable</span>
        <span className="rule-na-reasons">
          {status.reasons.map((r, i) => (
            <Fragment key={r.useCase}>
              {i > 0 && '; '}
              <RecordLink index={index} id={r.useCase} showTitle={false} />: {r.reason || 'no reason given'}
            </Fragment>
          ))}
        </span>
      </span>
    );
  }
  const mark = (label: string, by: string[], kind: string, missing: string) => (
    <span className={`rule-mark ${by.length > 0 ? 'ok' : 'missing'}`} title={by.length > 0 ? `${label} by ${list(by)}` : missing} data-mark={kind}>
      {by.length > 0 ? label : `not ${label}`}
    </span>
  );
  return (
    <span className="rule-marks">
      {mark('proved', status.provedBy, 'proved', 'No automated or manual pattern rule test proves it in this domain.')}
      {status.provedBy.length === 0 && status.notAutomatedBy.length > 0 && (
        <span className="rule-mark not-automated" title={`A test not automated yet is meant to prove it: ${list(status.notAutomatedBy)}. It is not proof yet.`} data-mark="not-automated">not automated yet</span>
      )}
    </span>
  );
}

/**
 * The domain page's "Patterns we follow": each pattern the domain's use cases follow, one row
 * each, with its rules folded under it, and per rule whether this domain proves it or marks it
 * not applicable.
 */
export function DomainPatterns({ index, domainId, query }: { index: SpecIndex; domainId: string; query?: string }) {
  const followed = patternsFollowedBy(index, domainId);
  if (followed.length === 0) return <p className="hint">This domain follows no pattern.</p>;
  const followedOf = new Map(followed.map((f) => [f.pattern.id, f]));
  // A pattern the domain itself follows: no use case can mark its rules not applicable.
  const byDomain = new Set(followed.filter((f) => f.byDomain).map((f) => f.pattern.id));
  return (
    <TreeList<SpecRecord>
      label="Patterns we follow"
      items={followed.map((f) => f.pattern)}
      itemKey={(r) => `${domainId}:${r.id}`}
      nestedOf={(r) => (r.kind === 'pattern' ? rulesOf(index, r.id) : [])}
      searchText={recordText}
      countLabel={(_, nested) => `${nested.length} rule${nested.length === 1 ? '' : 's'}`}
      nestedLabel={(r) => `Rules of ${r.id}`}
      query={query}
      renderRow={(r) => {
        if (r.kind === 'pattern') {
          const ucs = followedOf.get(r.id)?.useCases ?? [];
          return (
            <div className="record-row">
              <RecordLink index={index} id={r.id} row />
              <span className="row-tags">
                <small className="meta">followed by {byDomain.has(r.id) && 'the whole domain'}{byDomain.has(r.id) && ucs.length > 0 && ', '}{ucs.map((u, i) => <Fragment key={u.id}>{i > 0 && ', '}<RecordLink index={index} id={u.id} showTitle={false} /></Fragment>)}</small>
              </span>
            </div>
          );
        }
        const status = ruleStatus(index, r, domainId, followedOf.get(r.parent ?? '') ?? { useCases: [], byDomain: false });
        return (
          <div className="record-row pattern-rule-row">
            <RecordLink index={index} id={r.id} row />
            <span className="row-tags">
              <RuleTags rule={r} />
              <RuleMarks index={index} status={status} />
            </span>
          </div>
        );
      }}
    />
  );
}
