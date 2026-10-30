import { Fragment } from 'react';
import { TreeList } from '../components/TreeList';
import { type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';
import { usePattern } from '../authoring/pattern/reads';
import { useFollowers } from '../traceability/pattern-following/reads';
import { useRecordTrace } from '../traceability/record-trace/reads';
import { RecordLink, recordText } from './parts';
import { patternsFollowedBy, ruleStatus, rulesOf, type RuleStatus } from './patterns';

// The patterns a domain follows ("Patterns we follow" on the domain page), each with its rules and the domain's proof
// status per rule, and a rule's status mark, which the Pattern page shows per following domain. Each mark reads the
// rule's own trace (get-record-trace), its setting from its pattern (get-pattern) and the reasons from the pattern's
// followings (list-followers).

const list = (ids: string[]) => ids.join(', ');

/** A rule's proved mark in one domain, or Not applicable with its reasons. */
function RuleMarks({ index, status }: { index: RecordIndex; status: RuleStatus }) {
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

/** A rule's standing in a domain, read from the rule's trace, its pattern and the pattern's followings; blank until they answer. */
export function RuleMark({ index, rule, pattern, domain }: { index: RecordIndex; rule: string; pattern: string; domain: string }) {
  const trace = useRecordTrace(rule, index);
  const page = usePattern(pattern, index);
  const followers = useFollowers(pattern, index);
  if (trace.state !== 'read' || trace.answer.id !== rule || page.state !== 'read' || followers.state !== 'read') return null;
  const setting = page.answer.rules.find((r) => r.rule.id === rule)?.rule.setting?.trim() ?? '';
  const following = followers.answer.domains.find((d) => d.domain === domain);
  return <RuleMarks index={index} status={ruleStatus(trace.answer, domain, setting, following)} />;
}

/** What a rule's row says of its setting ("setting retention"), read from its pattern; blank until it answers. */
function RuleSetting({ index, rule, pattern }: { index: RecordIndex; rule: string; pattern: string }) {
  const page = usePattern(pattern, index);
  const setting = page.state === 'read' ? page.answer.rules.find((r) => r.rule.id === rule)?.rule.setting : undefined;
  return setting ? <small className="meta"> setting {setting}</small> : null;
}

/**
 * The domain page's "Patterns we follow": each pattern the domain or its use cases follow, one row each, with its
 * rules folded under it, and per rule whether this domain proves it or marks it not applicable.
 */
export function DomainPatterns({ index, domainId, query }: { index: RecordIndex; domainId: string; query?: string }) {
  const followed = patternsFollowedBy(index, domainId);
  if (followed.length === 0) return <p className="hint">This domain follows no pattern.</p>;
  const followedOf = new Map(followed.map((f) => [f.pattern.id, f]));
  // A pattern the domain itself follows: no use case can mark its rules not applicable.
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
              <RuleSetting index={index} rule={r.id} pattern={r.parent ?? ''} />
              <RuleMark index={index} rule={r.id} pattern={r.parent ?? ''} domain={domainId} />
            </span>
          </div>
        );
      }}
    />
  );
}
