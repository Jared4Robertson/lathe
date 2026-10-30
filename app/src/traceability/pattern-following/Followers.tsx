import { useEffect, useRef, useState } from 'react';
import type { PatternPage } from '../../../../lathe/src/authoring/pattern/read-model';
import type { FollowingDomain, FollowingPage, SettingLine } from '../../../../lathe/src/traceability/pattern-following/read-model';
import { Refusal, problemText } from '../../edit/fields';
import type { Read } from '../../record/read';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { RecordLink, Section, SpecLink } from '../../specs/parts';
import { RuleMarks } from '../../specs/PatternParts';
import { ruleStatus, type Followed } from '../../specs/patterns';
import { addressOf } from '../../views/address';
import { FollowButton, FollowingForm, RowActions, type FollowingMode } from './FollowingEditor';
import { useFollowers } from './reads';

// A pattern's followers on the Pattern page (LA-TRC-A3's sections of LA-V122, /<id>): Followed by on the pattern's page
// and Owed by on a rule's, read through the Pattern following aggregate's own query (GET
// /api/pattern-following/list-followers): each domain that follows the pattern, whether the domain itself does, and
// each of its use cases that does, with the value (or the reason it does not apply) each gives each setting. Each
// follower's row carries the following's editor (FollowingEditor). Each rule's standing in a domain is the coverage's,
// read from the workspace's index (ruleStatus) until that read is its own.

/** How a domain follows the pattern, as the rule standings read it: its following use cases and whether it does itself. */
function followedOf(index: RecordIndex, d: FollowingDomain): Followed {
  return { useCases: d.useCases.flatMap((f) => index.byId.get(f.follower) ?? []), byDomain: d.itself !== null };
}

/** What a read shows until it answers for the pattern: its refusal, or that it is reading. */
function unread(read: Read<{ pattern: string }>, pattern: string) {
  if (read.state === 'refused') return <Refusal title={`The followers of ${pattern} could not be read.`} reasons={read.problems.length ? read.problems.map(problemText) : [read.error]} focusKey={0} />;
  if (read.state !== 'read' || read.answer.pattern !== pattern) return <p className="hint" role="status">Reading the followers of {pattern}…</p>;
  return null;
}

/** A setting's cell: the value the follower gives it, why it does not apply, or that it is not given. */
function SettingCell({ name, given }: { name: string; given: SettingLine | undefined }) {
  const notApplicable = given?.notApplicable?.trim() || null;
  return (
    <td role="cell" data-label={name} className={notApplicable !== null ? 'setting-na' : undefined}>
      {!given ? <span className="hint">not given</span> : given.notApplicable !== null ? `Not applicable: ${given.notApplicable}` : given.value ?? ''}
    </td>
  );
}

/** One domain that follows the pattern: who follows it there with the values they give, and its standing per rule. */
function FollowingDomainSection({ index, page, d, setMode }: { index: RecordIndex; page: PatternPage; d: FollowingDomain; setMode: (mode: FollowingMode) => void }) {
  const { domain } = d;
  const patternId = page.pattern.id;
  const record = index.byId.get(domain);
  // A domain that follows the pattern itself gives its settings on its own record, in the first row.
  const givers: FollowingPage[] = [...(d.itself ? [d.itself] : []), ...d.useCases];
  const followed = followedOf(index, d);
  return (
    <section className="pattern-domain" aria-label={`Followed in ${domain}`}>
      <h3>
        {record?.product ? <SpecLink to={addressOf(domain)} className="record-link"><code>{domain}</code> <span>{record.title}</span></SpecLink> : <SpecLink to={addressOf(domain)}><code>{domain}</code></SpecLink>}
      </h3>
      <div className="table-scroll table-stack">
        <table className="data-table pattern-use-cases" role="table">
          <caption className="sr-only">Use cases in {domain} that follow {patternId}, with their settings</caption>
          <thead role="rowgroup">
            <tr role="row"><th scope="col" role="columnheader">Use case</th>{page.settings.map((s) => <th key={s.name} scope="col" role="columnheader"><code>{s.name}</code></th>)}</tr>
          </thead>
          <tbody role="rowgroup">
            {givers.map((f) => (
              <tr key={f.follower} role="row">
                <th scope="row" role="rowheader">
                  {f.follower === domain ? <>The whole domain</> : <RecordLink index={index} id={f.follower} />}
                  <RowActions following={f} setMode={setMode} />
                </th>
                {page.settings.map((s) => <SettingCell key={s.name} name={s.name} given={f.settings.find((v) => v.setting === s.name)} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {page.rules.length > 0 && (
        <div className="table-scroll table-stack">
          <table className="data-table pattern-rule-status">
            <caption className="sr-only">How {domain} proves each rule of {patternId}</caption>
            <thead><tr><th scope="col">Rule</th><th scope="col">In {domain}</th></tr></thead>
            <tbody>
              {page.rules.map(({ rule: { id } }) => (
                <tr key={id}>
                  <th scope="row"><RecordLink index={index} id={id} /></th>
                  <td data-label={`In ${domain}`}>{index.byId.has(id) && <RuleMarks index={index} status={ruleStatus(index, index.byId.get(id)!, domain, followed)} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Each domain that follows the pattern, with its followers' values and its standing per rule; and Follow. */
export function FollowedBy({ index, page }: { index: RecordIndex; page: PatternPage }) {
  const patternId = page.pattern.id;
  const read = useFollowers(patternId, index);
  const [mode, setMode] = useState<FollowingMode>({ mode: 'view' });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setMode({ mode: 'view' }); }, [patternId]);
  const shown = unread(read, patternId);
  const domains = read.state === 'read' ? read.answer.domains : [];
  const followers = domains.flatMap((d) => [...(d.itself ? [d.domain] : []), ...d.useCases.map((f) => f.follower)]);
  const done = () => {
    setMode({ mode: 'view' });
    setTimeout(() => box.current?.querySelector<HTMLElement>('.record-actions button')?.focus(), 0);
  };
  return (
    <Section title="Followed by" count={shown ? undefined : domains.length}>
      <div ref={box}>
        {shown ?? (
          <>
            {domains.length === 0 && <p className="hint">No use case follows this pattern, so no domain owes its rules.</p>}
            {domains.map((d) => <FollowingDomainSection key={d.domain} index={index} page={page} d={d} setMode={setMode} />)}
            {mode.mode === 'view' ? <FollowButton pattern={patternId} setMode={setMode} /> : <FollowingForm index={index} page={page} followers={followers} mode={mode} onDone={done} />}
          </>
        )}
      </div>
    </Section>
  );
}

/** The domains that owe a rule, each with its standing for it. */
export function OwedBy({ index, page, id }: { index: RecordIndex; page: PatternPage; id: string }) {
  const read = useFollowers(page.pattern.id, index);
  const shown = unread(read, page.pattern.id);
  const domains = read.state === 'read' ? read.answer.domains : [];
  const rule = index.byId.get(id);
  return (
    <Section title="Owed by" count={shown ? undefined : domains.length}>
      {shown ?? (domains.length === 0 || !rule ? <p className="hint">No domain follows this rule's pattern.</p> : (
        <div className="table-scroll table-stack">
          <table className="data-table pattern-rule-status">
            <thead><tr><th scope="col">Domain</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.domain}>
                  <th scope="row"><RecordLink index={index} id={d.domain} /></th>
                  <td data-label="Status"><RuleMarks index={index} status={ruleStatus(index, rule, d.domain, followedOf(index, d))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Section>
  );
}

/** How many domains follow the pattern, for its summary in the wiki card: from the same read, blank until it answers. */
export function FollowedInCount({ index, pattern }: { index: RecordIndex; pattern: string }) {
  const read = useFollowers(pattern, index);
  if (read.state !== 'read' || read.answer.pattern !== pattern) return null;
  const n = read.answer.domains.length;
  return <>{n} {n === 1 ? 'domain' : 'domains'}</>;
}
