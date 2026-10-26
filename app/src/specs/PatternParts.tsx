import { Fragment } from 'react';
import { TreeList } from '../components/TreeList';
import type { SpecIndex, SpecRecord } from './data';
import { addressOf } from '../views/address';
import { Grouped, RecordLink, Section, SpecLink, recordText } from './parts';
import { appliesWhenOf, appliesWhenText, followingDomains, notApplicableReason, patternsFollowedBy, ruleStatus, rulesOf, settingsOf, type RuleStatus } from './patterns';

// The patterns a domain follows ("Patterns we follow" on the domain page) and a pattern's own page:
// its settings, its rules, and the domains and use cases that follow it with each domain's proof
// status per rule.

const list = (ids: string[]) => ids.join(', ');

/** What a rule's row says of its setting and its condition: "setting audit", "applies when scope is not single". */
function RuleTags({ index, rule }: { index: SpecIndex; rule: SpecRecord }) {
  const condition = appliesWhenOf(index, rule);
  return (
    <>
      {rule.fields.setting && <small className="meta"> setting {rule.fields.setting}</small>}
      {condition && <small className="meta"> applies when {appliesWhenText(condition)}</small>}
    </>
  );
}

/** Designed, built and proved marks for a rule in one domain, or Not applicable with its reasons, or Waived here. */
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
      {mark('designed', status.designedBy, 'designed', 'No component in this domain satisfies it.')}
      {mark('built', status.builtBy, 'built', 'No component in this domain whose file exists satisfies it.')}
      {mark('proved', status.provedBy, 'proved', 'No automated or manual test in this domain proves it.')}
      {status.provedBy.length === 0 && status.plannedBy.length > 0 && (
        <span className="rule-mark planned" title={`A planned test is meant to prove it: ${list(status.plannedBy)}. A planned test is not proof.`} data-mark="planned">planned</span>
      )}
    </span>
  );
}

/**
 * The domain page's "Patterns we follow": each pattern the domain's use cases follow, one row
 * each, with its rules folded under it, and per rule whether this domain designs, builds and
 * proves it, or marks it not applicable.
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
              <RuleTags index={index} rule={r} />
              <RuleMarks index={index} status={status} />
            </span>
          </div>
        );
      }}
    />
  );
}

/** A pattern's page: its settings table, its rules, and who follows it with each domain's status per rule. */
export function PatternSections({ index, pattern }: { index: SpecIndex; pattern: SpecRecord }) {
  const settings = settingsOf(pattern);
  const rules = rulesOf(index, pattern.id);
  const domains = followingDomains(index, pattern.id);
  return (
    <>
      <Section title="Settings" count={settings.length}>
        {settings.length === 0 ? <p className="hint">This pattern has no settings.</p> : (
          <table className="data-table pattern-settings">
            <thead><tr><th scope="col">Setting</th><th scope="col">Rules that depend on it</th></tr></thead>
            <tbody>
              {settings.map((s) => {
                const dependent = rules.filter((r) => r.fields.setting?.trim() === s || appliesWhenOf(index, r)?.setting === s);
                return (
                  <tr key={s}>
                    <th scope="row"><code>{s}</code></th>
                    <td>{dependent.length === 0 ? <span className="hint">None</span> : dependent.map((r, i) => <Fragment key={r.id}>{i > 0 && ', '}<RecordLink index={index} id={r.id} showTitle={false} /></Fragment>)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>
      <Section title="Rules" count={rules.length}>
        {rules.length === 0 ? <p className="hint">No rules yet. Add <code>pattern_rule</code> records under this pattern.</p> : (
          <Grouped records={rules} level={3} render={(grouped) => (
            <ul className="record-list plain pattern-rules">
              {grouped.map((r) => (
                <li key={r.id}>
                  <RecordLink index={index} id={r.id} row />
                  <RuleTags index={index} rule={r} />
                </li>
              ))}
            </ul>
          )} />
        )}
      </Section>
      <Section title="Followed by" count={domains.length}>
        {domains.length === 0 && <p className="hint">No use case follows this pattern, so no domain owes its rules.</p>}
        {domains.map((followed) => {
          const { domain, useCases } = followed;
          const d = index.byId.get(domain);
          // A domain that follows the pattern itself gives its settings on its own record, in the first row.
          const givers = [...(followed.byDomain && d ? [d] : []), ...useCases];
          return (
            <section key={domain} className="pattern-domain" aria-label={`Followed in ${domain}`}>
              <h3>
                {d?.product ? <SpecLink to={addressOf(domain)} className="record-link"><code>{domain}</code> <span>{d.title}</span></SpecLink> : <SpecLink to={addressOf(domain)}><code>{domain}</code></SpecLink>}
              </h3>
              <div className="table-scroll">
                <table className="data-table pattern-use-cases">
                  <caption className="sr-only">Use cases in {domain} that follow {pattern.id}, with their settings</caption>
                  <thead>
                    <tr><th scope="col">Use case</th>{settings.map((s) => <th key={s} scope="col"><code>{s}</code></th>)}</tr>
                  </thead>
                  <tbody>
                    {givers.map((uc) => (
                      <tr key={uc.id}>
                        <th scope="row">{uc.kind === 'domain' ? <>The whole domain</> : <RecordLink index={index} id={uc.id} />}</th>
                        {settings.map((s) => {
                          const value = uc.fields[s];
                          const reason = notApplicableReason(value);
                          return <td key={s} className={reason !== null ? 'setting-na' : undefined}>{value ?? <span className="hint">not given</span>}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rules.length > 0 && (
                <table className="data-table pattern-rule-status">
                  <caption className="sr-only">How {domain} designs, builds and proves each rule of {pattern.id}</caption>
                  <thead><tr><th scope="col">Rule</th><th scope="col">In {domain}</th></tr></thead>
                  <tbody>
                    {rules.map((r) => (
                      <tr key={r.id}>
                        <th scope="row"><RecordLink index={index} id={r.id} /></th>
                        <td><RuleMarks index={index} status={ruleStatus(index, r, domain, followed)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </Section>
    </>
  );
}

/** A pattern rule's page: the domains that owe it and how each designs, builds and proves it. */
export function PatternRuleSections({ index, rule }: { index: SpecIndex; rule: SpecRecord }) {
  const domains = rule.parent ? followingDomains(index, rule.parent) : [];
  return (
    <Section title="Owed by" count={domains.length}>
      {domains.length === 0 ? <p className="hint">No domain follows this rule's pattern.</p> : (
        <table className="data-table pattern-rule-status">
          <thead><tr><th scope="col">Domain</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {domains.map((followed) => (
              <tr key={followed.domain}>
                <th scope="row"><RecordLink index={index} id={followed.domain} /></th>
                <td><RuleMarks index={index} status={ruleStatus(index, rule, followed.domain, followed)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}
