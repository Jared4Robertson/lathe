import { Fragment } from 'react';
import { TreeList } from '../components/TreeList';
import { type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';
import { useRecordTrace } from '../traceability/record-trace/reads';
import { RecordLink, recordText } from './parts';
import { patternsFollowedBy, ruleStatus, rulesOf, type RuleStatus } from './patterns';

// The patterns a domain follows ("Patterns we follow" on the domain page), each with its rules and the domain's proof
// status per rule, and a rule's status mark, which the Pattern page shows per following domain. Each mark reads the
// rule's own trace (get-record-trace).

const list = (ids: string[]) => ids.join(', ');

/** A rule's proved mark in one domain. */
function RuleMarks({ status }: { status: RuleStatus }) {
  const proved = status.provedBy.length > 0;
  return (
    <span className="rule-marks">
      <span className={`rule-mark ${proved ? 'ok' : 'missing'}`} title={proved ? `proved by ${list(status.provedBy)}` : 'No automated or manual pattern rule test proves it in this domain.'} data-mark="proved">
        {proved ? 'proved' : 'not proved'}
      </span>
      {!proved && status.notAutomatedBy.length > 0 && (
        <span className="rule-mark not-automated" title={`A test not automated yet is meant to prove it: ${list(status.notAutomatedBy)}. It is not proof yet.`} data-mark="not-automated">not automated yet</span>
      )}
    </span>
  );
}

/** A rule's standing in a domain, read from the rule's trace; blank until it answers. */
export function RuleMark({ index, rule, domain }: { index: RecordIndex; rule: string; domain: string }) {
  const trace = useRecordTrace(rule, index);
  if (trace.state !== 'read' || trace.answer.id !== rule) return null;
  return <RuleMarks status={ruleStatus(trace.answer, domain)} />;
}

/**
 * The domain page's "Patterns we follow": each pattern the domain or its use cases follow, one row each, with its
 * rules folded under it, and per rule whether this domain proves it.
 */
export function DomainPatterns({ index, domainId, query }: { index: RecordIndex; domainId: string; query?: string }) {
  const followed = patternsFollowedBy(index, domainId);
  if (followed.length === 0) return <p className="hint">This domain follows no pattern.</p>;
  const followedOf = new Map(followed.map((f) => [f.pattern.id, f]));
  const byDomain = new Set(followed.filter((f) => f.byDomain).map((f) => f.pattern.id));
  return (
    <TreeList<RecordSummary>
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
        return (
          <div className="record-row pattern-rule-row">
            <RecordLink index={index} id={r.id} row />
            <span className="row-tags">
              <RuleMark index={index} rule={r.id} domain={domainId} />
            </span>
          </div>
        );
      }}
    />
  );
}
