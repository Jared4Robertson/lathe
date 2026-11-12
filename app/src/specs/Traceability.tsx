import { Fragment } from 'react';
import { LongList } from '../components/LongList';
import { checkPagePath } from '../format/reference';
import { compareIds, type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';
import { groupRecords } from './groups';
import { RecordLink, RecordRowBody, Section, SpecLink, TestStateTag, idText } from './parts';
import type { GapKind, Judgment, RunBy, TraceGap } from '../../../lathe/src/traceability/record-trace/read-model';
import { useRecordTrace, type RecordTrace } from '../traceability/record-trace/reads';
import { TableScroll } from '../components/TableScroll';

/** One list of the section: a chain's group, or the links of one label read from this record's end. */
interface TraceGroup {
  key: string;
  label: string;
  role: 'design' | 'build' | 'proof' | 'plain';
  ids: string[];
}

const sortIds = (ids: Iterable<string>) => [...new Set(ids)].sort(compareIds);

/**
 * The section's lists: an obligation's chain, then the links into it and out of it to what the chain does not hold; a
 * test's Proves first; any other record's links out, then in. Links of the same label are one list; `skip` leaves out
 * relations a page shows in a section of its own ("out:hears", "in:fulfills").
 */
function groupsOf(trace: RecordTrace, obligation: boolean, skip: ReadonlySet<string>): TraceGroup[] {
  const links = (direction: 'out' | 'in'): TraceGroup[] => {
    const byLabel = new Map<string, string[]>();
    for (const g of trace.links) {
      if (g.direction !== direction || skip.has(`${direction}:${g.relation}`)) continue;
      byLabel.set(g.label, [...(byLabel.get(g.label) ?? []), ...g.ids]);
    }
    return [...byLabel].sort(([a], [b]) => a.localeCompare(b)).map(([label, ids]) => ({ key: `${direction}:${label}`, label, role: 'plain', ids: sortIds(ids) }));
  };
  if (obligation) return [...trace.chain.map((g) => ({ key: g.role, label: g.label, role: g.role, ids: g.ids })), ...links('in'), ...links('out')];
  return [...(trace.proves ? [{ key: 'proves', label: 'Proves', role: 'plain' as const, ids: [trace.proves] }] : []), ...links('out'), ...links('in')];
}

// A record's Traceability section (LA-TRC-UC14): for an obligation, its chain as the engine works it
// out (what designs it, the technical records that build it, each marked built or not, and the tests
// that prove it), then its other links, each list titled by its label; a callout names each gap coverage
// finds, linked to the check that reports it, and a pattern rule has one line per domain owing it. A
// use case shows its UC requirements in a table; a test shows what it proves and how it is run. The
// logic is in trace.ts.

/** What each gap is called, in the wiki's callouts and its Coverage gaps alike. */
export const GAP_TEXT: Record<GapKind, { title: string; detail: string }> = {
  'not-designed': { title: 'Not designed yet', detail: 'nothing specifies how it is carried out.' },
  'not-built': { title: 'Not built yet', detail: 'no technical record carrying it out names a file that exists.' },
  'not-proved': { title: 'Not proved yet', detail: 'no automated or manual test proves it.' },
  'not-automated': { title: 'Not proved yet', detail: 'its test is not automated yet.' },
};

function CheckLink({ check }: { check: string }) {
  return <SpecLink to={checkPagePath(check)} className="check-link" title={`How the ${check} check works`}><code className="check-name">{check}</code></SpecLink>;
}

function GapCallout({ gap }: { gap: TraceGap }) {
  const text = GAP_TEXT[gap.kind];
  return (
    <span className={`trace-gap ${gap.kind}`} data-gap={gap.kind}>
      <strong>{text.title}:</strong> {text.detail} <CheckLink check={gap.check} />
    </span>
  );
}

/** The gaps of an obligation in its own domain, or one line per owing domain for a pattern rule. */
function Judgments({ index, record, judgments }: { index: RecordIndex; record: RecordSummary; judgments: Judgment[] }) {
  if (record.kind !== 'pattern_rule') {
    const gaps = judgments.flatMap((j) => j.gaps);
    if (gaps.length === 0) return null;
    return (
      <ul className="plain trace-gaps" aria-label={`Gaps in ${record.id}`}>
        {gaps.map((g) => <li key={g.kind}><GapCallout gap={g} /></li>)}
      </ul>
    );
  }
  if (judgments.length === 0) return <p className="hint">No domain owes it yet: no domain follows its pattern where it applies.</p>;
  return (
    <ul className="plain trace-gaps by-domain" aria-label={`${record.id} by domain`}>
      {judgments.map((j) => (
        <li key={j.domain} className="trace-domain">
          <RecordLink index={index} id={j.domain} />
          {j.gaps.length === 0 ? <span className="rule-mark ok">designed, built and proved</span> : j.gaps.map((g) => <GapCallout key={g.kind} gap={g} />)}
        </li>
      ))}
    </ul>
  );
}

/** One group's rows: each a whole-row link (LA-PAT-APP-UX-R05), with its kind only when the list mixes kinds. */
function TraceList({ index, group, built }: { index: RecordIndex; group: TraceGroup; built: ReadonlySet<string> }) {
  const records = group.ids.map((id) => index.byId.get(id));
  const mixed = new Set(records.map((r) => r?.kind)).size > 1;
  return (
    <Section title={group.label} count={group.ids.length} level={3} className="trace-group">
      <LongList
        label={group.label}
        className="record-list trace-list"
        items={group.ids}
        itemKey={(id) => id}
        searchText={(id) => idText(index, id)}
        render={(id) => {
          const record = index.byId.get(id);
          if (!record) return <RecordLink index={index} id={id} row />;
          return (
            <div className="trace-row">
              <RecordRowBody index={index} record={record} showKind={mixed} />
              {group.role === 'build' && index.meta.kinds.get(record.kind)?.stage === 'technical-specification' && (
                <span className={`rule-mark ${built.has(id) ? 'ok' : 'missing'}`} data-mark="built">{built.has(id) ? 'built' : 'not built'}</span>
              )}
            </div>
          );
        }}
      />
    </Section>
  );
}

/** IDs as compact links in a table cell, or a flag when there are none. */
function Cell({ index, ids, flag, notAutomated = [] }: { index: RecordIndex; ids: string[]; flag: string | null; notAutomated?: string[] }) {
  return (
    <span className="trace-cell">
      {ids.map((id) => <RecordLink key={id} index={index} id={id} showTitle={false} />)}
      {notAutomated.map((id) => (
        <span key={id} className="rule-mark not-automated" title={`${id} is not automated yet: it is not proof yet.`}>
          <RecordLink index={index} id={id} showTitle={false} /> not automated yet
        </span>
      ))}
      {flag && <span className="badge warning">{flag}</span>}
    </span>
  );
}

/** A use case's requirements, one row each under their groups: Designed, Built and Proved, each cell linking what does it. */
function RequirementTable({ index, useCase, requirements }: { index: RecordIndex; useCase: RecordSummary; requirements: RecordTrace['requirements'] }) {
  if (requirements.length === 0) return null;
  const rows = requirements.map((r) => ({ record: index.byId.get(r.id) ?? { id: r.id, kind: 'uc_requirement', title: r.id, parent: useCase.id, product: useCase.product, domain: useCase.domain, group: r.group, testState: null, names: null, level: null, file: '', line: 0, digest: '' }, judgment: r.judgment }));
  const has = (j: Judgment | null, kind: GapKind) => !!j?.gaps.some((g) => g.kind === kind);
  const judgmentOf = new Map(rows.map((r) => [r.record.id, r.judgment]));
  return (
    <TableScroll stack>
      <table className="data-table trace-requirements" role="table">
        <caption className="sr-only">How each UC requirement of {useCase.id} is designed, built and proved</caption>
        <thead role="rowgroup">
          <tr role="row"><th scope="col" role="columnheader">UC requirement</th><th scope="col" role="columnheader">Designed</th><th scope="col" role="columnheader">Built</th><th scope="col" role="columnheader">Proved</th></tr>
        </thead>
        {/* One body per group (lathe/REFERENCE.md), the ungrouped first, each group headed by its name. */}
        {groupRecords(rows.map((r) => r.record)).map((g) => (
          <tbody key={g.key} data-group={g.heading ?? undefined} role="rowgroup">
            {g.heading !== null && <tr className="group-row" role="row"><th scope="rowgroup" colSpan={4} role="rowheader">{g.heading}</th></tr>}
            {g.records.map((record) => {
              const j = judgmentOf.get(record.id) ?? null;
              return (
                <tr key={record.id} data-requirement={record.id} role="row">
                  <th scope="row" role="rowheader"><RecordLink index={index} id={record.id} /></th>
                  <td role="cell" data-label="Designed">{j && (j.needsDesign ? <Cell index={index} ids={j.designedBy} flag={has(j, 'not-designed') ? 'not designed' : null} /> : <span className="hint">Not asked</span>)}</td>
                  <td role="cell" data-label="Built">{j && (j.needsDesign ? <Cell index={index} ids={j.builtBy} flag={has(j, 'not-built') || has(j, 'not-designed') ? 'not built' : null} /> : <span className="hint">Not asked</span>)}</td>
                  <td role="cell" data-label="Proved">{j && <Cell index={index} ids={j.provedBy} notAutomated={j.provedBy.length === 0 ? j.notAutomatedBy : []} flag={has(j, 'not-proved') || has(j, 'not-automated') ? 'not proved' : null} />}</td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </TableScroll>
  );
}

/** How a test is run: its level and state, and the file that runs it or why a person runs it. */
function RunByFacts({ record, runBy }: { record: RecordSummary; runBy: RunBy }) {
  return (
    <Section title="Run by" level={3} className="trace-group">
      <dl className="fields run-by">
        <div><dt>Level</dt><dd>{runBy.level}</dd></div>
        <div><dt>State</dt><dd><TestStateTag record={record} /></dd></div>
        {runBy.file && (
          <div>
            <dt>File</dt>
            <dd><code>{runBy.file}</code>{runBy.missing && <> <span className="badge error">file missing</span> <CheckLink check="test-file-missing" /></>}</dd>
          </div>
        )}
        {runBy.manualReason && <div><dt>Manual because</dt><dd>{runBy.manualReason}</dd></div>}
        <div><dt>Size</dt><dd>{runBy.size}</dd></div>
        <div><dt>Markers</dt><dd>{runBy.markers.length > 0 ? runBy.markers.join(', ') : 'none'}</dd></div>
      </dl>
    </Section>
  );
}

/** A technical record's obligations: each one it builds, with the tests that prove it and their states (LA-TRC-UC14-R09). */
function BuildsTable({ index, record, builds }: { index: RecordIndex; record: RecordSummary; builds: RecordTrace['builds'] }) {
  if (builds.length === 0) return null;
  return (
    <TableScroll stack>
      <table className="data-table trace-builds" role="table">
        <caption className="sr-only">The obligations {record.id} builds, and the tests that prove them</caption>
        <thead role="rowgroup">
          <tr role="row"><th scope="col" role="columnheader">Builds</th><th scope="col" role="columnheader">Proved by</th></tr>
        </thead>
        <tbody role="rowgroup">
          {builds.map((b) => (
            <tr key={b.id} data-builds={b.id} role="row">
              <th scope="row" role="rowheader"><RecordLink index={index} id={b.id} /></th>
              <td role="cell" data-label="Proved by">
                <span className="trace-cell">
                  {b.tests.length === 0 && <span className="badge warning">not proved</span>}
                  {b.tests.map((t) => (
                    <span key={t.id} data-state={t.state}>
                      <RecordLink index={index} id={t.id} showTitle={false} /> <span className="hint">{t.state}</span>
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

/** A technical record's helper files: the other files its code is split across beside its own file (LA-STD-TRACEABILITY-R02). */
function HelperFiles({ files }: { files: RecordTrace['files'] }) {
  const helpers = files.filter((f) => f.helper);
  if (helpers.length === 0) return null;
  return (
    <Section title="Helper files" count={helpers.length} level={3} className="trace-group record-helper-files">
      <ul className="plain">{helpers.map((f) => <li key={f.path}><code>{f.path}</code></li>)}</ul>
    </Section>
  );
}

export function Traceability({ index, record, skip = new Set() }: { index: RecordIndex; record: RecordSummary; skip?: ReadonlySet<string> }) {
  const read = useRecordTrace(record.id, index);
  if (read.state !== 'read' || read.answer.id !== record.id) return null;
  const trace = read.answer;
  const groups = groupsOf(trace, !!index.meta.kinds.get(record.kind)?.obligation, skip);
  if (groups.length === 0 && trace.judgments.length === 0 && trace.requirements.length === 0 && trace.builds.length === 0 && !trace.files.some((f) => f.helper) && !trace.runBy) return null;
  const built = new Set(trace.built);
  return (
    <Section title="Traceability" className="traceability">
      <Judgments index={index} record={record} judgments={trace.judgments} />
      <RequirementTable index={index} useCase={record} requirements={trace.requirements} />
      <BuildsTable index={index} record={record} builds={trace.builds} />
      <HelperFiles files={trace.files} />
      {groups.map((g, i) => (
        <Fragment key={g.key}>
          {/* A test's run by follows what it proves. */}
          {trace.runBy && i === 1 && <RunByFacts record={record} runBy={trace.runBy} />}
          <TraceList index={index} group={g} built={built} />
        </Fragment>
      ))}
      {trace.runBy && groups.length < 2 && <RunByFacts record={record} runBy={trace.runBy} />}
    </Section>
  );
}
