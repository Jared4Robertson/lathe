import { Fragment } from 'react';
import { LongList } from '../components/LongList';
import { checkPagePath } from '../format/reference';
import { type SpecIndex, type SpecRecord } from './data';
import { groupRecords } from './groups';
import { RecordLink, RecordRowBody, Section, SpecLink, TestStateTag, idText } from './parts';
import { isBuilt, traceEmpty, traceOf, type GapKind, type Judgment, type TraceGap, type TraceGroup } from './trace';

// A record's Traceability section (LA-TRC-UC14): what designs, proves, supports and carries it
// out, or what it designs, proves and uses, each list titled by its links' label. For an obligation,
// a callout names each gap coverage finds, linked to the check that reports it; a pattern rule has
// one line per domain owing it. A use case shows its requirements in a table. The logic is in
// trace.ts.

/** What each gap is called, in the wiki's callouts and the side bar's Coverage gaps alike. */
export const GAP_TEXT: Record<GapKind, { title: string; detail: string }> = {
  'not-designed': { title: 'Not designed yet', detail: 'nothing designs it.' },
  'not-built': { title: 'Not built yet', detail: "no designing component's file exists." },
  'not-proved': { title: 'Not proved yet', detail: 'no automated or manual test proves it.' },
  'only-planned': { title: 'Not proved yet', detail: 'its test is only planned.' },
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
function Judgments({ index, record, judgments }: { index: SpecIndex; record: SpecRecord; judgments: Judgment[] }) {
  if (record.domain) {
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
function TraceList({ index, group }: { index: SpecIndex; group: TraceGroup }) {
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
              {group.role === 'design' && record.kind === 'component' && (
                <span className={`rule-mark ${isBuilt(index, id) ? 'ok' : 'missing'}`} data-mark="built">{isBuilt(index, id) ? 'built' : 'not built'}</span>
              )}
            </div>
          );
        }}
      />
    </Section>
  );
}

/** IDs as compact links in a table cell, or a flag when there are none. */
function Cell({ index, ids, flag, planned = [] }: { index: SpecIndex; ids: string[]; flag: string | null; planned?: string[] }) {
  return (
    <span className="trace-cell">
      {ids.map((id) => <RecordLink key={id} index={index} id={id} showTitle={false} />)}
      {planned.map((id) => (
        <span key={id} className="rule-mark planned" title={`${id} is only planned: it is not proof yet.`}>
          <RecordLink index={index} id={id} showTitle={false} /> planned
        </span>
      ))}
      {flag && <span className="badge warning">{flag}</span>}
    </span>
  );
}

/** A use case's requirements, one row each under their groups: Designed, Built and Proved, each cell linking what does it. */
function RequirementTable({ index, useCase, rows }: { index: SpecIndex; useCase: SpecRecord; rows: { record: SpecRecord; judgment: Judgment | null }[] }) {
  if (rows.length === 0) return null;
  const has = (j: Judgment | null, kind: GapKind) => !!j?.gaps.some((g) => g.kind === kind);
  const judgmentOf = new Map(rows.map((r) => [r.record.id, r.judgment]));
  return (
    <div className="table-scroll">
      <table className="data-table trace-requirements">
        <caption className="sr-only">How each requirement of {useCase.id} is designed, built and proved</caption>
        <thead>
          <tr><th scope="col">Requirement</th><th scope="col">Designed</th><th scope="col">Built</th><th scope="col">Proved</th></tr>
        </thead>
        {/* One body per group (FORMAT.md section 22), the ungrouped first, each group headed by its name. */}
        {groupRecords(rows.map((r) => r.record)).map((g) => (
          <tbody key={g.key} data-group={g.heading ?? undefined}>
            {g.heading !== null && <tr className="group-row"><th scope="rowgroup" colSpan={4}>{g.heading}</th></tr>}
            {g.records.map((record) => {
              const j = judgmentOf.get(record.id) ?? null;
              return (
                <tr key={record.id} data-requirement={record.id}>
                  <th scope="row"><RecordLink index={index} id={record.id} /></th>
                  <td>{j && (j.needsDesign ? <Cell index={index} ids={j.designedBy} flag={has(j, 'not-designed') ? 'not designed' : null} /> : <span className="hint">Not asked</span>)}</td>
                  <td>{j && (j.needsDesign ? <Cell index={index} ids={j.builtBy} flag={has(j, 'not-built') || has(j, 'not-designed') ? 'not built' : null} /> : <span className="hint">Not asked</span>)}</td>
                  <td>{j && <Cell index={index} ids={j.provedBy} planned={j.provedBy.length === 0 ? j.plannedBy : []} flag={has(j, 'not-proved') || has(j, 'only-planned') ? 'not proved' : null} />}</td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** The file a test runs from, with its state. */
function RunBy({ record, file, missing }: { record: SpecRecord; file: string; missing: boolean }) {
  return (
    <Section title="Run by" level={3} className="trace-group">
      <p className="trace-run-by">
        <code>{file}</code> <TestStateTag record={record} />
        {missing && <> <span className="badge error">file missing</span> <CheckLink check="test-file-missing" /></>}
      </p>
    </Section>
  );
}

export function Traceability({ index, record, skip }: { index: SpecIndex; record: SpecRecord; skip?: ReadonlySet<string> }) {
  const trace = traceOf(index, record, skip);
  if (traceEmpty(trace)) return null;
  return (
    <Section title="Traceability" className="traceability">
      <Judgments index={index} record={record} judgments={trace.judgments} />
      <RequirementTable index={index} useCase={record} rows={trace.requirements} />
      {trace.groups.map((g, i) => (
        <Fragment key={g.key}>
          {/* A test's file follows what it proves and supports. */}
          {record.kind === 'test' && trace.runBy && i === trace.groups.findIndex((x) => x.key.startsWith('in:')) && <RunBy record={record} {...trace.runBy} />}
          <TraceList index={index} group={g} />
        </Fragment>
      ))}
      {record.kind === 'test' && trace.runBy && !trace.groups.some((x) => x.key.startsWith('in:')) && <RunBy record={record} {...trace.runBy} />}
    </Section>
  );
}
